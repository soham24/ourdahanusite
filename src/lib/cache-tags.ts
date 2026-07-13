import 'server-only'

import { updateTag } from 'next/cache'

import { logCacheInvalidation } from '@/lib/isr-debug'

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
  find: 'find-directory',
} as const

// All helpers below use `updateTag`, not `revalidateTag(..., 'max')`.
//
// In Next.js 16 Cache Components, `revalidateTag(tag, 'max')` is a
// stale-while-revalidate signal — the existing cache keeps serving until a
// background refresh completes. For admin/owner mutations the caller
// expects to see the change on the very next read ("read-your-own-writes"),
// which is exactly what `updateTag` provides. `updateTag` MUST be called
// from within a Server Action — every caller of these helpers is one.

function updatePublicTag(scope: string, tag: string) {
  logCacheInvalidation({ scope, tags: [tag] })
  updateTag(tag)
}

function updatePublicTags(scope: string, tags: string[]) {
  logCacheInvalidation({ scope, tags })
  for (const tag of tags) {
    updateTag(tag)
  }
}

export function revalidatePublicListingCollections() {
  updatePublicTags('public-listing-collections', [
    CACHE_TAGS.home,
    CACHE_TAGS.listings,
    CACHE_TAGS.listingCategories,
  ])
}

export function revalidatePublicListingDetail(listingId: string) {
  updatePublicTag('public-listing-detail', CACHE_TAGS.listing(listingId))
}

export function revalidatePublicListingContent(listingId: string) {
  revalidatePublicListingCollections()
  revalidatePublicListingDetail(listingId)
}

export function revalidatePublicJobs() {
  updatePublicTags('public-jobs', [CACHE_TAGS.home, CACHE_TAGS.jobs])
}

export function revalidatePricingCache() {
  updatePublicTags('pricing', [CACHE_TAGS.home, CACHE_TAGS.pricing])
}

export function revalidateCouponCache() {
  updatePublicTag('coupons', CACHE_TAGS.coupons)
}

export function revalidateEmergencyCache() {
  updatePublicTag('emergency', CACHE_TAGS.emergency)
}

export function revalidateSettingsCache() {
  updatePublicTags('settings', [CACHE_TAGS.settings, CACHE_TAGS.home])
}

export function revalidatePollsCache() {
  updatePublicTags('polls', [CACHE_TAGS.polls, CACHE_TAGS.home])
}

export function revalidateAppointmentsCache(listingId: string) {
  updatePublicTag('appointments', CACHE_TAGS.appointments)
  revalidatePublicListingDetail(listingId)
}

// One broad tag covers the whole find directory (landing list, category
// counts, professional pages, ratings). Admin moderation is the only thing
// that changes public find content, and it is rare — coarse invalidation is
// simpler and safe at this scale.
export function revalidateFindCache() {
  updatePublicTag('find', CACHE_TAGS.find)
}
