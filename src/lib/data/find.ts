import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { professionMarathi } from '@/lib/find/professions'
import { createPublicClient } from '@/lib/supabase/public'
import type { FindRating, ProfessionalWithStats } from '@/lib/find/types'

export type FindSort = 'top' | 'new'

export const FIND_PAGE_SIZE = 24

export interface FindPage {
  items: ProfessionalWithStats[]
  total: number
}

type RawLinkedBusiness = { id: string; name: string; subdomain: string | null; image_url: string | null; approved: boolean } | null

// Surface the linked business ONLY when the listing is approved (live) —
// this is the single gate that decides premium rendering.
function normalizeLinkedBusiness(raw: RawLinkedBusiness) {
  return raw && raw.approved
    ? { id: raw.id, name: raw.name, subdomain: raw.subdomain, image_url: raw.image_url }
    : null
}

// Explicit column lists (rather than `*`) so future columns don't silently
// leak into cached public payloads.
const PROFESSIONAL_COLUMNS =
  'id, name, phone, whatsapp, professions, profession_other, locality, note, status, is_active, submitted_by, business_listing_id, created_at, updated_at'
const RATING_COLUMNS =
  'id, professional_id, user_id, rating, comment, used_service, status, created_at, updated_at'

/**
 * The whole public directory — every approved+active professional with
 * rating stats — as ONE cached unit. All public reads (list, search,
 * category counts) derive from this in JS: the dataset is a few dozen rows,
 * so per-request DB round-trips and per-search-term cache entries would both
 * cost more than filtering in memory. Invalidated via the `find` tag by
 * admin moderation actions.
 */
async function getFindDirectory(): Promise<ProfessionalWithStats[]> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.find)
  logCacheRegeneration({ scope: 'find:directory', tags: [CACHE_TAGS.find] })

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('find_professionals')
    .select(`${PROFESSIONAL_COLUMNS}, business:listings(id, name, subdomain, image_url, approved)`)
    .eq('status', 'approved')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const rows = ((data ?? []) as unknown as (ProfessionalWithStats & { business: RawLinkedBusiness })[]).map((r) => ({
    ...r,
    business: normalizeLinkedBusiness(r.business),
  }))
  if (rows.length === 0) return []

  const { data: ratingRows } = await supabase
    .from('find_ratings')
    .select('professional_id, rating')
    .eq('status', 'approved')
    .in('professional_id', rows.map((r) => r.id))

  const stats = new Map<string, { sum: number; count: number }>()
  for (const row of (ratingRows ?? []) as { professional_id: string; rating: number }[]) {
    const cur = stats.get(row.professional_id) ?? { sum: 0, count: 0 }
    cur.sum += row.rating
    cur.count += 1
    stats.set(row.professional_id, cur)
  }

  return rows.map((r) => {
    const s = stats.get(r.id)
    return {
      ...r,
      avg_rating: s ? s.sum / s.count : 0,
      rating_count: s?.count ?? 0,
    }
  })
}

function matchesQuery(p: ProfessionalWithStats, cleaned: string): boolean {
  const haystack = [
    p.name,
    p.locality ?? '',
    p.note ?? '',
    p.profession_other ?? '',
    // Professions match in both languages, so "electrician" and
    // "इलेक्ट्रिशियन" both find the right people.
    ...p.professions,
    ...p.professions.map((x) => professionMarathi(x) ?? ''),
  ]
    .join(' ')
    .toLowerCase()
  return cleaned.split(/\s+/).every((term) => haystack.includes(term))
}

export async function getApprovedProfessionals(
  opts: { q?: string; profession?: string; sort?: FindSort; offset?: number; limit?: number } = {},
): Promise<FindPage> {
  let pros = await getFindDirectory()

  if (opts.profession && opts.profession !== 'All') {
    pros = pros.filter((p) => p.professions.includes(opts.profession!))
  }

  const cleaned = opts.q?.trim().toLowerCase()
  if (cleaned) {
    pros = pros.filter((p) => matchesQuery(p, cleaned))
  }

  // 'top' (default): rated professionals first (best average, then most
  // ratings); unrated ones follow newest-first. 'new': strictly newest-first.
  const sort: FindSort = opts.sort === 'new' ? 'new' : 'top'
  const sorted = [...pros].sort((a, b) => {
    // Premium (business-linked) professionals always rank first.
    const ap = a.business ? 0 : 1
    const bp = b.business ? 0 : 1
    if (ap !== bp) return ap - bp
    if (sort === 'top') {
      if (b.avg_rating !== a.avg_rating) return b.avg_rating - a.avg_rating
      if (b.rating_count !== a.rating_count) return b.rating_count - a.rating_count
    }
    return b.created_at.localeCompare(a.created_at)
  })

  const offset = opts.offset ?? 0
  const items = opts.limit != null ? sorted.slice(offset, offset + opts.limit) : sorted.slice(offset)
  return { items, total: sorted.length }
}

// Count of approved+active professionals per profession — used to hide empty
// categories from the public filter. `total` is the distinct professional
// count (for the "All" tile), NOT the sum of per-profession counts, which
// double-counts anyone tagged with more than one category.
export async function getProfessionCounts(): Promise<{ counts: Map<string, number>; total: number }> {
  const pros = await getFindDirectory()
  const counts = new Map<string, number>()
  for (const p of pros) {
    for (const profession of p.professions ?? []) {
      counts.set(profession, (counts.get(profession) ?? 0) + 1)
    }
  }
  return { counts, total: pros.length }
}

export async function getProfessionalById(
  id: string,
): Promise<ProfessionalWithStats | null> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.find)
  logCacheRegeneration({ scope: 'find:professional', tags: [CACHE_TAGS.find] })

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('find_professionals')
    .select(`${PROFESSIONAL_COLUMNS}, business:listings(id, name, subdomain, image_url, approved)`)
    .eq('id', id)
    .eq('status', 'approved')
    .eq('is_active', true)
    .maybeSingle()
  if (!data) return null

  const raw = data as unknown as ProfessionalWithStats & { business: RawLinkedBusiness }
  const business = normalizeLinkedBusiness(raw.business)

  const { data: ratingRows } = await supabase
    .from('find_ratings')
    .select('rating')
    .eq('professional_id', id)
    .eq('status', 'approved')

  const ratings = (ratingRows ?? []) as { rating: number }[]
  const count = ratings.length
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0)
  return { ...raw, business, avg_rating: count ? sum / count : 0, rating_count: count }
}

export async function getApprovedRatings(
  professionalId: string,
): Promise<FindRating[]> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.find)
  logCacheRegeneration({ scope: 'find:ratings', tags: [CACHE_TAGS.find] })

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('find_ratings')
    .select(RATING_COLUMNS)
    .eq('professional_id', professionalId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as FindRating[]
}
