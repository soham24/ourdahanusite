import { buildAbsoluteUrl } from '@/lib/site'

/**
 * Categories grouped into discoverable clusters. Each form's <select>
 * renders these as <optgroup>s so the (now ~45-item) list is easier to
 * scan than a single flat dropdown. Order within a group is hand-tuned —
 * the most common choices appear first.
 *
 * To add a category: drop it into the right group's `categories` array
 * and add an emoji to LISTING_CATEGORY_EMOJIS below.
 */
export const LISTING_CATEGORY_GROUPS = [
  {
    label: 'Food & Dining',
    icon: '🍽️',
    categories: ['Restaurants', 'Cafe', 'Homemade Food', 'Bakers & Sweets', 'Dairy & Milk', 'Farms & Organic'],
  },
  {
    label: 'Hospitality & Stay',
    icon: '🏨',
    categories: ['Hotels & Stay'],
  },
  {
    label: 'Health & Wellness',
    icon: '🏥',
    categories: [
      'Healthcare & Clinics',
      'Medical Store',
      'Salons & Beauty',
      'Massage & Wellness',
      'Fitness & Wellness',
      'Skincare & Cosmetics',
    ],
  },
  {
    label: 'Shopping & Retail',
    icon: '🛒',
    categories: ['Grocery & Shops', 'Hardware', 'Fashion & Clothing', 'Home-based Sellers'],
  },
  {
    label: 'Education & Sports',
    icon: '📚',
    categories: ['Education & Coaching', 'Books & Literature', 'Sports Academy'],
  },
  {
    label: 'Events & Entertainment',
    icon: '🎉',
    categories: [
      'Event Services',
      'Spiritual & Cultural Events',
      'Photography',
      'Singers',
      'Musicians',
      'DJ',
      'Banjo Group',
      'Mehendi Artist',
      'Makeup Artist',
    ],
  },
  {
    label: 'Arts & Crafts',
    icon: '🎨',
    categories: ['Warli Art', 'Warli Arts & Crafts', 'Arts & Crafts'],
  },
  {
    label: 'Home Services',
    icon: '🛠️',
    categories: [
      'Repair Services',
      'Electricians & Plumbing',
      'Contractors & Construction',
      'Cleaning Services',
      'Tailoring',
      'Interior Design',
    ],
  },
  {
    label: 'Digital & Creative',
    icon: '💻',
    categories: [
      'Content Creators',
      'Video Editors',
      'Graphic Designers',
      'Social Media & Marketing',
      'Freelancers & Digital',
    ],
  },
  {
    label: 'Transport & Connectivity',
    icon: '🚕',
    categories: ['Transport & Taxi', 'Internet & Telecom'],
  },
  {
    label: 'Money & Community',
    icon: '💰',
    categories: ['Financial Services', 'NGOs & Social Causes'],
  },
  {
    label: 'Other',
    icon: '🏪',
    categories: ['Other'],
  },
] as const

// Flat list derived from the groups — keep this for backward-compat with
// callers that just need the full list (slug routing, RPC inputs, etc.).
export const LISTING_CATEGORIES = LISTING_CATEGORY_GROUPS.flatMap(
  (group) => group.categories,
) as readonly string[]

export const LISTING_CATEGORY_EMOJIS: Record<string, string> = {
  // Food & Dining
  Restaurants: '🍽️',
  Cafe: '☕',
  'Homemade Food': '🍱',
  'Bakers & Sweets': '🍰',
  'Dairy & Milk': '🥛',
  'Farms & Organic': '🌱',

  // Hospitality
  'Hotels & Stay': '🏨',
  'Hotels & Stays': '🏨',

  // Health & Wellness
  'Healthcare & Clinics': '🏥',
  'Medical Store': '💊',
  'Salons & Beauty': '💇',
  'Massage & Wellness': '💆',
  'Fitness & Wellness': '🏋️',
  'Skincare & Cosmetics': '🧴',

  // Shopping
  'Grocery & Shops': '🛒',
  Grocery: '🛒',
  Hardware: '🔩',
  'Fashion & Clothing': '👗',
  'Home-based Sellers': '🏡',

  // Education & Sports
  'Education & Coaching': '📚',
  'Books & Literature': '📖',
  Tutors: '📚',
  'Sports Academy': '🏆',

  // Events & Entertainment
  'Event Services': '🎉',
  'Spiritual & Cultural Events': '🪔',
  Photography: '📸',
  Singers: '🎤',
  Musicians: '🎼',
  DJ: '🎧',
  'Banjo Group': '🎺',
  'Mehendi Artist': '🪷',
  'Makeup Artist': '💄',

  // Arts & Crafts
  'Warli Art': '🎨',
  'Warli Arts & Crafts': '🎨',
  'Arts & Crafts': '🖼️',

  // Home Services
  'Repair Services': '🔧',
  'Electricians & Plumbing': '⚡',
  'Contractors & Construction': '🏗️',
  'Cleaning Services': '🧹',
  Tailoring: '🧵',
  'Interior Design': '🛋️',

  // Digital & Creative
  'Content Creators': '📱',
  'Video Editors': '🎬',
  'Graphic Designers': '🖌️',
  'Social Media & Marketing': '📣',
  'Freelancers & Digital': '💻',

  // Transport & Connectivity
  'Transport & Taxi': '🚕',
  Transport: '🚕',
  'Internet & Telecom': '📡',

  // Money & Community
  'Financial Services': '💰',
  'NGOs & Social Causes': '🌍',

  // Other
  Other: '🏪',
}

const DISCOVERY_CATEGORY_PENALTIES: Record<string, number> = {
  other: 1000,
}

export function toCategorySlug(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getCategoryPath(category: string): string {
  return `/listings/category/${toCategorySlug(category)}`
}

export function getCategoryUrl(category: string): string {
  return buildAbsoluteUrl(getCategoryPath(category))
}

export function findCategoryBySlug(categories: string[], slug: string): string | null {
  return categories.find((category) => toCategorySlug(category) === slug) ?? null
}

export function compareStableText(a: string, b: string): number {
  const normalizedA = a.trim().toLowerCase()
  const normalizedB = b.trim().toLowerCase()

  if (normalizedA < normalizedB) return -1
  if (normalizedA > normalizedB) return 1
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function sortCategoriesForDiscovery(entries: Array<[string, number]>): Array<[string, number]> {
  return [...entries].sort((a, b) => {
    const penaltyA = DISCOVERY_CATEGORY_PENALTIES[toCategorySlug(a[0])] ?? 0
    const penaltyB = DISCOVERY_CATEGORY_PENALTIES[toCategorySlug(b[0])] ?? 0

    if (penaltyA !== penaltyB) return penaltyA - penaltyB
    if (a[1] !== b[1]) return b[1] - a[1]

    return compareStableText(a[0], b[0])
  })
}
