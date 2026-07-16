import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin-client'

export type PaymentIntentFlow =
  | 'listing'
  | 'renew'
  | 'order'
  | 'marketplace'
  | 'appointment'

export type PaymentIntentStatus =
  | 'created'
  | 'captured'
  | 'finalized'
  | 'failed'
  | 'cancelled'

export interface PaymentIntentRow {
  id: string
  user_id: string
  flow: PaymentIntentFlow
  razorpay_order_id: string
  razorpay_payment_id: string | null
  razorpay_signature: string | null
  amount_paise: number
  currency: string
  payload: Record<string, unknown>
  listing_id: string | null
  status: PaymentIntentStatus
  entity_id: string | null
  entity_table: string | null
  last_error: string | null
  retry_count: number
  created_at: string
  updated_at: string
  captured_at: string | null
  finalized_at: string | null
}

/**
 * Record a payment intent at the moment we create a Razorpay order.
 * If the user closes the browser after paying we still have everything
 * we need (payload + flow + amount + listing_id) to recreate the entity.
 *
 * Failures here are logged but never block the order creation — we'd
 * rather risk a non-recoverable intent than refuse to take the payment.
 */
export async function recordPaymentIntent(args: {
  userId: string
  flow: PaymentIntentFlow
  razorpayOrderId: string
  amountPaise: number
  currency?: string
  payload: Record<string, unknown>
  listingId?: string | null
}): Promise<void> {
  const adminClient = createAdminClient()
  if (!adminClient) {
    console.error('[paymentIntents] No admin client; skipping intent record')
    return
  }

  const { error } = await adminClient.from('payment_intents').insert({
    user_id: args.userId,
    flow: args.flow,
    razorpay_order_id: args.razorpayOrderId,
    amount_paise: args.amountPaise,
    currency: args.currency ?? 'INR',
    payload: args.payload,
    listing_id: args.listingId ?? null,
    status: 'created',
  })

  if (error) {
    console.error('[paymentIntents] Failed to record intent', {
      orderId: args.razorpayOrderId,
      flow: args.flow,
      error,
    })
  }
}

/**
 * Look up an intent by Razorpay order id (the only id we can guarantee
 * exists from the moment the user is sent to checkout).
 */
export async function getIntentByOrderId(
  razorpayOrderId: string,
): Promise<PaymentIntentRow | null> {
  const adminClient = createAdminClient()
  if (!adminClient) return null
  const { data } = await adminClient
    .from('payment_intents')
    .select('id, user_id, flow, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount_paise, currency, payload, listing_id, status, entity_id, entity_table, last_error, retry_count, created_at, updated_at, captured_at, finalized_at')
    .eq('razorpay_order_id', razorpayOrderId)
    .maybeSingle()
  return (data ?? null) as PaymentIntentRow | null
}

/**
 * If the payment id was already used to finalize an entity, return that
 * entity. Used for idempotent finalize: a retried call returns the same
 * entity_id instead of creating a duplicate listing/job/order.
 */
export async function findFinalizedIntentByPaymentId(
  razorpayPaymentId: string,
): Promise<PaymentIntentRow | null> {
  if (!razorpayPaymentId) return null
  const adminClient = createAdminClient()
  if (!adminClient) return null
  const { data } = await adminClient
    .from('payment_intents')
    .select('id, user_id, flow, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount_paise, currency, payload, listing_id, status, entity_id, entity_table, last_error, retry_count, created_at, updated_at, captured_at, finalized_at')
    .eq('razorpay_payment_id', razorpayPaymentId)
    .eq('status', 'finalized')
    .maybeSingle()
  return (data ?? null) as PaymentIntentRow | null
}

/**
 * Mark the intent as 'captured' — payment confirmed at Razorpay but
 * the local entity is not yet created. Safe to call multiple times.
 */
export async function markIntentCaptured(args: {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature?: string | null
}): Promise<void> {
  const adminClient = createAdminClient()
  if (!adminClient) return
  await adminClient
    .from('payment_intents')
    .update({
      razorpay_payment_id: args.razorpayPaymentId,
      razorpay_signature: args.razorpaySignature ?? null,
      status: 'captured',
      captured_at: new Date().toISOString(),
    })
    .eq('razorpay_order_id', args.razorpayOrderId)
    .in('status', ['created', 'captured'])
}

/**
 * Mark the intent finalized: the entity (listing/job/order/...) is now
 * live in the database. This is the success terminal state.
 */
export async function markIntentFinalized(args: {
  razorpayOrderId: string
  entityId: string
  entityTable: string
}): Promise<void> {
  const adminClient = createAdminClient()
  if (!adminClient) return
  await adminClient
    .from('payment_intents')
    .update({
      status: 'finalized',
      entity_id: args.entityId,
      entity_table: args.entityTable,
      finalized_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('razorpay_order_id', args.razorpayOrderId)
}

/**
 * Record a failure attempt without losing the intent — the recovery
 * API + admin page can retry later.
 */
export async function recordIntentError(args: {
  razorpayOrderId: string
  message: string
}): Promise<void> {
  const adminClient = createAdminClient()
  if (!adminClient) return
  const { data } = await adminClient
    .from('payment_intents')
    .select('retry_count')
    .eq('razorpay_order_id', args.razorpayOrderId)
    .maybeSingle()

  const nextRetryCount = ((data?.retry_count as number | undefined) ?? 0) + 1

  await adminClient
    .from('payment_intents')
    .update({
      last_error: args.message.slice(0, 500),
      retry_count: nextRetryCount,
    })
    .eq('razorpay_order_id', args.razorpayOrderId)
}
