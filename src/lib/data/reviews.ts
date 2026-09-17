import 'server-only'

import { createPublicClient } from '@/lib/supabase/public'

export type ReviewRecord = Record<string, unknown>

/**
 * Reviews returned per page, for the initial server render and for every
 * "load more" request alike.
 */
export const REVIEWS_PAGE_SIZE = 10

/**
 * Ordering must be identical everywhere reviews are paginated, and must be
 * total (no ties), or offset paging would skip or repeat rows at page
 * boundaries. created_at alone is not unique, so id breaks the tie.
 */
function orderReviews<T extends { order: (col: string, opts: { ascending: boolean }) => T }>(query: T): T {
  return query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
}

/**
 * Attach the reviewer's display name.
 *
 * reviews has no name column — it stores user_id, and the name lives on
 * profiles. This lookup is why review fetching cannot be a single query, and
 * why it lives here rather than being repeated at each call site: a page of
 * reviews fetched without it renders every reviewer as "Anonymous".
 */
async function attachReviewerNames(
  supabase: ReturnType<typeof createPublicClient>,
  rawReviews: ReviewRecord[],
): Promise<ReviewRecord[]> {
  if (rawReviews.length === 0) return rawReviews

  const userIds = [...new Set(rawReviews.map((review) => review.user_id).filter(Boolean))]
  if (userIds.length === 0) return rawReviews

  const { data: profileData } = await supabase
    .from('public_profiles')
    .select('id, full_name')
    .in('id', userIds as string[])

  const profileMap: Record<string, string> = {}
  for (const profile of (profileData ?? []) as Array<{ id: string; full_name: string | null }>) {
    if (profile.full_name) {
      profileMap[profile.id] = profile.full_name
    }
  }

  return rawReviews.map((review) => ({
    ...review,
    reviewer_name: typeof review.user_id === 'string' ? (profileMap[review.user_id] ?? null) : null,
  }))
}

/**
 * One page of a listing's reviews, newest first.
 *
 * `hasMore` is derived by asking for one row beyond the page and checking
 * whether it came back — not from listings.review_count, which is a
 * denormalised counter and is already known to drift (one listing in
 * production reports more reviews than it has).
 */
export async function fetchListingReviewsPage(
  listingId: string,
  offset = 0,
): Promise<{ reviews: ReviewRecord[]; hasMore: boolean }> {
  const supabase = createPublicClient()

  const { data } = await orderReviews(
    supabase
      .from('reviews')
      .select('id, listing_id, user_id, rating, comment, owner_reply, owner_replied_at, created_at')
      .eq('listing_id', listingId),
  ).range(offset, offset + REVIEWS_PAGE_SIZE)

  const rows = (data ?? []) as ReviewRecord[]
  const hasMore = rows.length > REVIEWS_PAGE_SIZE
  const reviews = await attachReviewerNames(supabase, rows.slice(0, REVIEWS_PAGE_SIZE))

  return { reviews, hasMore }
}

/** Exact number of reviews on a listing. */
export async function fetchListingReviewCount(listingId: string): Promise<number> {
  const supabase = createPublicClient()
  const { count } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)
  return count ?? 0
}
