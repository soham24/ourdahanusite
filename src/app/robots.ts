import type { MetadataRoute } from 'next'

import { ROOT_DOMAIN } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/', '/my-business/', '/api/'],
    },
    sitemap: `https://${ROOT_DOMAIN}/sitemap.xml`,
    host: ROOT_DOMAIN,
  }
}
