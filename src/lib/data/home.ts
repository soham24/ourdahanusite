import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { CATALOG_ITEM_SELECT, toCatalogItem, type CatalogRow } from '@/lib/catalog/catalog'
import { latestPerBusiness } from '@/lib/catalog/recent'
import type { CatalogItem } from '@/lib/catalog/types'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import {
  buildCategoryGroups,
  type CategoryGroupSummary,
  type GroupThumbSource,
} from '@/lib/category-groups'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { sortCategoriesForDiscovery } from '@/lib/listing-category'
import { createPublicClient } from '@/lib/supabase/public'
import { fetchProfileNames } from '@/lib/data/profile-names'

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

export interface HomeProduct extends CatalogItem {
  listing_id: string
  listing_name: string
  listing_subdomain: string | null
  updated_at: string
}

export interface HomeStats {
  totalListings: number
  featuredListing: FeaturedListing | null
  categoryCounts: Record<string, number>
  topCategoryLabels: string[]
  categoryGroups: CategoryGroupSummary[]
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
    categoryGroups: [],
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

    // Thumbnails for the bento tiles. buildCategoryGroups re-sorts per group,
    // but ordering here too keeps the row cap meaningful rather than arbitrary.
    //
    // The `.limit(200)` below is a safety bound, not a real ceiling: the
    // directory has 64 approved listings today, so every listing is fetched.
    // If approved listings approach 200, a group whose listings are all
    // low-rated could fall outside this window and silently lose its
    // thumbnails. At that point, switch to a per-group select (e.g. top N
    // per category via a Postgres window function or separate queries)
    // instead of raising this number further.
    const { data: thumbData } = await supabase
      .from('listings')
      .select('id, name, category, image_thumb_url, image_url, rating, review_count')
      .eq('approved', true)
      .not('category', 'is', null)
      .order('rating', { ascending: false, nullsFirst: false })
      .order('review_count', { ascending: false })
      .order('id', { ascending: true })
      .limit(200)

    const categoryGroups = buildCategoryGroups(
      categoryCounts,
      (thumbData ?? []) as unknown as GroupThumbSource[],
    )

    return {
      totalListings: stats.total_listings ?? 0,
      featuredListing: stats.featured_listing ?? null,
      categoryCounts,
      topCategoryLabels,
      categoryGroups,
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
        id, listing_id, user_id, rating, comment, created_at,
        listings!reviews_listing_id_fkey(name, subdomain)
      `)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(60)

    if (!data) return []

    const nameById = await fetchProfileNames(supabase, data.map((row) => row.user_id))

    // Dedupe: keep first (most recent) review per listing_id
    const seen = new Set<string>()
    const result: HomeReview[] = []
    for (const r of data as Record<string, unknown>[]) {
      const lid = r.listing_id as string
      if (seen.has(lid)) continue
      seen.add(lid)
      const listing = r.listings as { name?: string; subdomain?: string | null } | null
      result.push({
        id: r.id as string,
        listing_id: lid,
        listing_name: listing?.name ?? 'Unknown listing',
        listing_subdomain: listing?.subdomain ?? null,
        rating: r.rating as number,
        comment: r.comment as string | null,
        reviewer_name: nameById.get(r.user_id as string) ?? null,
        created_at: r.created_at as string,
      })
      if (result.length === 5) break
    }
    return result
  } catch {
    return []
  }
}

/**
 * The 10 most recently updated catalog items, each from a different business.
 * Reads the latest 150 and keeps the newest per business, like the reviews
 * above. RLS already limits this to visible items on approved listings.
 */
export async function getHomeRecentProducts(): Promise<HomeProduct[]> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.home)
  cacheTag(CACHE_TAGS.listings)
  cacheTag(CACHE_TAGS.recentProducts)
  logCacheRegeneration({
    scope: 'home:recent-products',
    tags: [CACHE_TAGS.home, CACHE_TAGS.listings, CACHE_TAGS.recentProducts],
  })

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('listing_products')
      .select(`listing_id, updated_at, ${CATALOG_ITEM_SELECT}, listings!listing_products_listing_id_fkey(name, subdomain)`)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(150)

    type Row = CatalogRow & {
      listing_id: string
      updated_at: string
      listings: { name: string; subdomain: string | null } | null
    }
    return latestPerBusiness((data ?? []) as unknown as Row[], 10).map(({ listings, ...row }) => ({
      ...toCatalogItem(row),
      listing_name: listings?.name ?? '',
      listing_subdomain: listings?.subdomain ?? null,
    }))
  } catch {
    return []
  }
}
