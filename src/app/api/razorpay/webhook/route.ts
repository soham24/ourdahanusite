import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

import { getIntentByOrderId, markIntentCaptured } from '@/lib/payment-intents'

/**
 * Razorpay webhook entrypoint.
 *
 * Configure the URL in Razorpay dashboard:
 *   https://<your-domain>/api/razorpay/webhook
 *   Subscribe to: payment.captured, order.paid
 *   Set RAZORPAY_WEBHOOK_SECRET in env.
 *
 * Why this matters: if the user's browser dies after Razorpay charges
 * the card but before our server action runs, the webhook is the only
 * way the server learns the payment captured. We mark the intent as
 * 'captured' so the recovery API / admin tool can finalize it.
 *
 * We deliberately don't try to insert the entity here because some
 * flows (listings, jobs) need the form payload that lives in the
 * intent.payload jsonb anyway, and the recovery API handles that path
 * uniformly. Marking the intent captured here is enough to never lose
 * the payment.
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim()
  const signatureHeader = request.headers.get('x-razorpay-signature') ?? ''
  const rawBody = await request.text()

  if (!secret) {
    console.error('[razorpay webhook] RAZORPAY_WEBHOOK_SECRET not configured')
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 500 })
  }

  const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex')

  let signaturesMatch = false
  try {
    const sigBuf = Buffer.from(signatureHeader, 'utf8')
    const expBuf = Buffer.from(expectedSignature, 'utf8')
    signaturesMatch = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)
  } catch {
    signaturesMatch = false
  }

  if (!signaturesMatch) {
    console.error('[razorpay webhook] signature mismatch')
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
  }

  let payload: {
    event?: string
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; status?: string } }
      order?: { entity?: { id?: string; status?: string; amount_paid?: number } }
    }
  }

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const event = payload.event ?? ''
  const paymentEntity = payload.payload?.payment?.entity
  const orderEntity = payload.payload?.order?.entity

  // We care about the moment payment is captured at the gateway. Both
  // events carry the order id we recorded our intent under.
  if (event === 'payment.captured' || event === 'order.paid') {
    const orderId = paymentEntity?.order_id ?? orderEntity?.id ?? null
    const paymentId = paymentEntity?.id ?? null

    if (!orderId || !paymentId) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const intent = await getIntentByOrderId(orderId)
    if (!intent) {
      // Not one of ours (e.g. a marketplace order on a different env)
      return NextResponse.json({ ok: true, unknown_intent: true })
    }

    if (intent.status === 'finalized') {
      return NextResponse.json({ ok: true, already_finalized: true })
    }

    await markIntentCaptured({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: null,
    })

    return NextResponse.json({ ok: true, captured: true })
  }

  return NextResponse.json({ ok: true, ignored: true, event })
}
