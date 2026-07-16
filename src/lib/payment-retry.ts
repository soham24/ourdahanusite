'use client'

/**
 * Client-side payment robustness helpers.
 *
 * The fundamental risk: Razorpay charges the user before our server
 * action runs to create the listing/job/order. If the network drops,
 * the page navigates away, or the server action throws, the user is
 * left charged with no entity. This module:
 *
 *  1. Persists a recovery draft to localStorage as soon as we have a
 *     Razorpay order id, so the form data survives a page reload.
 *  2. Exposes attemptWithRetry() — exponential backoff, used to call
 *     the server action multiple times before giving up.
 *  3. Stores the payment IDs once Razorpay's handler fires so any
 *     subsequent recovery attempt has everything it needs.
 *  4. Lists pending drafts on app boot so a global watcher can offer
 *     the user a "finish your payment" prompt.
 */

const STORAGE_KEY = 'ourdahanu:payment-recovery-drafts/v1'
export const RECOVERY_PATH_PREFIX = '/payments/recover'

export type PaymentRecoveryFlow =
  | 'listing'
  | 'renew'
  | 'order'
  | 'marketplace'
  | 'appointment'

export interface PaymentRecoveryDraft {
  orderId: string
  flow: PaymentRecoveryFlow
  amountPaise: number
  /**
   * Form snapshot serialized as a flat object of string values. We
   * deliberately keep it primitive so it round-trips through JSON
   * cleanly and re-hydrates into a FormData on retry.
   */
  fields: Record<string, string>
  paymentId?: string
  signature?: string
  createdAt: number
  /** What URL the user was on when they started the flow. */
  returnTo?: string
  /** Last error string the user saw, useful for the recovery UI. */
  lastError?: string
  /** Bumped each time we surface this draft; lets us decay noisy ones. */
  attempts: number
}

function readDrafts(): Record<string, PaymentRecoveryDraft> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, PaymentRecoveryDraft>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

/** Fired whenever the recovery-draft set changes, so the in-page watcher can
 *  re-scan immediately instead of waiting for its 30s poll. Without this, the
 *  recovery banner lingers on screen for up to 30s after a payment succeeds and
 *  the draft is cleared. */
export const RECOVERY_DRAFTS_CHANGED_EVENT = 'ourdahanu:recovery-drafts-changed'

function writeDrafts(drafts: Record<string, PaymentRecoveryDraft>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
    window.dispatchEvent(new CustomEvent(RECOVERY_DRAFTS_CHANGED_EVENT))
  } catch {
    // localStorage full / disabled — best effort only.
  }
}

/**
 * Take a snapshot of a FormData into a flat record. Skips File entries
 * (uploaded photos already have hosted URLs in the form values, so the
 * File objects themselves are not needed for retry).
 */
export function snapshotFormData(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      out[key] = value
    }
  })
  return out
}

export function buildFormDataFromSnapshot(
  fields: Record<string, string>,
): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value)
  }
  return fd
}

export function persistRecoveryDraft(
  draft: Omit<PaymentRecoveryDraft, 'createdAt' | 'attempts'> & {
    createdAt?: number
    attempts?: number
  },
): void {
  const drafts = readDrafts()
  drafts[draft.orderId] = {
    ...draft,
    createdAt: draft.createdAt ?? Date.now(),
    attempts: draft.attempts ?? 0,
  }
  writeDrafts(drafts)
}

export function updateRecoveryDraft(
  orderId: string,
  patch: Partial<PaymentRecoveryDraft>,
): void {
  const drafts = readDrafts()
  const existing = drafts[orderId]
  if (!existing) return
  drafts[orderId] = { ...existing, ...patch }
  writeDrafts(drafts)
}

export function getRecoveryDraft(orderId: string): PaymentRecoveryDraft | null {
  return readDrafts()[orderId] ?? null
}

export function clearRecoveryDraft(orderId: string): void {
  const drafts = readDrafts()
  if (orderId in drafts) {
    delete drafts[orderId]
    writeDrafts(drafts)
  }
}

export function listRecoveryDrafts(): PaymentRecoveryDraft[] {
  const drafts = Object.values(readDrafts())
  // Drop drafts older than 7 days — Razorpay refunds happen within 5
  // business days, so anything older is stale and would confuse the
  // user more than it helps.
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const fresh = drafts.filter((d) => now - d.createdAt < sevenDays)
  if (fresh.length !== drafts.length) {
    const map: Record<string, PaymentRecoveryDraft> = {}
    for (const d of fresh) map[d.orderId] = d
    writeDrafts(map)
  }
  return fresh.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Drafts where Razorpay's handler fired (we have a paymentId) but the
 * server action never confirmed success. These are the most urgent —
 * money has likely left the user's account.
 */
export function listCapturedRecoveryDrafts(): PaymentRecoveryDraft[] {
  return listRecoveryDrafts().filter((d) => Boolean(d.paymentId))
}

export interface RetryOptions {
  attempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  /** Predicate: if it returns true, stop retrying — error is permanent. */
  isPermanent?: (error: unknown) => boolean
  onAttempt?: (attempt: number, error: unknown) => void
}

const DEFAULT_OPTS: Required<Pick<RetryOptions, 'attempts' | 'baseDelayMs' | 'maxDelayMs'>> = {
  attempts: 4,
  baseDelayMs: 700,
  maxDelayMs: 4000,
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Run an async fn that returns `{ error?: string }` (the server-action
 * shape used throughout the app). Retries on:
 *   - thrown errors
 *   - results whose `error` mentions network / fetch / 502/503/504
 *
 * Stops immediately on validation-style errors (signature mismatch,
 * missing fields, etc.) because those won't get better with retries.
 */
export async function attemptWithRetry<T extends { error?: string }>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTS, ...options }
  let lastResult: T | null = null
  let lastThrown: unknown = null

  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      const result = await fn()
      lastResult = result

      if (!result.error) return result

      if (isPermanentClientError(result.error) || options.isPermanent?.(result.error)) {
        return result
      }

      options.onAttempt?.(attempt, result.error)
    } catch (err) {
      lastThrown = err
      if (options.isPermanent?.(err)) {
        throw err
      }
      options.onAttempt?.(attempt, err)
    }

    if (attempt < opts.attempts) {
      const wait = Math.min(
        opts.maxDelayMs,
        opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200),
      )
      await delay(wait)
    }
  }

  if (lastResult) return lastResult
  if (lastThrown) throw lastThrown
  return { error: 'Submission failed.' } as T
}

function isPermanentClientError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('payment verification failed') ||
    m.includes('signature') ||
    m.includes('coupon') ||
    m.includes('subdomain') ||
    m.includes('please sign in') ||
    m.includes('sign in') ||
    m.includes('required') ||
    m.includes('invalid') ||
    m.includes('access denied')
  )
}

/**
 * Convenience: navigate the user to the recovery page for an orderId.
 * The page can resume the submission once it loads.
 */
export function recoveryUrlFor(orderId: string): string {
  return `${RECOVERY_PATH_PREFIX}/${encodeURIComponent(orderId)}`
}
