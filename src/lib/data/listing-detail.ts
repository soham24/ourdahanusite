import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { CATALOG_ITEM_SELECT, toCatalogItem, type CatalogRow } from '@/lib/catalog/catalog'
import type { CatalogItem } from '@/lib/catalog/types'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { deriveShopMode, type ShopMode } from '@/lib/selling/shop-mode'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createPublicClient } from '@/lib/supabase/public'
import {
  fetchListingReviewCount,
  fetchListingReviewsPage,
} from '@/lib/data/reviews'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type PaymentConfigSummary = { verified_at: string | null; razorpay_key_id: string }

export type ListingRecord = Record<string, unknown>
export type ReviewRecord = Record<string, unknown>
export type QuestionRecord = Record<string, unknown>

export interface SimilarListing {
  id: string
  name: string
  subdomain: string | null
  category: string
  image_url: string | null
  image_thumb_url: string | null
  rating: number | null
}

export type ListingProductPublic = CatalogItem

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
  /**
   * off: no online selling · test: only the owner may see and use the shop ·
   * live: everyone. Derived from approval, suspension and the key prefix.
   */
  shopMode: ShopMode
}

export async function getCachedListingDetail(idOrSubdomain: string): Promise<ListingDetailData | null> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)

  try {
    const supabase = createPublicClient()
    const isUuid = UUID_REGEX.test(idOrSubdomain)
    const { data: listingData } = await supabase
      .from('listings')
      // Keep the public detail payload deliberately narrow. The listings row
      // also contains moderation, payment and internal metadata that is not
      // rendered here; selecting it would increase Supabase transfer,
      // RSC serialization and the memory used by the Vercel function.
      .select([
        'id',
        'name',
        'subdomain',
        'category',
        'tagline',
        'description',
        'address',
        'phone',
        'whatsapp',
        'website',
        'facebook',
        'instagram',
        'map_url',
        'image_url',
        'image_thumb_url',
        'cover_image',
        'photos',
        'video_url',
        'tags',
        'highlights',
        'certifications',
        'payment_methods',
        'delivery_info',
        'before_after',
        'hours',
        'rating',
        'verified',
        'established_year',
        'response_time',
        'pinned_announcement',
        'upi_id',
        'appointment_settings',
        'appointments_enabled',
        'appointment_booking_fee',
        'approved',
        'payments_enabled',
        'payments_suspended_at',
      ].join(','))
      .eq(isUuid ? 'id' : 'subdomain', idOrSubdomain)
      .single()

    if (!listingData) {
      return null
    }

    // The suspension reason is written for the owner, not the public, and this
    // record is serialised to the browser — so it is dropped here.
    const listing: ListingRecord = { ...(listingData as unknown as ListingRecord) }
    delete listing.payments_suspended_reason
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
        .select('id, listing_id, user_id, question, answer, answered_at, created_at')
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
      // Every approved listing shows its catalog; shopMode decides Buy or WhatsApp.
      supabase
        .from('listing_products')
        .select(CATALOG_ITEM_SELECT)
        .eq('listing_id', listingId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
      // RLS on listing_payment_configs only permits the listing owner to
      // SELECT — there is no public/anon policy. Use the service-role admin
      // client so public visitors can resolve shopMode. The key ID is read
      // only to tell test keys from live keys; it never leaves this function.
      paymentsEnabled
        ? (() => {
            const adminClient = createAdminClient()
            if (!adminClient) {
              return Promise.resolve({ data: null as PaymentConfigSummary | null })
            }
            return adminClient
              .from('listing_payment_configs')
              .select('verified_at, razorpay_key_id')
              .eq('listing_id', listingId)
              .maybeSingle()
          })()
        : Promise.resolve({ data: null as PaymentConfigSummary | null }),
    ])

    // Reviews arrive already paged and name-enriched from the shared helper,
    // which the "load more" server action also uses — so page 1 and page N
    // cannot drift in ordering or in how reviewer names are resolved.
    const reviews = reviewPage.reviews

    const products: ListingProductPublic[] = ((productsResult.data ?? []) as unknown as CatalogRow[]).map(
      (row) => toCatalogItem(row),
    )
    const paymentConfig = (paymentConfigResult.data ?? null) as PaymentConfigSummary | null
    const shopMode = deriveShopMode({
      approved: listing.approved === true,
      paymentsEnabled,
      suspendedAt: typeof listing.payments_suspended_at === 'string' ? listing.payments_suspended_at : null,
      verifiedAt: paymentConfig?.verified_at ?? null,
      keyId: paymentConfig?.razorpay_key_id ?? null,
    })

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
      shopMode,
    }
  } catch {
    return null
  }
}
