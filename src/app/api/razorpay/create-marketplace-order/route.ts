import { NextResponse, after } from 'next/server'
import { revalidateTag } from 'next/cache'

import { getUserRole } from '@/app/actions/admin'
import { loadOwnerRazorpayKeys } from '@/app/actions/listing-payments'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { sendNotification } from '@/lib/notifications'
import { recordPaymentIntent } from '@/lib/payment-intents'
import { SHOP_NOT_OPEN_MESSAGE, canBuyFromShop } from '@/lib/selling/shop-mode'
import { loadShopState } from '@/lib/selling/shop-state'
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
  let optionId = ''
  let quantity = 1

  try {
    const body = (await request.json()) as { productId?: string; optionId?: string; quantity?: number }
    productId = body.productId?.trim() ?? ''
    optionId = typeof body.optionId === 'string' ? body.optionId.trim() : ''
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
    .select('id, listing_id, type, name, price_paise, quantity_in_stock, is_active, options:listing_product_options(id, label, price_paise, quantity_in_stock)')
    .eq('id', productId)
    .maybeSingle()

  if (!product || !product.is_active) {
    return NextResponse.json({ error: 'Product is not available.' }, { status: 404 })
  }

  type OptionRow = { id: string; label: string; price_paise: number; quantity_in_stock: number | null }
  const options = (product.options ?? []) as OptionRow[]
  let option: OptionRow | null = null

  if (options.length > 0) {
    if (!optionId) {
      return NextResponse.json({ error: 'Choose an option.' }, { status: 400 })
    }
    option = options.find((row) => row.id === optionId) ?? null
    if (!option) {
      return NextResponse.json(
        { error: 'That option is no longer available. Please pick another.', code: 'option_unavailable' },
        { status: 409 },
      )
    }
  } else if (optionId) {
    // The owner removed the options while the customer was choosing.
    return NextResponse.json(
      { error: 'That option is no longer available. Please pick another.', code: 'option_unavailable' },
      { status: 409 },
    )
  } else if (product.price_paise === null) {
    return NextResponse.json({ error: "This item can't be bought online." }, { status: 422 })
  }

  const unitPricePaise: number = option ? option.price_paise : product.price_paise
  const stock: number | null = option ? option.quantity_in_stock : product.quantity_in_stock
  if (stock !== null && stock < quantity) {
    if (option && stock === 0) {
      return NextResponse.json(
        { error: 'That option just sold out. Please pick another.', code: 'option_sold_out' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: stock === 0 ? 'Sorry, this item just sold out.' : `Only ${stock} left.` },
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

  // Test-key shops sell only to their owner (and admins), for practice.
  const shop = await loadShopState(product.listing_id)
  const { role } = await getUserRole(supabase)
  if (!shop || !canBuyFromShop(shop.mode, { isOwner: shop.ownerId === user.id, isAdmin: role === 'admin' })) {
    return NextResponse.json({ error: SHOP_NOT_OPEN_MESSAGE }, { status: 422 })
  }

  // Load owner Razorpay keys
  const ownerKeys = await loadOwnerRazorpayKeys(product.listing_id)
  if (!ownerKeys) {
    return NextResponse.json(
      { error: 'The business owner has not completed payment setup yet.' },
      { status: 422 },
    )
  }

  const amountPaise = unitPricePaise * quantity
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
        ...(option ? { option_id: option.id, option_label: option.label } : {}),
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
      // Only the request that actually clears verified_at tells the owner,
      // so a burst of buyers produces one "Selling paused" notice, not many.
      const { data: cleared } = await adminClient
        .from('listing_payment_configs')
        .update({ verified_at: null, updated_at: new Date().toISOString() })
        .eq('listing_id', product.listing_id)
        .not('verified_at', 'is', null)
        .select('listing_id')
      revalidateTag(CACHE_TAGS.listing(product.listing_id), 'max')

      const ownerId = shop.ownerId
      if (ownerId && Array.isArray(cleared) && cleared.length > 0) {
        after(async () => {
          try {
            await sendNotification(
              ownerId,
              'selling.paused',
              {
                listingId: product.listing_id,
                listingName: listing.name,
                reason: 'Razorpay stopped accepting your keys',
                byAdmin: false,
              },
              { awaitDelivery: true },
            )
          } catch (error) {
            console.error('[marketplace order] selling.paused notification failed', error)
          }
        })
      }

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
      product_price_paise: unitPricePaise,
      option_id: option?.id ?? null,
      option_label: option?.label ?? null,
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
    productPricePaise: unitPricePaise,
    optionLabel: option?.label ?? null,
    testMode: ownerKeys.testMode,
  })
}
