import type { MetadataRoute } from 'next'
import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_SITEMAP_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { compareStableText, getCategoryUrl } from '@/lib/listing-category'
import { SITE_URL } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/public'
import { isValidProfession, professionSlug } from '@/lib/find/professions'

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

    const categoryRoutes: MetadataRoute.Sitemap = [...new Set(sitemapListings.map((listing) => listing.category).filter(Boolean))]
      .sort((a, b) => compareStableText(a as string, b as string))
      .map((category) => ({
        url: getCategoryUrl(category as string),
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }))

    // find.ourdahanu.in — cross-host entries are valid here because the find
    // subdomain's robots.txt declares this sitemap (same mechanism the
    // business-subdomain URLs above rely on).
    const { data: professionals } = await supabase
      .from('find_professionals')
      .select('id, updated_at, professions')
      .eq('status', 'approved')
      .eq('is_active', true)

    const findRows = (professionals ?? []) as {
      id: string
      updated_at: string | null
      professions: string[] | null
    }[]

    // One category landing page per profession that actually has professionals.
    const categorySet = new Set<string>()
    for (const row of findRows) {
      for (const prof of row.professions ?? []) {
        if (prof !== 'Other' && isValidProfession(prof)) categorySet.add(prof)
      }
    }

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
      ...findRows.map((p) => ({
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
