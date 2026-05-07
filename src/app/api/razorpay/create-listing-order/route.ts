import { NextResponse } from 'next/server'

import { recordPaymentIntent } from '@/lib/payment-intents'
import { getListingSubmissionCharge } from '@/lib/payment-security'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim()
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 500 })
  }

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

  // Increment usage count (non-blocking)
  if (couponValid && appliedCoupon) {
    supabase.from('coupons')
      .select('usage_count')
      .eq('code', appliedCoupon)
      .single()
      .then(({ data }) => {
        if (data) {
          supabase.from('coupons')
            .update({ usage_count: (data.usage_count || 0) + 1 })
            .eq('code', appliedCoupon)
            .then(() => {})
        }
      })
  }

  if (amountRupees === 0) {
    return NextResponse.json({ free: true, couponValid: true, finalAmountRupees: 0 })
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
  await recordPaymentIntent({
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

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    couponValid,
    finalAmountRupees: amountRupees,
  })
}
