import 'server-only'

import { revalidateTag } from 'next/cache'

export const CACHE_TAGS = {
  home: 'home',
  pricing: 'pricing',
  coupons: 'coupons',
  emergency: 'emergency',
  listings: 'listings',
  listingCategories: 'listing-categories',
  jobs: 'jobs',
  settings: 'settings',
  listing: (listingId: string) => `listing:${listingId}`,
} as const

export function revalidatePublicListingCollections() {
  revalidateTag(CACHE_TAGS.home, 'max')
  revalidateTag(CACHE_TAGS.listings, 'max')
  revalidateTag(CACHE_TAGS.listingCategories, 'max')
}

export function revalidatePublicListingDetail(listingId: string) {
  revalidateTag(CACHE_TAGS.listing(listingId), 'max')
}

export function revalidatePublicListingContent(listingId: string) {
  revalidatePublicListingCollections()
  revalidatePublicListingDetail(listingId)
}

export function revalidatePublicJobs() {
  revalidateTag(CACHE_TAGS.home, 'max')
  revalidateTag(CACHE_TAGS.jobs, 'max')
}

export function revalidatePricingCache() {
  revalidateTag(CACHE_TAGS.home, 'max')
  revalidateTag(CACHE_TAGS.pricing, 'max')
}

export function revalidateCouponCache() {
  revalidateTag(CACHE_TAGS.coupons, 'max')
}

export function revalidateEmergencyCache() {
  revalidateTag(CACHE_TAGS.emergency, 'max')
}

export function revalidateSettingsCache() {
  revalidateTag(CACHE_TAGS.settings, 'max')
  revalidateTag(CACHE_TAGS.home, 'max')
}
