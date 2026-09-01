import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin-client'
import type { RedemptionRow } from '@/lib/coupon-reporting'

export type RedemptionDetail = {
  id: string
  coupon_code: string
  kind: 'new' | 'renewal'
  payment_status: 'paid' | 'free_coupon'
  amount_paid: number
  redeemed_at: string
  listing_id: string | null
  listing_name: string | null
}

/**
 * Every redemption, for aggregation. Deliberately not cached: this is an
 * admin-only report and must reflect a payment taken seconds ago.
 */
export async function fetchAllRedemptions(): Promise<RedemptionRow[]> {
  const db = createAdminClient()
  if (!db) return []

  const { data } = await db
    .from('coupon_redemptions')
    .select('coupon_code, coupon_id, kind, payment_status, amount_paid, redeemed_at')
    .order('redeemed_at', { ascending: false })

  return (data ?? []) as unknown as RedemptionRow[]
}

/** Drill-down: the individual redemptions of one coupon code. */
export async function fetchRedemptionsForCode(code: string): Promise<RedemptionDetail[]> {
  const db = createAdminClient()
  if (!db) return []

  const { data } = await db
    .from('coupon_redemptions')
    .select('id, coupon_code, kind, payment_status, amount_paid, redeemed_at, listing_id, listings(name)')
    .eq('coupon_code', code.trim().toLowerCase())
    .order('redeemed_at', { ascending: false })

  type Raw = Omit<RedemptionDetail, 'listing_name'> & {
    listings: { name: string } | { name: string }[] | null
  }

  return ((data ?? []) as unknown as Raw[]).map(({ listings, ...rest }) => ({
    ...rest,
    listing_name: Array.isArray(listings) ? (listings[0]?.name ?? null) : (listings?.name ?? null),
  }))
}
