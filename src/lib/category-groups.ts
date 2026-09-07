import {
  LISTING_CATEGORY_GROUPS,
  compareStableText,
  getCategoryPath,
  toCategorySlug,
} from '@/lib/listing-category'

/** Shape this module needs from a listing row. */
export interface GroupThumbSource {
  id: string
  name: string
  category: string
  image_thumb_url: string | null
  image_url: string | null
  rating: number | null
  review_count: number | null
}

export interface CategoryGroupThumb {
  id: string
  name: string
  imageUrl: string
}

export interface CategoryGroupMember {
  label: string
  count: number
  href: string
}

export interface CategoryGroupSummary {
  label: string
  icon: string
  slug: string
  count: number
  /** Up to three, best-rated first. May be empty. */
  thumbs: CategoryGroupThumb[]
  /** Live member categories only, most populated first. */
  members: CategoryGroupMember[]
}

const MAX_THUMBS = 3

/**
 * Roll granular category counts up through the existing
 * LISTING_CATEGORY_GROUPS and pick the groups worth showing.
 *
 * Grouping is the whole point: the directory's 28 live categories hold 1-5
 * listings each, so a per-category grid can only ever advertise how small it
 * is. The same listings rolled up read 17 / 8 / 6 / 6 / 5 / 5 — no inflation,
 * just a truthful unit of measurement.
 *
 * Pure by design: no I/O and no `server-only` import. This is where the real
 * logic lives, and it is the only layer this repo can unit-test.
 */
export function buildCategoryGroups(
  categoryCounts: Record<string, number>,
  photoListings: GroupThumbSource[],
  limit = 6,
): CategoryGroupSummary[] {
  const summaries: CategoryGroupSummary[] = []

  for (const group of LISTING_CATEGORY_GROUPS) {
    const memberCategories = group.categories as readonly string[]

    const members: CategoryGroupMember[] = memberCategories
      .map((label) => ({ label, count: categoryCounts[label] ?? 0 }))
      // A member with no listings is a dead end — never offer it as a chip.
      .filter((m) => m.count > 0)
      .sort((a, b) => b.count - a.count || compareStableText(a.label, b.label))
      .map((m) => ({ ...m, href: getCategoryPath(m.label) }))

    const count = members.reduce((sum, m) => sum + m.count, 0)
    // A "0 places" tile advertises emptiness, which is the problem being fixed.
    if (count === 0) continue

    const memberSet = new Set<string>(memberCategories)
    const thumbs = photoListings
      .filter((l) => memberSet.has(l.category))
      .map((l) => ({ listing: l, imageUrl: l.image_thumb_url ?? l.image_url }))
      .filter((entry): entry is { listing: GroupThumbSource; imageUrl: string } =>
        typeof entry.imageUrl === 'string' && entry.imageUrl.length > 0,
      )
      .sort(
        (a, b) =>
          (b.listing.rating ?? 0) - (a.listing.rating ?? 0) ||
          (b.listing.review_count ?? 0) - (a.listing.review_count ?? 0) ||
          compareStableText(a.listing.id, b.listing.id),
      )
      .slice(0, MAX_THUMBS)
      .map(({ listing, imageUrl }) => ({ id: listing.id, name: listing.name, imageUrl }))

    summaries.push({
      label: group.label,
      icon: group.icon,
      slug: toCategorySlug(group.label),
      count,
      thumbs,
      members,
    })
  }

  return summaries
    .sort((a, b) => b.count - a.count || compareStableText(a.label, b.label))
    .slice(0, limit)
}
