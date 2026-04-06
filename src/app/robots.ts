import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/', '/my-business/', '/api/'],
    },
    sitemap: 'https://ourdahanu.in/sitemap.xml',
    host: 'ourdahanu.in',
  }
}
