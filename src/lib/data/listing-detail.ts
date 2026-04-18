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

export interface ListingProductPublic {
  id: string
  type: 'product' | 'service'
  name: string
  description: string | null
  price_paise: number
  quantity_in_stock: number | null
  image_url: string | null
  sort_order: number
}

export interface ListingDetailData {
  listing: ListingRecord
  reviews: ReviewRecord[]
  questions: QuestionRecord[]
  recommendCount: number
  favouriteCount: number
  similarListings: SimilarListing[]
  products: ListingProductPublic[]
  /** True only when both admin-enabled AND the owner's keys are verified. */
  marketplaceReady: boolean
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

    const paymentsEnabled = listing.payments_enabled === true

    const [
      reviewResult,
      questionResult,
      recCountResult,
      favCountResult,
      similarResult,
      productsResult,
      paymentConfigResult,
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
      paymentsEnabled
        ? supabase
            .from('listing_products')
            .select('id, type, name, description, price_paise, quantity_in_stock, image_url, sort_order')
            .eq('listing_id', listingId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] as ListingProductPublic[] }),
      paymentsEnabled
        ? supabase
            .from('listing_payment_configs')
            .select('verified_at')
            .eq('listing_id', listingId)
            .maybeSingle()
        : Promise.resolve({ data: null as { verified_at: string | null } | null }),
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

    const products = (productsResult.data ?? []) as ListingProductPublic[]
    const paymentConfig = (paymentConfigResult.data ?? null) as { verified_at: string | null } | null
    const marketplaceReady = paymentsEnabled && !!paymentConfig?.verified_at

    return {
      listing,
      reviews,
      questions: (questionResult.data ?? []) as QuestionRecord[],
      recommendCount: recCountResult.count ?? 0,
      favouriteCount: favCountResult.count ?? 0,
      similarListings: (similarResult.data ?? []) as SimilarListing[],
      products,
      marketplaceReady,
    }
  } catch {
    return null
  }
}
