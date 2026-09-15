import type { User } from '@supabase/supabase-js'
import type { NotificationPayload } from '@/lib/notifications'

// Runtime imports are relative on purpose: a node:test file loads this module,
// and the test runner does not resolve the @/ alias.
import { canRenew, hoursAgoIso, isLive, publishWindow } from '../../lib/jobs/lifecycle'
import {
  decideCreateStatus,
  decideEditStatus,
  shouldAutoHide,
  type JobStatus,
  type ListingAccess,
} from '../../lib/jobs/rules'
import { detectPostFlags, type ReviewFlag } from '../../lib/jobs/scam-signals'
import {
  validateJobPostInput,
  type ContactFields,
  type JobKind,
  type JobPostInput,
} from '../../lib/jobs/validation'

export const DAILY_POST_LIMIT = 5
export const DAILY_REVEAL_LIMIT = 30

export const REPORT_REASONS = ['asks_for_money', 'fake', 'filled', 'offensive', 'my_number', 'other'] as const

export type ReportReason = (typeof REPORT_REASONS)[number]

export type DbError = { code?: string; message: string } | null

/** The columns the rules need, read with the service role. */
export interface StoredJobPost {
  id: string
  kind: JobKind
  status: JobStatus
  posted_by: string
  listing_id: string | null
  collected_source: string | null
  title: string
  expires_at: string | null
  reviewed_at: string | null
  review_flags: string[]
}

export interface JobActionDependencies {
  now(): Date
  getUser(): Promise<User | null>
  /** Admin or moderator. */
  isStaff(): Promise<boolean>
  /** Null when the listing does not exist. */
  checkListing(listingId: string): Promise<ListingAccess | null>
  countPostsSince(userId: string, since: string): Promise<number>
  /** Inserts the post and its contact together; never leaves a post without a number. */
  insertPost(row: Record<string, unknown>, contact: ContactFields): Promise<{ id: string | null; error: DbError }>
  getPost(postId: string): Promise<StoredJobPost | null>
  updatePost(postId: string, fields: Record<string, unknown>, contact?: ContactFields): Promise<{ error: DbError }>
  getContact(postId: string): Promise<ContactFields | null>
  hasRevealed(postId: string, userId: string): Promise<boolean>
  countRevealsSince(userId: string, since: string): Promise<number>
  recordReveal(postId: string, userId: string): Promise<{ error: DbError }>
  insertReport(row: { post_id: string; user_id: string; reason: ReportReason; note: string | null }): Promise<{ error: DbError }>
  /** Reports created after `since`, or every report when `since` is null. */
  countReportsSince(postId: string, since: string | null): Promise<number>
  /** Main-site login URL that returns to this jobs-relative path. */
  loginUrl(returnPath: string): Promise<string>
  notifyAdmins(payload: NotificationPayload<'admin.new_submission'>): void
  /** Refresh the cached public board. */
  revalidate(): void
}

export type CreatePostResult = { ok: true; id: string; status: 'approved' | 'pending' } | { error: string }
export type UpdatePostResult = { ok: true; status: 'approved' | 'pending' } | { error: string }
export type SimpleResult = { ok: true } | { error: string }
export type RevealResult = { ok: true; phone: string; whatsapp: boolean } | { loginUrl: string } | { error: string }
export type ReportResult = { ok: true } | { loginUrl: string } | { error: string }

const PROFILE_EXISTS = 'You already have a "Looking for work" profile. Edit or renew it from My posts.'
const SAVE_FAILED = 'Could not save your post. Please try again.'

function displayName(user: User): string | null {
  const fullName = user.user_metadata.full_name
  return typeof fullName === 'string' && fullName.trim() ? fullName.trim() : user.email ?? null
}

function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value)
}

/**
 * Side effects that run after a write has already succeeded. A failure is
 * logged, never thrown: the post is saved, so surfacing an error would tell
 * the user something false.
 */
function afterWrite(label: string, effect: () => void): void {
  try {
    effect()
  } catch (error) {
    console.error(`[jobs-core] ${label} failed`, error)
  }
}

