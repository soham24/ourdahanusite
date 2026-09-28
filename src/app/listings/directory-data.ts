import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { getCachedPricingConfig } from '@/lib/data/pricing'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { sortCategoriesForDiscovery } from '@/lib/listing-category'
import { createPublicClient } from '@/lib/supabase/public'
import { siteConfig } from '@/lib/site'

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

// Upper bound on rows the directory renders in one pass. This is a safety cap
// against an unbounded query, not a page size — it must stay comfortably above
// the number of approved listings or businesses silently vanish from /listings
// with no error and no empty state. At 48 it was already below the live count
// and was hiding 16 paid listings. Revisit with real pagination (and
// server-side search, which today filters only over the rows sent here) when
// the directory approaches this number.
const DIRECTORY_LISTING_CAP = 200

export const PLAN_FEATURES = [
  `Your own profile page on ${siteConfig.name}`,
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

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.listings)
  cacheTag(CACHE_TAGS.listingCategories)
  logCacheRegeneration({
    scope: 'listings:categories',
    tags: [CACHE_TAGS.listings, CACHE_TAGS.listingCategories],
  })

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('listings')
      .select('category')
      .eq('approved', true)
      .order('category', { ascending: true })

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

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.listings)
  cacheTag(CACHE_TAGS.listingCategories)
  cacheTag(CACHE_TAGS.pricing)
  logCacheRegeneration({
    scope: 'listings:directory',
    tags: [CACHE_TAGS.listings, CACHE_TAGS.listingCategories, CACHE_TAGS.pricing],
    detail: { activeCategory },
  })

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
      .order('id', { ascending: true })
      .limit(DIRECTORY_LISTING_CAP)

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
