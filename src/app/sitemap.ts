import type { MetadataRoute } from 'next'
import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_SITEMAP_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { compareStableText, getCategoryUrl } from '@/lib/listing-category'
import { SITE_URL } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/public'
import { isValidProfession, professionSlug } from '@/lib/find/professions'
import { MIN_CATEGORY_SIZE, isProfileIndexable } from '@/lib/seo-thresholds'

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
  logCacheRegeneration({ scope: 'sitemap', tags: [CACHE_TAGS.listings, CACHE_TAGS.find] })

  const base = SITE_URL

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/listings`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/about`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/play`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/emergency`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.6 },
  ]

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
      const subdomainUrl = l.subdomain ? `https://${l.subdomain}.ourdahanu.in` : null
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

    // find.ourdahanu.in — cross-host entries are valid here because the find
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
        url: 'https://find.ourdahanu.in/',
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily',
        priority: 0.8,
      },
      ...[...categorySet].map((prof) => ({
        url: `https://find.ourdahanu.in/c/${professionSlug(prof)}`,
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
      ...indexableFindRows.map((p) => ({
        url: `https://find.ourdahanu.in/p/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : STATIC_LAST_MODIFIED,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]

    return [...staticRoutes, ...categoryRoutes, ...listingRoutes, ...findRoutes]
  } catch {
    return staticRoutes
  }
}
