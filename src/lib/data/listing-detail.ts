import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { createPublicClient } from '@/lib/supabase/public'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ListingRecord = Record<string, unknown>
type ReviewRecord = Record<string, unknown>
type QuestionRecord = Record<string, unknown>

interface SimilarListing {
  id: string
  name: string
  subdomain: string | null
  category: string
  image_url: string | null
  rating: number
}

export interface ListingDetailData {
  listing: ListingRecord
  reviews: ReviewRecord[]
  questions: QuestionRecord[]
  recommendCount: number
  favouriteCount: number
  similarListings: SimilarListing[]
}

export async function getCachedListingDetail(idOrSubdomain: string): Promise<ListingDetailData | null> {
  'use cache'

  cacheLife({ stale: 300, revalidate: 600, expire: 3600 })
  cacheTag(CACHE_TAGS.listings)

  try {
    const supabase = createPublicClient()
    const isUuid = UUID_REGEX.test(idOrSubdomain)
    const { data: listingData } = await supabase
      .from('listings')
      .select('*')
      .eq(isUuid ? 'id' : 'subdomain', idOrSubdomain)
      .single()

    if (!listingData) {
      return null
    }

    const listing = listingData as ListingRecord
    const listingId = String(listing.id)
    const listingCategory = typeof listing.category === 'string' ? listing.category : ''

    cacheTag(CACHE_TAGS.listing(listingId))

    const [
      reviewResult,
      questionResult,
      recCountResult,
      favCountResult,
      similarResult,
    ] = await Promise.all([
      supabase
        .from('reviews')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('listing_questions')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false }),
      supabase
        .from('listing_recommendations')
        .select('listing_id', { count: 'exact', head: true })
        .eq('listing_id', listingId),
      supabase
        .from('listing_favourites')
        .select('listing_id', { count: 'exact', head: true })
        .eq('listing_id', listingId),
      listingCategory
        ? supabase
            .from('listings')
            .select('id, name, subdomain, category, image_url, rating')
            .eq('category', listingCategory)
            .eq('approved', true)
            .neq('id', listingId)
            .limit(4)
        : Promise.resolve({ data: [] as SimilarListing[] }),
    ])

    const rawReviews = (reviewResult.data ?? []) as ReviewRecord[]
    let reviews = rawReviews

    if (rawReviews.length > 0) {
      const userIds = [...new Set(rawReviews.map((review) => review.user_id).filter(Boolean))]
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds as string[])

        const profileMap: Record<string, string> = {}
        for (const profile of (profileData ?? []) as Array<{ id: string; full_name: string | null }>) {
          if (profile.full_name) {
            profileMap[profile.id] = profile.full_name
          }
        }

        reviews = rawReviews.map((review) => ({
          ...review,
          reviewer_name: typeof review.user_id === 'string' ? (profileMap[review.user_id] ?? null) : null,
        }))
      }
    }

    return {
      listing,
      reviews,
      questions: (questionResult.data ?? []) as QuestionRecord[],
      recommendCount: recCountResult.count ?? 0,
      favouriteCount: favCountResult.count ?? 0,
      similarListings: (similarResult.data ?? []) as SimilarListing[],
    }
  } catch {
    return null
  }
}
