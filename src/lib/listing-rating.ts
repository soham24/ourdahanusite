import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Recompute a listing's stored rating and review_count from its reviews.
 *
 * Both are denormalised onto listings because the directory sorts by them.
 * Every path that adds or removes a review must call this, or the stored
 * figures drift -- deleting a fake 1-star review used to leave it counted.
 * Needs a client allowed to update the listing (the service role).
 */
export async function recomputeListingRating(db: SupabaseClient, listingId: string): Promise<void> {
  const { data: reviews } = await db
    .from('reviews')
    .select('rating')
    .eq('listing_id', listingId)

  const ratings = ((reviews ?? []) as Array<{ rating: number }>).map((review) => review.rating)
  const average = ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0

  await db
    .from('listings')
    .update({ rating: Math.round(average * 10) / 10, review_count: ratings.length })
    .eq('id', listingId)
}
