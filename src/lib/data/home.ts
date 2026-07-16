import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { sortCategoriesForDiscovery } from '@/lib/listing-category'
import { createPublicClient } from '@/lib/supabase/public'

export interface HomeListing {
  id: string
  name: string
  category: string
  address: string | null
  rating: number | null
  review_count: number | null
  image_url: string | null
  image_thumb_url: string | null
  tagline: string | null
  subdomain: string | null
  verified: boolean | null
}

export interface FeaturedListing {
  id: string
  name: string
  category: string
  address: string | null
  rating: number | null
  review_count: number | null
  image_url: string | null
  image_thumb_url: string | null
  tagline: string | null
  subdomain: string | null
  verified: boolean | null
  phone: string | null
}

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

export interface HomeStats {
  totalListings: number
  featuredListing: FeaturedListing | null
  categoryCounts: Record<string, number>
  topCategoryLabels: string[]
}

const FALLBACK_TOP_CATEGORIES = [
  'Restaurants',
  'Medical Store',
  'Grocery & Shops',
  'Hotels & Stay',
  'Salons & Beauty',
  'Repair Services',
  'Education & Coaching',
  'Transport & Taxi',
]

const HOME_LISTING_COLUMNS =
  'id, name, category, address, rating, review_count, image_url, image_thumb_url, tagline, subdomain, verified'

// ─── Granular cached fetchers ──────────────────────────────────────────────
//
// Each section of the homepage suspends on its own slice of data so the
// page can stream into view as data lands. The hero + quick categories
// don't fetch anything and render synchronously, then these fetchers
// resolve independently and fill in the rest of the page.

/**
 * Stats for the StatsBar, FeaturedSpotlight and CategoryGrid sections.
 * One RPC call returns every count we need plus the featured listing,
 * so these three sections share a fetcher and stream in together.
 */
export async function getHomeStats(): Promise<HomeStats> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.home)
  cacheTag(CACHE_TAGS.listings)
  cacheTag(CACHE_TAGS.listingCategories)
  cacheTag(CACHE_TAGS.settings)
  logCacheRegeneration({
    scope: 'home:stats',
    tags: [CACHE_TAGS.home, CACHE_TAGS.listings, CACHE_TAGS.listingCategories, CACHE_TAGS.settings],
  })

  const empty: HomeStats = {
    totalListings: 0,
    featuredListing: null,
    categoryCounts: {},
    topCategoryLabels: FALLBACK_TOP_CATEGORIES,
  }

  try {
    const supabase = createPublicClient()
    const { data: statsData } = await supabase.rpc('get_homepage_stats')

    const stats = (statsData ?? {}) as {
      category_counts?: Record<string, number> | null
      total_listings?: number | null
      featured_listing?: FeaturedListing | null
    }

    const categoryCounts: Record<string, number> = {}
    if (stats.category_counts) {
      for (const [category, count] of Object.entries(stats.category_counts)) {
        if (!category) continue
        categoryCounts[category] = count
      }
    }

    const topCategoryLabels = Object.keys(categoryCounts).length
      ? sortCategoriesForDiscovery(Object.entries(categoryCounts))
          .slice(0, 10)
          .map(([category]) => category)
      : FALLBACK_TOP_CATEGORIES

    return {
      totalListings: stats.total_listings ?? 0,
      featuredListing: stats.featured_listing ?? null,
      categoryCounts,
      topCategoryLabels,
    }
  } catch {
    return empty
  }
}

/** Top 6 popular listings for the PopularBusinesses carousel. */
export async function getHomePopularListings(): Promise<HomeListing[]> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.home)
  cacheTag(CACHE_TAGS.listings)
  logCacheRegeneration({ scope: 'home:popular-listings', tags: [CACHE_TAGS.home, CACHE_TAGS.listings] })

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('listings')
      .select(HOME_LISTING_COLUMNS)
      .eq('approved', true)
      .order('verified', { ascending: false })
      .order('review_count', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(6)
    return (data ?? []) as HomeListing[]
  } catch {
    return []
  }
}

/** Newest 6 listings for the NewListingsSection carousel. */
export async function getHomeNewListings(): Promise<HomeListing[]> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.home)
  cacheTag(CACHE_TAGS.listings)
  logCacheRegeneration({ scope: 'home:new-listings', tags: [CACHE_TAGS.home, CACHE_TAGS.listings] })

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('listings')
      .select(HOME_LISTING_COLUMNS)
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(6)
    return (data ?? []) as HomeListing[]
  } catch {
    return []
  }
}

/**
 * 5 most recent reviews each from a different listing.
 * Fetches the latest 60 reviews then dedupes by listing_id in JS,
 * keeping the single most-recent review per listing, up to 5 results.
 */
export async function getHomeRecentReviews(): Promise<HomeReview[]> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.home)
  cacheTag(CACHE_TAGS.listings)
  logCacheRegeneration({ scope: 'home:recent-reviews', tags: [CACHE_TAGS.home, CACHE_TAGS.listings] })

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('reviews')
      .select(`
        id, listing_id, rating, comment, created_at,
        profiles!reviews_user_id_fkey(full_name),
        listings!reviews_listing_id_fkey(name, subdomain)
      `)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(60)

    if (!data) return []

    // Dedupe: keep first (most recent) review per listing_id
    const seen = new Set<string>()
    const result: HomeReview[] = []
    for (const r of data as Record<string, unknown>[]) {
      const lid = r.listing_id as string
      if (seen.has(lid)) continue
      seen.add(lid)
      const listing = r.listings as { name?: string; subdomain?: string | null } | null
      const profile = r.profiles as { full_name?: string | null } | null
      result.push({
        id: r.id as string,
        listing_id: lid,
        listing_name: listing?.name ?? 'Unknown listing',
        listing_subdomain: listing?.subdomain ?? null,
        rating: r.rating as number,
        comment: r.comment as string | null,
        reviewer_name: profile?.full_name ?? null,
        created_at: r.created_at as string,
      })
      if (result.length === 5) break
    }
    return result
  } catch {
    return []
  }
}

