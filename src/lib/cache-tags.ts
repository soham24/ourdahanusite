import 'server-only'

import { updateTag } from 'next/cache'

export const CACHE_TAGS = {
  home: 'home',
  pricing: 'pricing',
  coupons: 'coupons',
  emergency: 'emergency',
  listings: 'listings',
  listingCategories: 'listing-categories',
  jobs: 'jobs',
  settings: 'settings',
  polls: 'polls',
  appointments: 'appointments',
  listing: (listingId: string) => `listing:${listingId}`,
} as const

// All helpers below use `updateTag`, not `revalidateTag(..., 'max')`.
//
// In Next.js 16 Cache Components, `revalidateTag(tag, 'max')` is a
// stale-while-revalidate signal — the existing cache keeps serving until a
// background refresh completes. For admin/owner mutations the caller
// expects to see the change on the very next read ("read-your-own-writes"),
// which is exactly what `updateTag` provides. `updateTag` MUST be called
// from within a Server Action — every caller of these helpers is one.

export function revalidatePublicListingCollections() {
  updateTag(CACHE_TAGS.home)
  updateTag(CACHE_TAGS.listings)
  updateTag(CACHE_TAGS.listingCategories)
}

export function revalidatePublicListingDetail(listingId: string) {
  updateTag(CACHE_TAGS.listing(listingId))
}

export function revalidatePublicListingContent(listingId: string) {
  revalidatePublicListingCollections()
  revalidatePublicListingDetail(listingId)
}

export function revalidatePublicJobs() {
  updateTag(CACHE_TAGS.home)
  updateTag(CACHE_TAGS.jobs)
}

export function revalidatePricingCache() {
  updateTag(CACHE_TAGS.home)
  updateTag(CACHE_TAGS.pricing)
}

export function revalidateCouponCache() {
  updateTag(CACHE_TAGS.coupons)
}

export function revalidateEmergencyCache() {
  updateTag(CACHE_TAGS.emergency)
}

export function revalidateSettingsCache() {
  updateTag(CACHE_TAGS.settings)
  updateTag(CACHE_TAGS.home)
}

export function revalidatePollsCache() {
  updateTag(CACHE_TAGS.polls)
  updateTag(CACHE_TAGS.home)
}

export function revalidateAppointmentsCache(listingId: string) {
  updateTag(CACHE_TAGS.appointments)
  revalidatePublicListingDetail(listingId)
}