export function createJobActions(deps: JobActionDependencies) {
  /** Null when no listing was chosen; 'forbidden' when the user cannot act for it. */
  async function listingFor(listingId: string | null): Promise<ListingAccess | null | 'forbidden'> {
    if (!listingId) return null
    const listing = await deps.checkListing(listingId)
    return listing && listing.accessible ? listing : 'forbidden'
  }

  async function createPost(input: JobPostInput): Promise<CreatePostResult> {
    const user = await deps.getUser()
    if (!user) return { error: 'Please log in to post.' }
    const staff = await deps.isStaff()
    const now = deps.now()

    if (!staff && (await deps.countPostsSince(user.id, hoursAgoIso(now, 24))) >= DAILY_POST_LIMIT) {
      return { error: `You can post ${DAILY_POST_LIMIT} times a day. Please try again tomorrow.` }
    }

    const result = validateJobPostInput(input)
    if (!result.ok) return { error: result.error }
    const { fields, contact } = result

    if (fields.collected_source !== null && !staff) {
      return { error: 'Only OurDahanu staff can post collected jobs.' }
    }
    const collectedByStaff = staff && fields.collected_source !== null

    const listing = await listingFor(fields.listing_id)
    if (listing === 'forbidden') return { error: 'You can only post for a business you own.' }

    // Staff-collected posts skip the scam check; everything else is scanned.
    const flags = collectedByStaff ? [] : detectPostFlags(fields)
    const status = decideCreateStatus({ collectedByStaff, listing, flags })

    const { id, error } = await deps.insertPost(
      {
        ...fields,
        status,
        posted_by: user.id,
        review_flags: flags,
        ...(status === 'approved' ? publishWindow(now) : {}),
        updated_at: now.toISOString(),
      },
      contact,
    )
    if (error) return { error: error.code === '23505' ? PROFILE_EXISTS : SAVE_FAILED }
    if (!id) return { error: SAVE_FAILED }

    // Pending posts need a reviewer; instant and collected posts are already
    // public, so they refresh the board instead.
    if (status === 'pending') {
      afterWrite('notifyAdmins', () =>
        deps.notifyAdmins({ kind: 'job', title: fields.title, submitterName: displayName(user), reviewPath: '/admin/jobs' }),
      )
    } else {
      afterWrite('revalidate', () => deps.revalidate())
    }
    return { ok: true, id, status }
  }

  async function updatePost(postId: string, input: JobPostInput): Promise<UpdatePostResult> {
    const user = await deps.getUser()
    if (!user) return { error: 'Please log in.' }
    const [post, staff] = await Promise.all([deps.getPost(postId), deps.isStaff()])
    if (!post || (post.posted_by !== user.id && !staff)) return { error: 'Post not found.' }

    // A post never changes kind, and only staff can set or change the
    // "collected" label.
    const result = validateJobPostInput({ ...input, kind: post.kind })
    if (!result.ok) return { error: result.error }
    const fields = {
      ...result.fields,
      collected_source: staff ? result.fields.collected_source : post.collected_source,
    }
    const collectedByStaff = staff && fields.collected_source !== null

    const listing = await listingFor(fields.listing_id)
    if (listing === 'forbidden') return { error: 'You can only post for a business you own.' }

    const detected: ReviewFlag[] = collectedByStaff ? [] : detectPostFlags(fields)
    // Editing re-scans free text for scam signals, but a report-driven hide
    // must survive an edit: otherwise a scammer clears it just by re-saving.
    const flags: ReviewFlag[] =
      post.review_flags.includes('reports') && !detected.includes('reports') ? [...detected, 'reports'] : detected
    const next = decideEditStatus({ current: post.status, collectedByStaff, listing, flags })
    if (next === null) return { error: 'This post is closed and can no longer be edited.' }

    const { error } = await deps.updatePost(
      postId,
      { ...fields, status: next, review_flags: flags, reject_reason: null, updated_at: deps.now().toISOString() },
      result.contact,
    )
    if (error) return { error: error.code === '23505' ? PROFILE_EXISTS : SAVE_FAILED }

    // Only tell reviewers when a post newly enters the queue, not on every
    // edit of a post that is already waiting.
    if (next === 'pending' && post.status !== 'pending') {
      afterWrite('notifyAdmins', () =>
        deps.notifyAdmins({ kind: 'job', title: fields.title, submitterName: displayName(user), reviewPath: '/admin/jobs' }),
      )
    }
    // A live post that went back to review must leave the board at once.
    afterWrite('revalidate', () => deps.revalidate())
    return { ok: true, status: next }
  }

  async function renewPost(postId: string): Promise<SimpleResult> {
    const user = await deps.getUser()
    if (!user) return { error: 'Please log in.' }
    const post = await deps.getPost(postId)
    if (!post || post.posted_by !== user.id) return { error: 'Post not found.' }

    const now = deps.now()
    if (!canRenew(post, now)) {
      return { error: 'You can renew a post in its last 3 days, or once it has expired.' }
    }
    const { error } = await deps.updatePost(postId, {
      ...publishWindow(now),
      reminder_sent_at: null,
      updated_at: now.toISOString(),
    })
    if (error) return { error: 'Could not renew your post. Please try again.' }
    afterWrite('revalidate', () => deps.revalidate())
    return { ok: true }
  }

  async function closePost(postId: string): Promise<SimpleResult> {
    const user = await deps.getUser()
    if (!user) return { error: 'Please log in.' }
    const [post, staff] = await Promise.all([deps.getPost(postId), deps.isStaff()])
    if (!post || (post.posted_by !== user.id && !staff)) return { error: 'Post not found.' }
    if (post.status === 'closed' || post.status === 'removed') return { error: 'This post is already closed.' }

    const { error } = await deps.updatePost(postId, { status: 'closed', updated_at: deps.now().toISOString() })
    if (error) return { error: 'Could not close your post. Please try again.' }
    afterWrite('revalidate', () => deps.revalidate())
    return { ok: true }
  }

  async function revealContact(postId: string): Promise<RevealResult> {
    const user = await deps.getUser()
    if (!user) return { loginUrl: await deps.loginUrl(`/j/${postId}`) }

    const [post, staff] = await Promise.all([deps.getPost(postId), deps.isStaff()])
    const now = deps.now()
    const own = post !== null && post.posted_by === user.id
    if (!post || (!isLive(post, now) && !own && !staff)) return { error: 'This post is no longer live.' }

    const contact = await deps.getContact(postId)
    if (!contact) return { error: 'The number for this post is not available.' }

    // Posters and staff are never counted. For everyone else a number already
    // revealed stays free; only a first reveal counts against the daily limit.
    if (!own && !staff && !(await deps.hasRevealed(postId, user.id))) {
      if ((await deps.countRevealsSince(user.id, hoursAgoIso(now, 24))) >= DAILY_REVEAL_LIMIT) {
        return {
          error: `You have viewed ${DAILY_REVEAL_LIMIT} numbers today — that is the daily limit. Please try again tomorrow.`,
        }
      }
      const { error } = await deps.recordReveal(postId, user.id)
      // 23505: another tab revealed it a moment ago — the number is theirs already.
      if (error && error.code !== '23505') return { error: 'Could not show the number. Please try again.' }
    }

    return { ok: true, phone: contact.phone, whatsapp: contact.whatsapp }
  }

  async function reportPost(postId: string, reason: string, note: string | null): Promise<ReportResult> {
    const user = await deps.getUser()
    if (!user) return { loginUrl: await deps.loginUrl(`/j/${postId}`) }
    if (!isReportReason(reason)) return { error: 'Choose a reason.' }

    const post = await deps.getPost(postId)
    if (!post) return { error: 'Post not found.' }
    if (post.posted_by === user.id) return { error: 'You cannot report your own post.' }

    const cleanNote = note?.trim().slice(0, 500) || null
    const { error } = await deps.insertReport({ post_id: postId, user_id: user.id, reason, note: cleanNote })
    if (error) {
      return { error: error.code === '23505' ? 'You have already reported this post.' : 'Could not send your report. Please try again.' }
    }

    // Hide first, notify second: a notification failure must never skip the
    // hide. Counted since the last review, so a post approved again after a
    // report hide needs three new reports to be hidden again. The poster is not
    // told: telling a scammer what tripped the hide teaches them to avoid it.
    const reports = await deps.countReportsSince(postId, post.reviewed_at)
    if (shouldAutoHide(post.status, reports)) {
      const reviewFlags = post.review_flags.includes('reports') ? post.review_flags : [...post.review_flags, 'reports']
      const { error: hideError } = await deps.updatePost(postId, {
        status: 'pending',
        review_flags: reviewFlags,
        updated_at: deps.now().toISOString(),
      })
      if (hideError) {
        // The report itself is saved and the admin is still notified below.
        console.error('[jobs-core] auto-hide after reports failed', hideError.message)
      } else {
        afterWrite('revalidate', () => deps.revalidate())
      }
    }

    afterWrite('notifyAdmins', () =>
      deps.notifyAdmins({
        kind: 'job_report',
        title: `${post.title} · ${reason}`,
        submitterName: displayName(user),
        reviewPath: '/admin/jobs',
      }),
    )
    return { ok: true }
  }

  return { createPost, updatePost, renewPost, closePost, revealContact, reportPost }
}
