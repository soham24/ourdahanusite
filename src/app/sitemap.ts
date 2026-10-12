import type { MetadataRoute } from 'next'
import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_SITEMAP_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { getPublishedGuides } from '@/lib/guides'
import { compareStableText, getCategoryUrl } from '@/lib/listing-category'
import { ROOT_DOMAIN, SITE_URL } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/public'
import { isValidProfession, professionSlug } from '@/lib/find/professions'
import { MIN_CATEGORY_SIZE, isProfileIndexable } from '@/lib/seo-thresholds'
import { isValidJobCategory, jobCategorySlug } from '@/lib/jobs/categories'

const STATIC_LAST_MODIFIED = new Date('2026-01-01T00:00:00.000Z')

type SitemapListing = {
  id: string
  subdomain: string | null
  category: string | null
  image_url: string | null
  cover_image: string | null
  updated_at: string | null
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  'use cache'

  cacheLife(PUBLIC_SITEMAP_CACHE)
  cacheTag(CACHE_TAGS.listings)
  cacheTag(CACHE_TAGS.find)
  cacheTag(CACHE_TAGS.jobs)
  logCacheRegeneration({ scope: 'sitemap', tags: [CACHE_TAGS.listings, CACHE_TAGS.find, CACHE_TAGS.jobs] })

  const base = SITE_URL

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/listings`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/about`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/play`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/emergency`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.6 },
  ]

  // Editorial guides are files in the repo, not DB rows, so they're resolved
  // outside the Supabase try/catch below — a database outage must not drop
  // them from the sitemap.
  const guides = await getPublishedGuides()
  if (guides.length > 0) {
    staticRoutes.push({
      url: `${base}/guides`,
      lastModified: STATIC_LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 0.8,
    })
    for (const guide of guides) {
      staticRoutes.push({
        url: `${base}/guides/${guide.slug}`,
        lastModified: guide.date ? new Date(guide.date) : STATIC_LAST_MODIFIED,
        changeFrequency: 'monthly',
        priority: 0.75,
      })
    }
  }

  try {
    const supabase = createPublicClient()
    const { data: listings } = await supabase
      .from('listings')
      // Only the columns sitemap entries actually consume — keeps Supabase
      // egress and JSON serialization small on every regen.
      .select('id, subdomain, category, image_url, cover_image, updated_at')
      .eq('approved', true)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })

    const sitemapListings = (listings ?? []) as SitemapListing[]
    const listingRoutes: MetadataRoute.Sitemap = sitemapListings.flatMap((l) => {
      const subdomainUrl = l.subdomain ? `https://${l.subdomain}.${ROOT_DOMAIN}` : null
      const uuidUrl = `${base}/listings/${l.id}`
      const canonicalUrl = subdomainUrl || uuidUrl
      const images = [l.image_url, l.cover_image]
        .filter((u): u is string => typeof u === 'string' && u.startsWith('http'))

      const entry: MetadataRoute.Sitemap[number] = {
        url: canonicalUrl,
        lastModified: l.updated_at ? new Date(l.updated_at) : STATIC_LAST_MODIFIED,
        changeFrequency: 'weekly',
        priority: 0.85,
        ...(images.length > 0 ? { images } : {}),
      }

      // Only include the canonical URL — the UUID path redirects to the subdomain
      // and having both confuses Google into showing the wrong URL in search results
      return [entry]
    })

    const listingCategoryCounts = new Map<string, number>()
    for (const l of sitemapListings) {
      if (!l.category) continue
      listingCategoryCounts.set(l.category, (listingCategoryCounts.get(l.category) ?? 0) + 1)
    }

    const categoryRoutes: MetadataRoute.Sitemap = [...listingCategoryCounts.entries()]
      .filter(([, count]) => count >= MIN_CATEGORY_SIZE)
      .map(([category]) => category)
      .sort((a, b) => compareStableText(a, b))
      .map((category) => ({
        url: getCategoryUrl(category),
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }))

    // find.<ROOT_DOMAIN> — cross-host entries are valid here because the find
    // subdomain's robots.txt declares this sitemap (same mechanism the
    // business-subdomain URLs above rely on).
    const { data: professionals } = await supabase
      .from('find_professionals')
      .select('id, updated_at, professions, note, business_listing_id')
      .eq('status', 'approved')
      .eq('is_active', true)

    const findRows = (professionals ?? []) as {
      id: string
      updated_at: string | null
      professions: string[] | null
      note: string | null
      business_listing_id: string | null
    }[]

    const { data: ratedRows } = await supabase
      .from('find_ratings')
      .select('professional_id')
      .eq('status', 'approved')

    const ratedProfessionalIds = new Set(
      ((ratedRows ?? []) as { professional_id: string }[]).map((r) => r.professional_id),
    )

    // One category landing page per profession with enough professionals to
    // not read as thin/doorway content to search engines.
    const professionCounts = new Map<string, number>()
    for (const row of findRows) {
      for (const prof of row.professions ?? []) {
        if (prof !== 'Other' && isValidProfession(prof)) {
          professionCounts.set(prof, (professionCounts.get(prof) ?? 0) + 1)
        }
      }
    }
    const categorySet = new Set(
      [...professionCounts.entries()]
        .filter(([, count]) => count >= MIN_CATEGORY_SIZE)
        .map(([prof]) => prof),
    )

    const approvedListingIds = new Set(sitemapListings.map((l) => l.id))

    // Only list profiles that would actually be indexable — mirrors the same
    // rule applied on the profile page itself (src/lib/seo-thresholds.ts).
    // business_listing_id is gated to APPROVED listings only, matching
    // normalizeLinkedBusiness in src/lib/data/find.ts — a bare professional
    // linked to a pending/unapproved listing must not count as "has a
    // business" here, or this page would end up in the sitemap while its
    // own page (correctly) renders noindex.
    const indexableFindRows = findRows.filter((row) =>
      isProfileIndexable({
        note: row.note,
        rating_count: ratedProfessionalIds.has(row.id) ? 1 : 0,
        business:
          row.business_listing_id && approvedListingIds.has(row.business_listing_id)
            ? row.business_listing_id
            : null,
      }),
    )

    const findRoutes: MetadataRoute.Sitemap = [
      {
        url: `https://find.${ROOT_DOMAIN}/`,
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily',
        priority: 0.8,
      },
      ...[...categorySet].map((prof) => ({
        url: `https://find.${ROOT_DOMAIN}/c/${professionSlug(prof)}`,
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
      ...indexableFindRows.map((p) => ({
        url: `https://find.${ROOT_DOMAIN}/p/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : STATIC_LAST_MODIFIED,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]

    // jobs.<ROOT_DOMAIN> — the board, category pages with enough live hiring
    // posts, and each live hiring post. "Looking for work" profiles are left
    // out on purpose: their pages are noindex, so a person's profile never
    // lingers in search results. The public client can only read live posts.
    // An expired post can stay listed until the next write or sitemap refresh;
    // its page then 404s, and its JobPosting carried validThrough regardless.
    const { data: jobRows } = await supabase
      .from('job_posts')
      .select('id, category, published_at')
      .eq('status', 'approved')
      .eq('kind', 'hiring')

    const liveHiring = (jobRows ?? []) as { id: string; category: string; published_at: string | null }[]

    const jobCategoryCounts = new Map<string, number>()
    for (const row of liveHiring) {
      if (row.category !== 'Other' && isValidJobCategory(row.category)) {
        jobCategoryCounts.set(row.category, (jobCategoryCounts.get(row.category) ?? 0) + 1)
      }
    }

    const jobRoutes: MetadataRoute.Sitemap = [
      {
        url: `https://jobs.${ROOT_DOMAIN}/`,
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily',
        priority: 0.8,
      },
      ...[...jobCategoryCounts.entries()]
        .filter(([, count]) => count >= MIN_CATEGORY_SIZE)
        .map(([category]) => ({
          url: `https://jobs.${ROOT_DOMAIN}/c/${jobCategorySlug(category)}`,
          lastModified: STATIC_LAST_MODIFIED,
          changeFrequency: 'daily' as const,
          priority: 0.7,
        })),
      ...liveHiring.map((row) => ({
        url: `https://jobs.${ROOT_DOMAIN}/j/${row.id}`,
        lastModified: row.published_at ? new Date(row.published_at) : STATIC_LAST_MODIFIED,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]

    return [...staticRoutes, ...categoryRoutes, ...listingRoutes, ...findRoutes, ...jobRoutes]
  } catch {
    return staticRoutes
  }
}
