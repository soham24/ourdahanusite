/**
 * Shared rules for whether an auto-generated page has enough real content to
 * be worth indexing. Both category pages, the Find profile page, and
 * sitemap.ts import from here so none of them can silently drift out of sync
 * with each other — a page that says `noindex` on itself must also be
 * missing from the sitemap, and vice versa.
 */

// A category landing page (business category or Find profession) needs at
// least this many entries before it reads as a real category rather than a
// near-empty doorway page.
export const MIN_CATEGORY_SIZE = 3

/**
 * A Find professional profile is "indexable" once it has at least one of:
 * a written note, an approved rating, or a linked (verified) business page.
 * Profiles with none of these are just a name/phone/profession/locality
 * card — real, but not enough unique content to be worth search-indexing.
 */
export function isProfileIndexable(pro: {
  note: string | null
  rating_count: number
  business: unknown | null
}): boolean {
  return Boolean(pro.note?.trim()) || pro.rating_count > 0 || Boolean(pro.business)
}
