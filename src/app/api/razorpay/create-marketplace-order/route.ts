import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

import { loadOwnerRazorpayKeys } from '@/app/actions/listing-payments'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { recordPaymentIntent } from '@/lib/payment-intents'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

const MIN_AMOUNT_PAISE = 100 // ₹1

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to place an order.' }, { status: 401 })
  }

  const rl = rateLimit(`rzp-order:${user.id}`, 20, 10 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.resetAt)

  let productId = ''
  let quantity = 1

  try {
    const body = (await request.json()) as { productId?: string; quantity?: number }
    productId = body.productId?.trim() ?? ''
    quantity = Math.max(1, Math.min(99, Math.floor(Number(body.quantity) || 1)))
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!productId) {
    return NextResponse.json({ error: 'Missing product ID.' }, { status: 400 })
  }

  // Use admin client to read full row (RLS protects price integrity through server-side validation)
  const adminClient = createAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const { data: product } = await adminClient
    .from('listing_products')
    .select('id, listing_id, type, name, price_paise, quantity_in_stock, is_active')
    .eq('id', productId)
    .maybeSingle()

  if (!product || !product.is_active) {
    return NextResponse.json({ error: 'Product is not available.' }, { status: 404 })
  }

  if (product.quantity_in_stock !== null && product.quantity_in_stock < quantity) {
    return NextResponse.json(
      { error: `Only ${product.quantity_in_stock} in stock.` },
      { status: 409 },
    )
  }

  const { data: listing } = await adminClient
    .from('listings')
    .select('id, name, approved, payments_enabled')
    .eq('id', product.listing_id)
    .maybeSingle()

  if (!listing || !listing.approved) {
    return NextResponse.json({ error: 'Listing is not available.' }, { status: 404 })
  }

  if (!listing.payments_enabled) {
    return NextResponse.json({ error: 'This business is not accepting payments yet.' }, { status: 422 })
  }

  // Load owner Razorpay keys
  const ownerKeys = await loadOwnerRazorpayKeys(product.listing_id)
  if (!ownerKeys) {
    return NextResponse.json(
      { error: 'The business owner has not completed payment setup yet.' },
      { status: 422 },
    )
  }

  const amountPaise = product.price_paise * quantity
  if (amountPaise < MIN_AMOUNT_PAISE) {
    return NextResponse.json({ error: 'Minimum order amount is ₹1.' }, { status: 400 })
  }

  const credentials = Buffer.from(`${ownerKeys.keyId}:${ownerKeys.keySecret}`).toString('base64')
  const receipt = `mp_${product.listing_id.slice(0, 6)}_${Date.now()}`.slice(0, 40)

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        flow: 'marketplace',
        listing_id: product.listing_id,
        listing_name: listing.name,
        product_id: product.id,
        product_name: product.name,
        quantity: String(quantity),
        buyer_id: user.id,
      },
    }),
  })

  const orderPayload = (await response.json()) as {
    id?: string
    amount?: number
    currency?: string
    error?: { description?: string }
  }

  if (!response.ok || !orderPayload.id) {
    console.error(
      '[marketplace order] Razorpay create failed:',
      'status=', response.status,
      'listing=', product.listing_id,
      'keyIdLast4=', ownerKeys.keyId.slice(-4),
      'payload=', orderPayload,
    )

    // Razorpay 401 means the stored credentials no longer authenticate
    // (owner most likely regenerated keys on the Razorpay dashboard, or
    // the account was paused). Auto-clear verified_at so the Shop section
    // hides itself on the public page until the owner re-saves keys.
    if (response.status === 401) {
      await adminClient
        .from('listing_payment_configs')
        .update({ verified_at: null, updated_at: new Date().toISOString() })
        .eq('listing_id', product.listing_id)
      revalidateTag(CACHE_TAGS.listing(product.listing_id), 'max')

      return NextResponse.json(
        {
          error:
            "This business's payment setup needs to be refreshed by the owner. Please try again later or contact the seller directly.",
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: orderPayload.error?.description || `Razorpay error ${response.status}.` },
      { status: 502 },
    )
  }

  await recordPaymentIntent({
    userId: user.id,
    flow: 'marketplace',
    razorpayOrderId: orderPayload.id,
    amountPaise,
    currency: 'INR',
    payload: {
      product_id: product.id,
      listing_id: product.listing_id,
      quantity,
      product_name: product.name,
      product_price_paise: product.price_paise,
    },
    listingId: product.listing_id,
  })

  return NextResponse.json({
    orderId: orderPayload.id,
    amount: orderPayload.amount,
    currency: orderPayload.currency ?? 'INR',
    keyId: ownerKeys.keyId,
    listingName: listing.name,
    productName: product.name,
    productPricePaise: product.price_paise,
    testMode: ownerKeys.testMode,
  })
}
