import { NextResponse } from 'next/server'

import { resolveListingService } from '@/lib/payment-security'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to place an order.' }, { status: 401 })
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim()
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 500 })
  }

  let listingId = ''
  let serviceIndex: number | null = null
  let serviceName: string | null = null
  let quantity = 1

  try {
    const body = await request.json() as {
      listingId: string
      serviceIndex?: number
      serviceName?: string
      quantity?: number
    }

    listingId = body.listingId?.trim()
    serviceIndex = Number.isInteger(body.serviceIndex) ? Number(body.serviceIndex) : null
    serviceName = body.serviceName?.trim() || null
    quantity = Math.max(1, Math.min(99, Math.floor(Number(body.quantity) || 1)))
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!listingId) {
    return NextResponse.json({ error: 'Missing listing ID.' }, { status: 400 })
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, upi_id, approved, services')
    .eq('id', listingId)
    .eq('approved', true)
    .maybeSingle()

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found or not available.' }, { status: 404 })
  }
  if (!listing.upi_id) {
    return NextResponse.json({ error: 'This business has not set up online payments yet.' }, { status: 422 })
  }

  const { service, error: serviceError } = resolveListingService(listing.services, {
    serviceIndex,
    serviceName,
  })
  if (!service || serviceError) {
    return NextResponse.json({ error: serviceError || 'Selected service is unavailable.' }, { status: 400 })
  }

  const amountRupees = service.price * quantity
  const amountPaise = Math.round(amountRupees * 100)

  if (amountPaise < 100) {
    return NextResponse.json({ error: 'Minimum order amount is ₹1.' }, { status: 400 })
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: `order_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        flow: 'order',
        listing_id: listingId,
        listing_name: listing.name,
        service_index: String(service.index),
        service_name: service.name,
        quantity: String(quantity),
        buyer_id: user.id,
      },
    }),
  })

  const order = await response.json()

  if (!response.ok) {
    console.error('[Razorpay product] Order creation failed:', order)
    return NextResponse.json({
      error: order.error?.description || `Razorpay error ${response.status}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    amountRupees,
    listingName: listing.name,
    serviceName: service.name,
    servicePrice: service.price,
    serviceIndex: service.index,
  })
}
