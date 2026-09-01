/**
 * Pure aggregation over coupon redemption rows.
 *
 * No I/O and no `server-only` import: keeping this pure is what makes it
 * unit-testable, which matters because the write path itself cannot be
 * tested without a live Razorpay payment.
 */

export type RedemptionRow = {
  coupon_code: string
  coupon_id: string | null
  kind: 'new' | 'renewal'
  payment_status: 'paid' | 'free_coupon'
  amount_paid: number
  redeemed_at: string
}

export type CouponTotals = {
  code: string
  newCount: number
  renewalCount: number
  total: number
  revenue: number
}

export type PersonTotals = {
  person: string
  codes: string[]
  total: number
  revenue: number
}

/** Per-coupon totals, most-used first. */
export function summariseByCoupon(rows: RedemptionRow[]): CouponTotals[] {
  const byCode = new Map<string, CouponTotals>()

  for (const r of rows) {
    let entry = byCode.get(r.coupon_code)
    if (!entry) {
      entry = { code: r.coupon_code, newCount: 0, renewalCount: 0, total: 0, revenue: 0 }
      byCode.set(r.coupon_code, entry)
    }
    if (r.kind === 'renewal') entry.renewalCount += 1
    else entry.newCount += 1
    entry.total += 1
    // Free redemptions count toward total but contribute no revenue.
    entry.revenue += r.amount_paid
  }

  return [...byCode.values()].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code))
}

/**
 * Roll up by the person a coupon was assigned to.
 *
 * `assignedBy` maps coupon code -> assigned_to. A code with no entry, or a
 * null entry, falls back to the code itself so redemptions of deleted or
 * unassigned coupons still appear instead of vanishing from the report.
 */
export function summariseByPerson(
  rows: RedemptionRow[],
  assignedBy: Record<string, string | null>,
): PersonTotals[] {
  const byPerson = new Map<string, PersonTotals & { codeSet: Set<string> }>()

  for (const r of rows) {
    const person = assignedBy[r.coupon_code] || r.coupon_code
    let entry = byPerson.get(person)
    if (!entry) {
      entry = { person, codes: [], codeSet: new Set<string>(), total: 0, revenue: 0 }
      byPerson.set(person, entry)
    }
    entry.codeSet.add(r.coupon_code)
    entry.total += 1
    entry.revenue += r.amount_paid
  }

  return [...byPerson.values()]
    .map(({ codeSet, ...rest }) => ({ ...rest, codes: [...codeSet].sort() }))
    .sort((a, b) => b.total - a.total || a.person.localeCompare(b.person))
}
