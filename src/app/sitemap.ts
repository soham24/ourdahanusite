import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getCategoryUrl } from '@/lib/listing-category'
import { SITE_URL } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/listings`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/emergency`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  ]

  try {
    const supabase = await createClient()
    const { data: listings } = await supabase
      .from('listings')
      .select('id, subdomain, name, category, image_url, cover_image, address, updated_at')
      .eq('approved', true)

    const listingRoutes: MetadataRoute.Sitemap = (listings || []).flatMap((l) => {
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

    const categoryRoutes: MetadataRoute.Sitemap = [...new Set((listings || []).map((listing) => listing.category).filter(Boolean))]
      .map((category) => ({
        url: getCategoryUrl(category as string),
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }))

    return [...staticRoutes, ...categoryRoutes, ...listingRoutes]
  } catch {
    return staticRoutes
  }
}
