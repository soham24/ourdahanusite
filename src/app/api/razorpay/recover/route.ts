import { NextResponse } from 'next/server'

import {
  getIntentByOrderId,
  type PaymentIntentRow,
} from '@/lib/payment-intents'
import { fetchRazorpayOrder } from '@/lib/payment-security'
import { createClient } from '@/lib/supabase/server'

/**
 * Recovery surface for "I paid but the page never came back."
 *
 * Two modes:
 *  - GET: poll status of an intent we already know about (used by the
 *    /payments/recover/[orderId] page so the user can watch the
 *    finalize happen).
 *  - POST: ask the server to consult Razorpay and (if applicable)
 *    return the recovery payload that the client should re-submit
 *    via the original server action.
 *
 * The actual entity creation is intentionally driven by the client
 * resubmitting the original server action — that route already knows
 * how to validate the signature, decrement stock, and so on. The
 * recovery API just hands the client back the saved form payload so
 * a re-submit can complete with no user data entry.
 */

function intentStatusToHttp(intent: PaymentIntentRow) {
  return {
    orderId: intent.razorpay_order_id,
    paymentId: intent.razorpay_payment_id,
    flow: intent.flow,
    status: intent.status,
    entityId: intent.entity_id,
    entityTable: intent.entity_table,
    listingId: intent.listing_id,
    payload: intent.payload,
    lastError: intent.last_error,
    finalizedAt: intent.finalized_at,
    capturedAt: intent.captured_at,
    amountPaise: intent.amount_paise,
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('orderId')?.trim()
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId.' }, { status: 400 })
  }

  const intent = await getIntentByOrderId(orderId)
  if (!intent || intent.user_id !== user.id) {
    return NextResponse.json({ error: 'Intent not found.' }, { status: 404 })
  }

  return NextResponse.json(intentStatusToHttp(intent))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  }

  let orderId = ''
  try {
    const body = (await request.json()) as { orderId?: string }
    orderId = String(body.orderId ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId.' }, { status: 400 })
  }

  const intent = await getIntentByOrderId(orderId)
  if (!intent || intent.user_id !== user.id) {
    return NextResponse.json({ error: 'Intent not found.' }, { status: 404 })
  }

  if (intent.status === 'finalized') {
    return NextResponse.json({
      ...intentStatusToHttp(intent),
      message: 'Already finalized.',
    })
  }

  if (intent.status === 'cancelled') {
    return NextResponse.json({
      ...intentStatusToHttp(intent),
      message: 'Intent was cancelled — no payment was captured.',
    })
  }

  // Marketplace flow uses the listing-owner Razorpay account; the
  // platform key would 401. We can't look it up here, but the client
  // can still attempt the resubmit with the payment IDs it has, so
  // we return the payload regardless and let the action validate.
  if (intent.flow === 'marketplace') {
    return NextResponse.json(intentStatusToHttp(intent))
  }

  // For platform-key flows we double-check Razorpay status before
  // suggesting a retry, so we don't ask the user to fill out anything
  // for a payment that actually failed.
  const remoteOrder = await fetchRazorpayOrder(orderId)
  const remoteStatus = remoteOrder?.status ?? null
  const isPaid = remoteStatus === 'paid'

  return NextResponse.json({
    ...intentStatusToHttp(intent),
    razorpayStatus: remoteStatus,
    isPaid,
  })
}
