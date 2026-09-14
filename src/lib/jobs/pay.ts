import type { PayPeriod } from './options'

function rupees(amount: number): string {
  return amount.toLocaleString('en-IN')
}

export function formatPay(p: { pay_min: number | null; pay_max: number | null; pay_period: PayPeriod | null }): string {
  const { pay_min: min, pay_max: max, pay_period: period } = p
  if (period === null || (min === null && max === null)) return 'Pay to be discussed'
  const per = ` / ${period}`
  if (min !== null && max !== null) {
    return min === max ? `₹${rupees(min)}${per}` : `₹${rupees(min)}–${rupees(max)}${per}`
  }
  if (min !== null) return `From ₹${rupees(min)}${per}`
  if (max !== null) return `Up to ₹${rupees(max)}${per}`
  return 'Pay to be discussed'
}
