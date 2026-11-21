import 'server-only'

import { cache } from 'react'
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
import { readOrThrow } from '@/lib/data/read'
import { fetchProfileNames } from '@/lib/data/profile-names'
import { pickHomeReviews, type HomeReview, type HomeReviewRow } from '@/lib/data/home-shape'

export type { HomeReview }

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

export interface HomeHeroPhoto {
  id: string
  name: string
  category: string
  subdomain: string | null
  imageUrl: string
}

export interface HomeHeroData {
  photos: HomeHeroPhoto[]
  counts: { businesses: number; reviews: number; items: number; professionals: number }
}

/** Everything public on the homepage (and the hero numbers /about reuses). */
export interface HomeBundle {
  stats: HomeStats
  popular: HomeListing[]
  newest: HomeListing[]
  reviews: HomeReview[]
  products: HomeProduct[]
  hero: HomeHeroData
}

type PublicClient = ReturnType<typeof createPublicClient>

// ─── One shared, cached bundle ──────────────────────────────────────────────
//
// Every homepage read lives in one `'use cache: remote'` entry. Plain
// `'use cache'` keeps its output in a per-instance in-memory store, which on
// Vercel's serverless functions is usually empty: each request that rendered
// these sections at runtime (crawlers, which skip the static shell; client
// navigations; renders after a tag was invalidated) ran every query again --
// `get_homepage_stats()` was called ~1,500 times in a day. The remote handler
// (Vercel's Runtime Cache; in-memory when self-hosted) is shared by every
// instance, so the database sees one set of reads per refresh, not one per
// instance. Bundling makes that a single cache lookup per render rather than
// six.
//
// Freshness is unchanged: PUBLIC_CONTENT_CACHE, refreshed at once by the tag
// helpers in cache-tags.ts when admins or owners change listings, reviews,
// catalog items, settings or the find directory.

const HOME_BUNDLE_TAGS = [
  CACHE_TAGS.home,
  CACHE_TAGS.listings,
  CACHE_TAGS.listingCategories,
  CACHE_TAGS.settings,
  CACHE_TAGS.recentProducts,
  CACHE_TAGS.find,
]

async function loadHomeBundle(): Promise<HomeBundle> {
  'use cache: remote'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(...HOME_BUNDLE_TAGS)
  logCacheRegeneration({ scope: 'home:bundle', tags: HOME_BUNDLE_TAGS })

  const supabase = createPublicClient()
  const [stats, popular, newest, reviews, products, hero] = await Promise.all([
    readHomeStats(supabase),
    readPopularListings(supabase),
    readNewListings(supabase),
    readRecentReviews(supabase),
    readRecentProducts(supabase),
    readHeroData(supabase),
  ])
  return { stats, popular, newest, reviews, products, hero }
}

// Several sections ask for the bundle in one render; React's per-request
// cache makes that one lookup.
const getHomeBundle = cache(loadHomeBundle)

/** Stats for the CategoryGrid and FeaturedSpotlight sections. */
export async function getHomeStats(): Promise<HomeStats> {
  return (await getHomeBundle()).stats
}

/** Top 6 popular listings for the PopularBusinesses carousel. */
export async function getHomePopularListings(): Promise<HomeListing[]> {
  return (await getHomeBundle()).popular
}

/** Newest 7 listings: six for the NewListingsSection, one spare in case the featured business is among them. */
export async function getHomeNewListings(): Promise<HomeListing[]> {
  return (await getHomeBundle()).newest
}

/** 6 recent reviews, each from a different listing. */
export async function getHomeRecentReviews(): Promise<HomeReview[]> {
  return (await getHomeBundle()).reviews
}

/** The 10 most recently updated catalog items, each from a different business. */
export async function getHomeRecentProducts(): Promise<HomeProduct[]> {
  return (await getHomeBundle()).products
}

/** The hero's collage and proof line. */
export async function getHomeHeroData(): Promise<HomeHeroData> {
  return (await getHomeBundle()).hero
}

// ─── The reads behind the bundle ───────────────────────────────────────────

/**
 * One RPC returns every count we need plus the featured listing; a second
 * read supplies the category tile thumbnails.
 */
