import type { MetadataRoute } from 'next'

import { siteConfig } from '@/lib/site-config'

// The installable-app manifest, served at /manifest.webmanifest and linked
// from every page by Next.js. Generated rather than a file in public/ so a
// fork's name follows site-config.ts like everything else.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: `The online home for ${siteConfig.town}'s community`,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#16a34a',
    icons: [
      { src: '/logo.png', sizes: 'any', type: 'image/png' },
      { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
    categories: ['news', 'social', 'utilities'],
    lang: 'en-IN',
    shortcuts: [
      { name: 'Emergency', url: '/emergency', description: 'Emergency contacts' },
      { name: 'Events', url: '/events', description: 'Upcoming events' },
    ],
  }
}
