/**
 * Razorpay Key IDs carry their mode in the prefix: rzp_test_… keys only move
 * practice money, rzp_live_… keys move real money. The prefix is the single
 * source of truth for test vs live — owners are never asked to tick a box.
 */
export type RazorpayKeyKind = 'empty' | 'invalid' | 'test' | 'live'

export const KEY_ID_INVALID_MESSAGE =
  "That Key ID doesn't look right. It starts with rzp_test_ or rzp_live_."

export const KEYS_REJECTED_MESSAGE =
  "Razorpay didn't accept these keys. The secret is only shown once, so generate a new key and paste both again."

export const RAZORPAY_UNREACHABLE_MESSAGE =
  "We couldn't reach Razorpay just now. Your keys weren't saved. Please try again."

export function classifyRazorpayKeyId(raw: string | null | undefined): RazorpayKeyKind {
  const value = (raw ?? '').trim()
  if (!value) return 'empty'
  if (/^rzp_test_[A-Za-z0-9]+$/.test(value)) return 'test'
  if (/^rzp_live_[A-Za-z0-9]+$/.test(value)) return 'live'
  return 'invalid'
}

/** Owner-facing message for a failed key check; `null` means no HTTP answer. */
export function verifyFailureMessage(status: number | null): string {
  return status === 401 ? KEYS_REJECTED_MESSAGE : RAZORPAY_UNREACHABLE_MESSAGE
}