async function readHomeStats(supabase: PublicClient): Promise<HomeStats> {
  const [statsResult, thumbResult] = await Promise.all([
    supabase.rpc('get_homepage_stats'),
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
    supabase
      .from('listings')
      .select('id, name, category, image_thumb_url, image_url, rating, review_count')
      .eq('approved', true)
      .not('category', 'is', null)
      .order('rating', { ascending: false, nullsFirst: false })
      .order('review_count', { ascending: false })
      .order('id', { ascending: true })
      .limit(200),
  ])
  const statsData = readOrThrow(statsResult, 'homepage stats')
  const thumbData = readOrThrow(thumbResult, 'listings')

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
}

async function readPopularListings(supabase: PublicClient): Promise<HomeListing[]> {
  const data = readOrThrow(await supabase
    .from('listings')
    .select(HOME_LISTING_COLUMNS)
    .eq('approved', true)
    .order('verified', { ascending: false })
    .order('review_count', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(6), 'listings')
  return (data ?? []) as HomeListing[]
}

async function readNewListings(supabase: PublicClient): Promise<HomeListing[]> {
  const data = readOrThrow(await supabase
    .from('listings')
    .select(HOME_LISTING_COLUMNS)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(7), 'listings')
  return (data ?? []) as HomeListing[]
}

/**
 * Fetches the latest 60 reviews, then keeps the most recent per listing, up
 * to 6 (see pickHomeReviews).
 */
async function readRecentReviews(supabase: PublicClient): Promise<HomeReview[]> {
  const data = readOrThrow(await supabase
    .from('reviews')
    .select(`
      id, listing_id, user_id, rating, comment, created_at,
      listings!reviews_listing_id_fkey(name, subdomain, owner_id)
    `)
    .not('comment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(60), 'reviews')

  if (!data) return []

  const nameById = await fetchProfileNames(supabase, data.map((row) => row.user_id))
  return pickHomeReviews(data as unknown as HomeReviewRow[], nameById)
}

/**
 * Reads the latest 150 catalog items and keeps the newest per business, like
 * the reviews above. RLS already limits this to visible items on approved
 * listings.
 */
async function readRecentProducts(supabase: PublicClient): Promise<HomeProduct[]> {
  const data = readOrThrow(await supabase
    .from('listing_products')
    .select(`listing_id, updated_at, ${CATALOG_ITEM_SELECT}, listings!listing_products_listing_id_fkey(name, subdomain)`)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(150), 'listing products')

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
}

/**
 * Photos from the best-rated businesses that have one, and real totals
 * rather than rounded marketing numbers. The totals are display-only, so
 * they are 'estimated' counts: PostgREST counts exactly below its max-rows
 * threshold (1,000 on Supabase; these tables hold under 200 rows each) and
 * uses the planner's estimate above it. They are cached with the rest of the
 * bundle either way.
 */
async function readHeroData(supabase: PublicClient): Promise<HomeHeroData> {
  const count = { count: 'estimated' as const, head: true }
  const [photoRows, businesses, reviews, items, professionals] = await Promise.all([
    supabase
      .from('listings')
      .select('id, name, category, subdomain, image_url, image_thumb_url')
      .eq('approved', true)
      .not('image_url', 'is', null)
      .order('rating', { ascending: false, nullsFirst: false })
      .order('review_count', { ascending: false })
      .order('id', { ascending: true })
      .limit(5),
    supabase.from('listings').select('id', count).eq('approved', true),
    supabase.from('reviews').select('id', count),
    supabase.from('listing_products').select('id', count).eq('is_active', true),
    supabase.from('find_professionals').select('id', count).eq('status', 'approved').eq('is_active', true),
  ])
  for (const [what, result] of [['hero photos', photoRows], ['businesses', businesses], ['reviews', reviews], ['items', items], ['professionals', professionals]] as const) {
    readOrThrow(result, what)
  }

  type PhotoRow = { id: string; name: string; category: string; subdomain: string | null; image_url: string | null; image_thumb_url: string | null }
  return {
    photos: ((photoRows.data ?? []) as PhotoRow[])
      .filter((row) => row.image_url || row.image_thumb_url)
      .map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        subdomain: row.subdomain,
        // The full image: these are shown large, unlike the directory thumbnails.
        imageUrl: (row.image_url || row.image_thumb_url)!,
      })),
    counts: {
      businesses: businesses.count ?? 0,
      reviews: reviews.count ?? 0,
      items: items.count ?? 0,
      professionals: professionals.count ?? 0,
    },
  }
}
