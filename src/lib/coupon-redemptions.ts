import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin-client'

export type RecordCouponRedemptionInput = {
  couponCode: string
  userId: string
  listingId: string | null
  kind: 'new' | 'renewal'
  paymentStatus: 'paid' | 'free_coupon'
  amountPaid: number
  paymentId: string | null
}

/**
 * Append one row to the coupon redemption ledger.
 *
 * Call this ONLY after payment verification has passed and the listing row
 * is committed. The previous implementation incremented a counter when the
 * Razorpay order was created, so abandoned checkouts inflated the count.
 *
 * Uses the service-role client deliberately: coupon_redemptions has no
 * user-facing INSERT policy, so counts cannot be forged by a crafted request.
 *
 * Never throws. A ledger failure must not fail or roll back a paid
 * registration — under-counting is recoverable (listings.coupon_used still
 * holds the code), rejecting a paid signup is not.
 */
export async function recordCouponRedemption(
  input: RecordCouponRedemptionInput,
): Promise<void> {
  const code = input.couponCode.trim().toLowerCase()
  if (!code) return

  try {
    const db = createAdminClient()
    if (!db) {
      console.error('[coupon-redemption] admin client unavailable; not recorded', { code })
      return
    }

    // Resolve the current coupon id, if the coupon still exists. Nullable by
    // design: coupons are hard-deleted, and the code snapshot below is what
    // preserves the history.
    const { data: coupon } = await db
      .from('coupons')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    const { error } = await db.from('coupon_redemptions').insert({
      coupon_id: (coupon as { id?: string } | null)?.id ?? null,
      coupon_code: code,
      user_id: input.userId,
      listing_id: input.listingId,
      kind: input.kind,
      payment_status: input.paymentStatus,
      amount_paid: input.amountPaid,
      payment_id: input.paymentId,
    })

    // 23505 = unique violation on payment_id: this payment was already
    // recorded. That is the idempotency guard doing its job, not a failure.
    if (error && error.code !== '23505') {
      console.error('[coupon-redemption] insert failed', { code, error: error.message })
    }
  } catch (err) {
    console.error('[coupon-redemption] unexpected failure', err)
  }
}
