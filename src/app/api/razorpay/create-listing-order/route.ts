import { NextResponse } from 'next/server'

import { recordPaymentIntent } from '@/lib/payment-intents'
import { getListingSubmissionCharge } from '@/lib/payment-security'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  const rl = rateLimit(`rzp-order:${user.id}`, 20, 10 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.resetAt)

  const body = await request.json().catch(() => ({})) as {
    coupon?: string
    intent?: 'submit' | 'renew'
    listingId?: string
    payload?: Record<string, unknown>
  }
  const charge = await getListingSubmissionCharge(body.coupon ?? null)
  const amountRupees = charge.finalPrice
  const couponValid = charge.couponValid
  const appliedCoupon = charge.couponCode ?? ''
  const intentFlow = body.intent === 'renew' ? 'renew' : 'listing'

  if (amountRupees === 0) {
    return NextResponse.json({ free: true, couponValid: true, finalAmountRupees: 0 })
  }

  // Checked only once a payment is actually needed, so a site run without
  // Razorpay -- a fresh fork, or a town that lists for free -- can still
  // take free listings.
  const keyId = process.env.RAZORPAY_KEY_ID?.trim()
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 500 })
  }

  const amountPaise = amountRupees * 100
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: `listing_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        flow: 'listing',
        buyer_id: user.id,
        coupon: appliedCoupon,
      },
    }),
  })

  const order = await response.json()

  if (!response.ok) {
    console.error('[Razorpay listing] Order creation failed:', order)
    return NextResponse.json({
      error: order.error?.description || `Razorpay error ${response.status}`,
    }, { status: 500 })
  }

  // Record the intent BEFORE Razorpay checkout opens. This is the
  // server-side anchor we use to recover the listing/renewal if the
  // user closes the page after paying.
  const recorded = await recordPaymentIntent({
    userId: user.id,
    flow: intentFlow,
    razorpayOrderId: order.id as string,
    amountPaise: amountPaise,
    currency: 'INR',
    payload: {
      coupon: appliedCoupon,
      ...(body.payload ?? {}),
      ...(body.listingId ? { listing_id: body.listingId } : {}),
    },
    listingId: body.listingId ?? null,
  })

  if (!recorded) {
    return NextResponse.json({ error: 'Checkout is temporarily unavailable. No payment has been taken. Please try again.' }, { status: 503 })
  }

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    couponValid,
    finalAmountRupees: amountRupees,
  })
}
