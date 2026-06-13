import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordPaymentIntent } from '@/lib/payment-intents'
import { getJobSubmissionCharge } from '@/lib/payment-security'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to post a job.' }, { status: 401 })
  }

  const rl = rateLimit(`rzp-order:${user.id}`, 20, 10 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.resetAt)

  const keyId = process.env.RAZORPAY_KEY_ID?.trim()
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 500 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    coupon?: string
    payload?: Record<string, unknown>
  }
  const charge = await getJobSubmissionCharge((body.coupon as string | undefined) ?? null)
  const finalPrice = charge.finalPrice

  // Free coupon — skip Razorpay, return special marker
  if (finalPrice === 0) {
    return NextResponse.json({ free: true, keyId, amount: 0, currency: 'INR' })
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: finalPrice * 100,
      currency: 'INR',
      receipt: `job_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        flow: 'job',
        buyer_id: user.id,
        coupon: charge.couponCode ?? '',
      },
    }),
  })

  const order = await response.json()
  if (!response.ok) {
    console.error('[Razorpay job] Order creation failed:', order)
    return NextResponse.json({
      error: order.error?.description || `Razorpay HTTP ${response.status}`,
    }, { status: 500 })
  }

  await recordPaymentIntent({
    userId: user.id,
    flow: 'job',
    razorpayOrderId: order.id as string,
    amountPaise: finalPrice * 100,
    currency: 'INR',
    payload: {
      coupon: charge.couponCode ?? '',
      ...(body.payload ?? {}),
    },
  })

  return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId })
}
