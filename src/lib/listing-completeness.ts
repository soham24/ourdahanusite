/**
 * How finished a business's listing is, and what to do next.
 *
 * Pure, so the My Business checklist and the monthly email can never disagree
 * about what is missing. Every step names the page that fixes it.
 */

export type CompletenessInput = {
  id: string
  image_url: string | null
  cover_image: string | null
  description: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  map_url: string | null
  photos: unknown
  appointments_enabled: boolean | null
  appointment_settings: unknown
  /** Visible catalog items (products or services). */
  itemCount: number
}

export type CompletenessStep = {
  key: string
  label: string
  /** Why it matters, in a few words, for the owner. */
  why: string
  done: boolean
  href: string
}

export type Completeness = {
  percent: number
  steps: CompletenessStep[]
  missing: CompletenessStep[]
}

/** A description shorter than this reads as unfinished. */
export const MIN_DESCRIPTION_LENGTH = 80
export const MIN_GALLERY_PHOTOS = 3

function filled(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function photoCount(photos: unknown): number {
  return Array.isArray(photos) ? photos.filter((p) => typeof p === 'string' && p.trim()).length : 0
}

export function listingCompleteness(listing: CompletenessInput): Completeness {
  const edit = `/my-business/edit/${listing.id}`
  const steps: CompletenessStep[] = [
    {
      key: 'logo',
      label: 'Add a logo or profile photo',
      why: 'Listings with a photo get far more taps',
      done: filled(listing.image_url),
      href: edit,
    },
    {
      key: 'cover',
      label: 'Add a cover photo',
      why: 'It is the first thing visitors see',
      done: filled(listing.cover_image),
      href: edit,
    },
    {
      key: 'description',
      label: 'Describe what you offer',
      why: 'Helps people and search engines find you',
      done: filled(listing.description) && listing.description!.trim().length >= MIN_DESCRIPTION_LENGTH,
      href: edit,
    },
    {
      key: 'contact',
      label: 'Add a phone or WhatsApp number',
      why: 'So customers can reach you',
      done: filled(listing.phone) || filled(listing.whatsapp),
      href: edit,
    },
    {
      key: 'location',
      label: 'Add your address or map link',
      why: 'So customers can find you',
      done: filled(listing.address) || filled(listing.map_url),
      href: edit,
    },
    {
      key: 'photos',
      label: `Add at least ${MIN_GALLERY_PHOTOS} gallery photos`,
      why: 'Shows your shop, work or products',
      done: photoCount(listing.photos) >= MIN_GALLERY_PHOTOS,
      href: edit,
    },
    {
      key: 'catalog',
      label: 'List a product or service with a price',
      why: 'Customers can order or ask on WhatsApp',
      done: listing.itemCount > 0,
      href: `/my-business/products/${listing.id}`,
    },
  ]

  // Only when booking is switched on: without hours there is no booking page,
  // and the appointments directory can only send people to the business page.
  // First, because customers are already being turned away.
  if (listing.appointments_enabled) {
    steps.unshift({
      key: 'booking-hours',
      label: 'Set your appointment hours',
      why: 'Online booking is on but nobody can book yet',
      done: listing.appointment_settings != null,
      href: '/my-business/appointments',
    })
  }

  const done = steps.filter((s) => s.done).length
  return {
    percent: Math.round((done / steps.length) * 100),
    steps,
    missing: steps.filter((s) => !s.done),
  }
}
