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

export interface HomeJob {
  id: string
  title: string
  company: string
  location: string | null
  type: string
  salary: string | null
  category: string
  status: string
  created_at: string
}

export interface HomeStats {
  totalListings: number
  totalJobs: number
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
    totalJobs: 0,
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
      total_jobs?: number | null
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
      totalJobs: stats.total_jobs ?? 0,
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

/** Three most recent open/hiring jobs for the JobsSection list. */
export async function getHomeRecentJobs(): Promise<HomeJob[]> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.home)
  cacheTag(CACHE_TAGS.jobs)
  logCacheRegeneration({ scope: 'home:recent-jobs', tags: [CACHE_TAGS.home, CACHE_TAGS.jobs] })

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('jobs')
      .select('id, title, company, location, type, salary, category, status, created_at')
      .eq('approved', true)
      .in('status', ['open', 'hiring'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(3)
    return (data ?? []) as HomeJob[]
  } catch {
    return []
  }
}
