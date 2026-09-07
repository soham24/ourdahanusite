import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createPublicClient } from '@/lib/supabase/public'
import {
  fetchListingReviewCount,
  fetchListingReviewsPage,
} from '@/lib/data/reviews'

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
  image_thumb_url: string | null
  rating: number | null
}

export interface ListingProductPublic {
  id: string
  type: 'product' | 'service'
  name: string
  description: string | null
  price_paise: number
  quantity_in_stock: number | null
  image_url: string | null
  image_thumb_url: string | null
  sort_order: number
}

export interface ListingDetailData {
  listing: ListingRecord
  reviews: ReviewRecord[]
  /** Exact total, not listings.review_count (which drifts). */
  reviewCount: number
  hasMoreReviews: boolean
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

  cacheLife(PUBLIC_CONTENT_CACHE)

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
    logCacheRegeneration({
      scope: 'listing:detail',
      tags: [CACHE_TAGS.listing(listingId)],
      detail: { listingId },
    })

    const paymentsEnabled = listing.payments_enabled === true

    const [
      reviewPage,
      reviewTotal,
      questionResult,
      recCountResult,
      favCountResult,
      similarResult,
      productsResult,
      paymentConfigResult,
    ] = await Promise.all([
      fetchListingReviewsPage(listingId, 0),
      fetchListingReviewCount(listingId),
      supabase
        .from('listing_questions')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }),
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
            .select('id, name, subdomain, category, image_url, image_thumb_url, rating')
            .eq('category', listingCategory)
            .eq('approved', true)
            .neq('id', listingId)
            .order('rating', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .limit(4)
        : Promise.resolve({ data: [] as SimilarListing[] }),
      paymentsEnabled
        ? supabase
            .from('listing_products')
            .select('id, type, name, description, price_paise, quantity_in_stock, image_url, image_thumb_url, sort_order')
            .eq('listing_id', listingId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
        : Promise.resolve({ data: [] as ListingProductPublic[] }),
      // RLS on listing_payment_configs only permits the listing owner to
      // SELECT — there is no public/anon policy. Use the service-role admin
      // client so public visitors can resolve marketplaceReady. We only read
      // the verified_at timestamp (no secrets like key_id/key_secret).
      paymentsEnabled
        ? (() => {
            const adminClient = createAdminClient()
            if (!adminClient) {
              return Promise.resolve({ data: null as { verified_at: string | null } | null })
            }
            return adminClient
              .from('listing_payment_configs')
              .select('verified_at')
              .eq('listing_id', listingId)
              .maybeSingle()
          })()
        : Promise.resolve({ data: null as { verified_at: string | null } | null }),
    ])

    // Reviews arrive already paged and name-enriched from the shared helper,
    // which the "load more" server action also uses — so page 1 and page N
    // cannot drift in ordering or in how reviewer names are resolved.
    const reviews = reviewPage.reviews

    const products = (productsResult.data ?? []) as ListingProductPublic[]
    const paymentConfig = (paymentConfigResult.data ?? null) as { verified_at: string | null } | null
    const marketplaceReady = paymentsEnabled && !!paymentConfig?.verified_at

    return {
      listing,
      reviews,
      reviewCount: reviewTotal,
      hasMoreReviews: reviewPage.hasMore,
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
