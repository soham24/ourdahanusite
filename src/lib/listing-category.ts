import { buildAbsoluteUrl } from '@/lib/site'

export const LISTING_CATEGORIES = [
  'Restaurants', 'Homemade Food', 'Hotels & Stay', 'Grocery & Shops',
  'Healthcare & Clinics', 'Medical Store', 'Hardware', 'Education & Coaching',
  'Transport & Taxi', 'Salons & Beauty', 'Massage & Wellness', 'Warli Art', 'Warli Arts & Crafts', 'Arts & Crafts',
  'Photography', 'Event Services', 'Repair Services', 'Electricians & Plumbing',
  'Contractors & Construction', 'Cleaning Services', 'Tailoring', 'Farms & Organic',
  'Dairy & Milk', 'Bakers & Sweets', 'Home-based Sellers', 'Financial Services',
  'Content Creators', 'Video Editors', 'Graphic Designers', 'Social Media & Marketing',
  'Freelancers & Digital',
  'Fashion & Clothing', 'Skincare & Cosmetics', 'Interior Design',
  'Internet & Telecom', 'NGOs & Social Causes',
  'Other',
] as const

export const LISTING_CATEGORY_EMOJIS: Record<string, string> = {
  Restaurants: '🍽️',
  'Homemade Food': '🍱',
  'Hotels & Stay': '🏨',
  'Hotels & Stays': '🏨',
  'Grocery & Shops': '🛒',
  Grocery: '🛒',
  'Healthcare & Clinics': '🏥',
  'Medical Store': '💊',
  Hardware: '🔩',
  'Education & Coaching': '📚',
  Tutors: '📚',
  'Transport & Taxi': '🚕',
  Transport: '🚕',
  'Salons & Beauty': '💇',
  'Massage & Wellness': '💆',
  'Warli Art': '🎨',
  'Warli Arts & Crafts': '🎨',
  'Arts & Crafts': '🖼️',
  Photography: '📸',
  'Event Services': '🎉',
  'Repair Services': '🔧',
  'Electricians & Plumbing': '⚡',
  'Contractors & Construction': '🏗️',
  'Cleaning Services': '🧹',
  Tailoring: '🧵',
  'Farms & Organic': '🌱',
  'Dairy & Milk': '🥛',
  'Bakers & Sweets': '🍰',
  'Home-based Sellers': '🏡',
  'Financial Services': '💰',
  'Content Creators': '📱',
  'Video Editors': '🎬',
  'Graphic Designers': '🖌️',
  'Social Media & Marketing': '📣',
  'Freelancers & Digital': '💻',
  'Fashion & Clothing': '👗',
  'Skincare & Cosmetics': '🧴',
  'Interior Design': '🛋️',
  'Internet & Telecom': '📡',
  'NGOs & Social Causes': '🌍',
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

export function sortCategoriesForDiscovery(entries: Array<[string, number]>): Array<[string, number]> {
  return [...entries].sort((a, b) => {
    const penaltyA = DISCOVERY_CATEGORY_PENALTIES[toCategorySlug(a[0])] ?? 0
    const penaltyB = DISCOVERY_CATEGORY_PENALTIES[toCategorySlug(b[0])] ?? 0

    if (penaltyA !== penaltyB) return penaltyA - penaltyB
    if (a[1] !== b[1]) return b[1] - a[1]

    return a[0].localeCompare(b[0])
  })
}
