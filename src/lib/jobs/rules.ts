import type { ReviewFlag } from './scam-signals'

export type JobStatus = 'pending' | 'approved' | 'rejected' | 'closed' | 'removed'

/**
 * A chosen business listing, as seen by the person posting:
 * `accessible` — they own it (or are staff); `approved` — it is live.
 */
export interface ListingAccess {
  accessible: boolean
  approved: boolean
}

export interface CreateContext {
  collectedByStaff: boolean
  listing: ListingAccess | null
  flags: ReviewFlag[]
}

/**
 * Instant or pending, decided by the server — never by the form.
 * Instant only for a staff-collected post, or for a post tied to a listing
 * the poster can act for that is currently approved and raised no flags.
 */
export function decideCreateStatus(ctx: CreateContext): 'approved' | 'pending' {
  if (ctx.collectedByStaff) return 'approved'
  const listing = ctx.listing
  if (listing !== null && listing.accessible && listing.approved && ctx.flags.length === 0) {
    return 'approved'
  }
  return 'pending'
}

export interface EditContext {
  current: JobStatus
  collectedByStaff: boolean
  listing: ListingAccess | null
  flags: ReviewFlag[]
}

/**
 * The status after an edit, or null when the post can no longer be edited.
 * An individual's approved post goes back to review, or a scammer could get a
 * harmless post approved and then edit it into a fee request.
 */
export function decideEditStatus(ctx: EditContext): 'approved' | 'pending' | null {
  if (ctx.current === 'closed' || ctx.current === 'removed') return null
  if (ctx.current !== 'approved') return 'pending'
  if (ctx.collectedByStaff) return 'approved'
  const listing = ctx.listing
  const businessStillApproved = listing !== null && listing.accessible && listing.approved
  return businessStillApproved && ctx.flags.length === 0 ? 'approved' : 'pending'
}

export const AUTO_HIDE_REPORTS = 3

/** Three reports since the post's last review hide an approved post. */
export function shouldAutoHide(status: JobStatus, reportsSinceReview: number): boolean {
  return status === 'approved' && reportsSinceReview >= AUTO_HIDE_REPORTS
}
