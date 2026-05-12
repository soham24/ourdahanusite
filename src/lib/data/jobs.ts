import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { compareStableText } from '@/lib/listing-category'
import { createPublicClient } from '@/lib/supabase/public'

export interface JobBoardListing {
  id: string
  title: string
  company: string
  location: string | null
  type: string
  salary: string | null
  category: string
  positions: number | null
  description: string | null
  created_at: string
  status: string
}

export async function getJobsBoardData(
  activeCategory: string | null,
  activeType: string | null,
) {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.jobs)
  cacheTag(CACHE_TAGS.home)
  logCacheRegeneration({
    scope: 'jobs:board',
    tags: [CACHE_TAGS.jobs, CACHE_TAGS.home],
    detail: { activeCategory, activeType },
  })

  let jobs: JobBoardListing[] = []
  let categories: string[] = []
  let totalCount = 0

  try {
    const supabase = createPublicClient()
    const { data: allJobs } = await supabase
      .from('jobs')
      .select('category')
      .eq('approved', true)
      .in('status', ['open', 'hiring'])

    const categoryRows = (allJobs ?? []) as Array<{ category: string | null }>

    if (categoryRows.length) {
      const counts: Record<string, number> = {}
      for (const job of categoryRows) {
        if (job.category) {
          counts[job.category] = (counts[job.category] || 0) + 1
        }
      }

      categories = Object.entries(counts)
        .sort((a, b) => b[1] - a[1] || compareStableText(a[0], b[0]))
        .map(([category]) => category)
      totalCount = categoryRows.length
    }

    let query = supabase
      .from('jobs')
      .select('id, title, company, location, type, salary, category, positions, description, created_at, status')
      .eq('approved', true)
      .in('status', ['open', 'hiring'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(50)

    if (activeCategory) {
      query = query.eq('category', activeCategory) as typeof query
    }

    if (activeType) {
      query = query.eq('type', activeType) as typeof query
    }

    const { data } = await query
    jobs = (data ?? []) as JobBoardListing[]
  } catch {
    jobs = []
  }

  return {
    jobs,
    categories,
    totalCount,
  }
}
