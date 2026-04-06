import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
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
  tagline: string | null
  subdomain: string | null
  verified: boolean | null
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

  const pricing = await getCachedPricingConfig()

  let listings: HomeListing[] = []
  let topCategoryLabels: string[] = []
  let recentJobs: HomeJob[] = []
  let totalListings = 0
  let totalJobs = 0
  let categoryCounts: Record<string, number> = {}

  try {
    const supabase = createPublicClient()
    const [
      { data: listingData },
      { data: categoryRows },
      { data: jobData },
      listingCountResult,
      jobCountResult,
    ] = await Promise.all([
      supabase
        .from('listings')
        .select('id, name, category, address, rating, review_count, image_url, tagline, subdomain, verified')
        .eq('approved', true)
        .order('verified', { ascending: false })
        .order('review_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('listings')
        .select('category')
        .eq('approved', true),
      supabase
        .from('jobs')
        .select('id, title, company, location, type, salary, category, status, created_at')
        .eq('approved', true)
        .in('status', ['open', 'hiring'])
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('approved', true),
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('approved', true)
        .in('status', ['open', 'hiring']),
    ])

    listings = (listingData ?? []) as HomeListing[]
    recentJobs = (jobData ?? []) as HomeJob[]
    totalListings = listingCountResult.count ?? 0
    totalJobs = jobCountResult.count ?? 0

    const listingCategories = (categoryRows ?? []) as Array<{ category: string | null }>

    if (listingCategories.length) {
      for (const row of listingCategories) {
        if (!row.category) continue
        categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1
      }

      topCategoryLabels = sortCategoriesForDiscovery(Object.entries(categoryCounts))
        .slice(0, 10)
        .map(([category]) => category)
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
    topCategoryLabels,
    categoryCounts,
    recentJobs,
    totalListings,
    totalJobs,
    pricing,
  }
}
