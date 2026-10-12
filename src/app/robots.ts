import type { MetadataRoute } from 'next'

import { ROOT_DOMAIN } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // No trailing slashes: '/admin/' left /admin itself crawlable.
      disallow: ['/admin', '/dashboard', '/my-business', '/account', '/profile', '/payments', '/checkout', '/api/'],
    },
    sitemap: `https://${ROOT_DOMAIN}/sitemap.xml`,
    host: ROOT_DOMAIN,
  }
}
