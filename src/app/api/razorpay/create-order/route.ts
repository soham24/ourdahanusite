import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

export async function POST() {
  // Must be logged in
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
    return NextResponse.json({ error: 'Payment gateway not configured. Please contact support.' }, { status: 500 })
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: 20000,       // ₹200 in paise
      currency: 'INR',
      receipt: `job_${user.id.slice(0, 8)}_${Date.now()}`,
    }),
  })

  const order = await response.json()

  if (!response.ok) {
    // Log full Razorpay error to Vercel logs for debugging
    console.error('[Razorpay] Order creation failed:', {
      status: response.status,
      body: JSON.stringify(order),
      keyIdPrefix: keyId?.slice(0, 12),
    })
    return NextResponse.json({
      error: order.error?.description || order.error?.code || `Razorpay HTTP ${response.status}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
  })
}
