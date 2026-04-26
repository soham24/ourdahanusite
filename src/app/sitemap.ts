import type { MetadataRoute } from 'next'
import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { getCategoryUrl } from '@/lib/listing-category'
import { SITE_URL } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/public'

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

  cacheLife({ stale: 3600, revalidate: 7200, expire: 86400 })
  cacheTag(CACHE_TAGS.listings)

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
      .select('id, subdomain, name, category, image_url, cover_image, address, updated_at')
      .eq('approved', true)

    const sitemapListings = (listings ?? []) as SitemapListing[]
    const listingRoutes: MetadataRoute.Sitemap = sitemapListings.flatMap((l) => {
      const subdomainUrl = l.subdomain ? `https://${l.subdomain}.ourdahanu.in` : null
      const uuidUrl = `${base}/listings/${l.id}`
      const canonicalUrl = subdomainUrl || uuidUrl
      const images = [l.image_url, l.cover_image]
        .filter((u): u is string => typeof u === 'string' && u.startsWith('http'))

      const entry: MetadataRoute.Sitemap[number] = {
        url: canonicalUrl,
        lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.85,
        ...(images.length > 0 ? { images } : {}),
      }

      // Only include the canonical URL — the UUID path redirects to the subdomain
      // and having both confuses Google into showing the wrong URL in search results
      return [entry]
    })

    const categoryRoutes: MetadataRoute.Sitemap = [...new Set(sitemapListings.map((listing) => listing.category).filter(Boolean))]
      .map((category) => ({
        url: getCategoryUrl(category as string),
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }))

    return [...staticRoutes, ...categoryRoutes, ...listingRoutes]
  } catch {
    return staticRoutes
  }
}
