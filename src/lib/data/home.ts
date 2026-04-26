import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { getActivePoll, type PollWithResults } from '@/lib/data/polls'
import { getCachedPricingConfig } from '@/lib/data/pricing'
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

export async function getHomePageData() {
  'use cache'

  cacheLife({ stale: 300, revalidate: 600, expire: 3600 })
  cacheTag(CACHE_TAGS.home)
  cacheTag(CACHE_TAGS.listings)
  cacheTag(CACHE_TAGS.listingCategories)
  cacheTag(CACHE_TAGS.jobs)
  cacheTag(CACHE_TAGS.pricing)
  cacheTag(CACHE_TAGS.settings)
  cacheTag(CACHE_TAGS.polls)

  const pricing = await getCachedPricingConfig()

  let listings: HomeListing[] = []
  let newListings: HomeListing[] = []
  let topCategoryLabels: string[] = []
  let recentJobs: HomeJob[] = []
  let totalListings = 0
  let totalJobs = 0
  const categoryCounts: Record<string, number> = {}
  let featuredListing: FeaturedListing | null = null
  let activePoll: PollWithResults | null = null

  try {
    const supabase = createPublicClient()
    const [
      { data: listingData },
      { data: newListingData },
      { data: jobData },
      { data: statsData },
      activePollData,
    ] = await Promise.all([
      supabase
        .from('listings')
        .select('id, name, category, address, rating, review_count, image_url, image_thumb_url, tagline, subdomain, verified')
        .eq('approved', true)
        .order('verified', { ascending: false })
        .order('review_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(6),
      // Newest-first query, fetched separately so it doesn't get biased by
      // verified/review_count ordering. We overfetch to 12 so we have room
      // to dedupe against the "popular" listings above and still land a
      // full row on screen.
      supabase
        .from('listings')
        .select('id, name, category, address, rating, review_count, image_url, image_thumb_url, tagline, subdomain, verified')
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('jobs')
        .select('id, title, company, location, type, salary, category, status, created_at')
        .eq('approved', true)
        .in('status', ['open', 'hiring'])
        .order('created_at', { ascending: false })
        .limit(3),
      // Single RPC that replaces four separate queries: the full-scan
      // `select category where approved` (now a server-side GROUP BY), the
      // two `count: 'exact'` probes, and the `site_settings -> listings`
      // featured-listing lookup that used to run serially after the setting
      // row came back. See supabase/add_get_homepage_stats_rpc.sql.
      supabase.rpc('get_homepage_stats'),
      getActivePoll(),
    ])

    listings = (listingData ?? []) as HomeListing[]
    const popularIds = new Set(listings.map((l) => l.id))
    newListings = ((newListingData ?? []) as HomeListing[])
      .filter((l) => !popularIds.has(l.id))
      .slice(0, 6)
    recentJobs = (jobData ?? []) as HomeJob[]
    activePoll = activePollData

    const stats = (statsData ?? {}) as {
      category_counts?: Record<string, number> | null
      total_listings?: number | null
      total_jobs?: number | null
      featured_listing?: FeaturedListing | null
    }

    totalListings = stats.total_listings ?? 0
    totalJobs = stats.total_jobs ?? 0
    featuredListing = stats.featured_listing ?? null

    if (stats.category_counts) {
      for (const [category, count] of Object.entries(stats.category_counts)) {
        if (!category) continue
        categoryCounts[category] = count
      }

      if (Object.keys(categoryCounts).length) {
        topCategoryLabels = sortCategoriesForDiscovery(Object.entries(categoryCounts))
          .slice(0, 10)
          .map(([category]) => category)
      }
    }
  } catch {
    // Use empty-state fallbacks below if public reads fail.
  }

  if (!topCategoryLabels.length) {
    topCategoryLabels = [
      'Restaurants',
      'Medical Store',
      'Grocery & Shops',
      'Hotels & Stay',
      'Salons & Beauty',
      'Repair Services',
      'Education & Coaching',
      'Transport & Taxi',
    ]
  }

  return {
    listings,
    newListings,
    topCategoryLabels,
    categoryCounts,
    recentJobs,
    totalListings,
    totalJobs,
    pricing,
    featuredListing,
    activePoll,
  }
}
