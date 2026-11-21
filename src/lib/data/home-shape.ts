// Pure shaping for the homepage data. No server imports, so node:test can
// load it directly (see home-shape.test.ts).

export interface HomeReview {
  id: string
  listing_id: string
  listing_name: string
  listing_subdomain: string | null
  rating: number
  comment: string | null
  reviewer_name: string | null
  created_at: string
}

/** One row of the recent-reviews read, with its listing embedded. */
export interface HomeReviewRow {
  id: string
  listing_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  listings: { name?: string; subdomain?: string | null; owner_id?: string | null } | null
}

/** Shorter reviews ("Nice", "Good") are not featured on the home page. */
export const MIN_HOME_REVIEW_LENGTH = 40

/**
 * The newest review from each of up to `limit` different businesses, from
 * rows already ordered newest first. Only a handful are featured, so each
 * should say something: one-word reviews and owners reviewing their own
 * business stay on the listing.
 */
export function pickHomeReviews(
  rows: readonly HomeReviewRow[],
  nameById: ReadonlyMap<string, string>,
  limit = 6,
): HomeReview[] {
  const seen = new Set<string>()
  const result: HomeReview[] = []
  for (const r of rows) {
    if (result.length >= limit) break
    if (seen.has(r.listing_id)) continue
    const listing = r.listings
    if (String(r.comment ?? '').trim().length < MIN_HOME_REVIEW_LENGTH || r.user_id === listing?.owner_id) continue
    seen.add(r.listing_id)
    result.push({
      id: r.id,
      listing_id: r.listing_id,
      listing_name: listing?.name ?? 'Unknown listing',
      listing_subdomain: listing?.subdomain ?? null,
      rating: r.rating,
      comment: r.comment,
      reviewer_name: nameById.get(r.user_id) ?? null,
      created_at: r.created_at,
    })
  }
  return result
}
