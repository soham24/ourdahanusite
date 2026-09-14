import type { JobStatus } from './rules'

export const POST_LIFETIME_DAYS = 30
export const RENEW_WINDOW_DAYS = 3
export const REMINDER_WINDOW_DAYS = 3

const DAY_MS = 86_400_000

export interface LifecyclePost {
  status: JobStatus
  expires_at: string | null
  reminder_sent_at?: string | null
}

/** Set on every approval, instant publish and renewal. */
export function publishWindow(now: Date): { published_at: string; expires_at: string } {
  return {
    published_at: now.toISOString(),
    expires_at: new Date(now.getTime() + POST_LIFETIME_DAYS * DAY_MS).toISOString(),
  }
}

export function isLive(post: LifecyclePost, now: Date): boolean {
  return post.status === 'approved' && post.expires_at !== null && Date.parse(post.expires_at) > now.getTime()
}

/**
 * Renew opens in the last 3 days before expiry and has no cut-off afterwards.
 * The window stops daily bumping; the missing cut-off means someone whose
 * profile lapsed long ago renews it instead of being blocked by the
 * one-profile rule.
 */
export function canRenew(post: LifecyclePost, now: Date): boolean {
  return (
    post.status === 'approved' &&
    post.expires_at !== null &&
    Date.parse(post.expires_at) - now.getTime() <= RENEW_WINDOW_DAYS * DAY_MS
  )
}

export function isReminderDue(post: LifecyclePost, now: Date): boolean {
  if (post.status !== 'approved' || post.expires_at === null || post.reminder_sent_at) return false
  const remaining = Date.parse(post.expires_at) - now.getTime()
  return remaining > 0 && remaining <= REMINDER_WINDOW_DAYS * DAY_MS
}

export function daysLeft(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now.getTime()) / DAY_MS))
}

export function hoursAgoIso(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString()
}
