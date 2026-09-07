'use server'

import {
  REVIEWS_PAGE_SIZE,
  fetchListingReviewsPage,
  type ReviewRecord,
} from '@/lib/data/reviews'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Upper bound on how deep "load more" will page.
 *
 * The busiest listing in production has 32 reviews. This cap exists so a
 * crafted offset cannot walk the table indefinitely, not because anyone is
 * expected to reach it.
 */
const MAX_OFFSET = 500

export type LoadMoreReviewsResult = {
  reviews: ReviewRecord[]
  hasMore: boolean
  error?: string
}

/**
 * Fetch the next page of a listing's reviews.
 *
 * Public and unauthenticated by design — reviews are world-readable
 * ("Reviews are public" RLS policy, USING true), and this only returns what
 * the listing page already shows. It goes through the same
 * fetchListingReviewsPage the server render uses, so ordering and reviewer
 * name resolution are identical to page 1.
 */
export async function loadMoreReviews(
  listingId: string,
  offset: number,
): Promise<LoadMoreReviewsResult> {
  if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) {
    return { reviews: [], hasMore: false, error: 'Could not load more reviews.' }
  }

  // Reject anything that is not a clean page boundary rather than clamping it:
  // a bad offset means the caller is out of step, and silently serving a
  // different slice than asked for would duplicate or skip reviews on screen.
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET || offset % REVIEWS_PAGE_SIZE !== 0) {
    return { reviews: [], hasMore: false, error: 'Could not load more reviews.' }
  }

  try {
    const { reviews, hasMore } = await fetchListingReviewsPage(listingId, offset)
    return { reviews, hasMore }
  } catch (err) {
    console.error('[reviews:load-more]', err)
    return { reviews: [], hasMore: false, error: 'Could not load more reviews.' }
  }
}
