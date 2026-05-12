export const PUBLIC_CONTENT_CACHE = {
  stale: 3600,
  revalidate: 86400,
  expire: 604800,
} as const

export const PUBLIC_SITEMAP_CACHE = {
  stale: 86400,
  revalidate: 604800,
  expire: 2592000,
} as const

export const URGENT_PUBLIC_CACHE = {
  stale: 3600,
  revalidate: 86400,
  expire: 604800,
} as const
