import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { getCachedPricingConfig } from '@/lib/data/pricing'
import { sortCategoriesForDiscovery } from '@/lib/listing-category'
import { createPublicClient } from '@/lib/supabase/public'

export interface DirectoryListing {
  id: string
  name: string
  category: string
  subdomain?: string | null
  tagline?: string | null
  phone?: string | null
  address?: string | null
  rating?: number | null
  reviews?: number | null
  review_count?: number | null
  badge?: string | null
  icon?: string
  description?: string | null
  tags?: string[]
  image_url?: string | null
  image_thumb_url?: string | null
  plan?: string | null
  verified?: boolean | null
  updated_at?: string | null
  created_at?: string | null
}

export const PLAN_FEATURES = [
  'Your own profile page on OurDahanu',
  'Your unique subdomain (yourname.ourdahanu.in)',
  'Phone, address & website display',
  'Customer reviews',
  'Photos',
  'Reach 30,000+ local community members',
]

function buildCategoryCounts(rows: Array<{ category?: string | null }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const category = row.category?.trim()
    if (!category) continue
    counts[category] = (counts[category] || 0) + 1
  }
  return counts
}

export async function getListingCategories() {
  'use cache'

  cacheLife({ stale: 300, revalidate: 600, expire: 3600 })
  cacheTag(CACHE_TAGS.listings)
  cacheTag(CACHE_TAGS.listingCategories)

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('listings')
      .select('category')
      .eq('approved', true)

    const categoryCounts = buildCategoryCounts((data || []) as Array<{ category?: string | null }>)
    const categories = sortCategoriesForDiscovery(Object.entries(categoryCounts))
      .map(([category]) => category)

    return {
      categories,
      categoryCounts,
      sortedCategories: ['All', ...categories],
    }
  } catch {
    return {
      categories: [] as string[],
      categoryCounts: {} as Record<string, number>,
      sortedCategories: ['All'],
    }
  }
}

export async function getListingsDirectoryData(activeCategory: string | null = null) {
  'use cache'

  cacheLife({ stale: 300, revalidate: 600, expire: 3600 })
  cacheTag(CACHE_TAGS.listings)
  cacheTag(CACHE_TAGS.listingCategories)
  cacheTag(CACHE_TAGS.pricing)

  const [pricing, categoryData] = await Promise.all([
    getCachedPricingConfig().catch(() => ({ current_price: 210, base_price: 500 })),
    getListingCategories(),
  ])

  let listings: DirectoryListing[] = []

  try {
    const supabase = createPublicClient()
    let query = supabase
      .from('listings')
      .select('id, name, category, subdomain, phone, address, rating, review_count, image_url, image_thumb_url, tagline, description, plan, verified, updated_at, created_at')
      .eq('approved', true)
      .order('plan', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(48)

    if (activeCategory) {
      query = query.eq('category', activeCategory) as typeof query
    }

    const { data, error } = await query
    if (!error) {
      listings = (data || []) as DirectoryListing[]
    }
  } catch {
    listings = []
  }

  return {
    activeCategory,
    listings,
    sortedCategories: categoryData.sortedCategories,
    categoryCounts: categoryData.categoryCounts,
    categories: categoryData.categories,
    currentPrice: pricing.current_price,
    basePrice: pricing.base_price,
  }
}
