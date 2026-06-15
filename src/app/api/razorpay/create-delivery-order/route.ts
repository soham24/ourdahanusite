import { NextResponse } from 'next/server'

import { validateDeliveryCart, type CartItemInput } from '@/app/actions/delivery'
import { loadOwnerRazorpayKeys } from '@/app/actions/listing-payments'
import { recordPaymentIntent } from '@/lib/payment-intents'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

const MIN_AMOUNT_PAISE = 100 // ₹1

/**
 * Create a Razorpay order (on the business's own account) for an ONLINE
 * delivery checkout. Validates the cart server-side, computes grand total
 * (items + delivery fee), and records a recoverable 'delivery' intent whose
 * payload lets the finalize step recreate the order.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to order.' }, { status: 401 })

  const rl = rateLimit(`rzp-order:${user.id}`, 20, 10 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.resetAt)

  const body = (await request.json().catch(() => null)) as {
    listingId?: string
    items?: CartItemInput[]
    drop?: { lat?: number; lng?: number; address?: string }
    customerName?: string
    customerPhone?: string
    notes?: string
  } | null
  if (!body?.listingId || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const lat = Number(body.drop?.lat)
  const lng = Number(body.drop?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Please drop a delivery pin.' }, { status: 400 })
  }

  const { error, cart } = await validateDeliveryCart(body.listingId, body.items, { lat, lng })
  if (error || !cart) return NextResponse.json({ error: error ?? 'Cart invalid.' }, { status: 422 })

  const amountPaise = cart.quote.grandTotalPaise
  if (amountPaise < MIN_AMOUNT_PAISE) {
    return NextResponse.json({ error: 'Order total too low.' }, { status: 400 })
  }

  const ownerKeys = await loadOwnerRazorpayKeys(cart.listing.id)
  if (!ownerKeys) {
    return NextResponse.json(
      { error: 'This business has not set up online payments. Try Cash on Delivery.' },
      { status: 422 },
    )
  }

  const credentials = Buffer.from(`${ownerKeys.keyId}:${ownerKeys.keySecret}`).toString('base64')
  const receipt = `dl_${cart.listing.id.slice(0, 6)}_${Date.now()}`.slice(0, 40)

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: { flow: 'delivery', listing_id: cart.listing.id, buyer_id: user.id },
    }),
  })

  const orderPayload = (await response.json()) as {
    id?: string; amount?: number; currency?: string; error?: { description?: string }
  }
  if (!response.ok || !orderPayload.id) {
    return NextResponse.json(
      { error: orderPayload.error?.description || `Razorpay error ${response.status}.` },
      { status: 502 },
    )
  }

  await recordPaymentIntent({
    userId: user.id,
    flow: 'delivery',
    razorpayOrderId: orderPayload.id,
    amountPaise,
    payload: {
      listing_id: cart.listing.id,
      items: cart.lineItems.map((li) => ({ productId: li.listing_product_id, quantity: li.quantity })),
      drop: { lat, lng, address: String(body.drop?.address ?? '').trim() },
      customer_name: String(body.customerName ?? '').trim(),
      customer_phone: String(body.customerPhone ?? '').trim(),
      notes: String(body.notes ?? '').trim(),
    },
    listingId: cart.listing.id,
  })

  return NextResponse.json({
    orderId: orderPayload.id,
    amount: orderPayload.amount,
    currency: orderPayload.currency ?? 'INR',
    keyId: ownerKeys.keyId,
    listingName: cart.listing.name,
    deliveryFeePaise: cart.quote.deliveryFeePaise,
    grandTotalPaise: cart.quote.grandTotalPaise,
    testMode: ownerKeys.testMode,
  })
}
