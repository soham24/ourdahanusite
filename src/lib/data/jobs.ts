import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { jobCategoryMarathi } from '@/lib/jobs/categories'
import type { JobBusiness, PublicJobPost } from '@/lib/jobs/types'
import type { JobKind } from '@/lib/jobs/validation'
import { createPublicClient } from '@/lib/supabase/public'

// Explicit columns, never `*`: job_posts holds moderation columns that must not
// reach cached public payloads. Contact details live in a table the public
// client cannot read at all.
const PUBLIC_COLUMNS =
  'id, kind, title, category, work_types, area, description, employer_name, openings, pay_min, pay_max, pay_period, timings, display_name, experience_years, collected_source, published_at, expires_at'

// A safety bound, not a page size. Keep it well above the number of live posts,
// or posts silently vanish from the board.
const LIVE_POST_CAP = 500

type RawBusiness = (JobBusiness & { approved: boolean | null }) | null
type RawPost = Omit<PublicJobPost, 'business'> & { business: RawBusiness }

function toPublicPost(row: RawPost): PublicJobPost {
  const { business, ...post } = row
  return {
    ...post,
    // The "OurDahanu business" badge follows the listing: if the listing
    // lapses, the badge disappears with it.
    business: business && business.approved ? { id: business.id, name: business.name, subdomain: business.subdomain } : null,
  }
}

/**
 * Every live post, newest first, as one cached unit. Row-level security applies
 * the live filter (approved and not yet expired) at query time. With the
 * `hours` profile an expired post leaves the board within about an hour even
 * when nothing writes; every mutation refreshes it at once via the `jobs` tag.
 */
async function getLiveJobPosts(): Promise<PublicJobPost[]> {
  'use cache'

  cacheLife('hours')
  cacheTag(CACHE_TAGS.jobs)
  logCacheRegeneration({ scope: 'jobs:board', tags: [CACHE_TAGS.jobs] })

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('job_posts')
    .select(`${PUBLIC_COLUMNS}, business:listings(id, name, subdomain, approved)`)
    .eq('status', 'approved')
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(LIVE_POST_CAP)

  return ((data ?? []) as unknown as RawPost[]).map(toPublicPost)
}

export interface JobBoardFilters {
  kind: JobKind
  q?: string
  category?: string | null
  workType?: string | null
  area?: string | null
}

function matchesTerms(post: PublicJobPost, terms: string[]): boolean {
  const haystack = [
    post.title,
    post.employer_name ?? '',
    post.display_name ?? '',
    post.area,
    post.description ?? '',
    post.category,
    // Categories match in both languages.
    jobCategoryMarathi(post.category) ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

/** Filters run in memory over the cached set — a few hundred rows at most. */
export async function getJobBoard(filters: JobBoardFilters): Promise<PublicJobPost[]> {
  const terms = (filters.q ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  const area = (filters.area ?? '').trim().toLowerCase()
  const posts = await getLiveJobPosts()
  return posts.filter(
    (post) =>
      post.kind === filters.kind &&
      (!filters.category || post.category === filters.category) &&
      (!filters.workType || post.work_types.includes(filters.workType)) &&
      (!area || post.area.toLowerCase().includes(area)) &&
      (terms.length === 0 || matchesTerms(post, terms)),
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getLiveJobPostById(id: string): Promise<PublicJobPost | null> {
  if (!UUID.test(id)) return null
  const posts = await getLiveJobPosts()
  return posts.find((post) => post.id === id) ?? null
}
