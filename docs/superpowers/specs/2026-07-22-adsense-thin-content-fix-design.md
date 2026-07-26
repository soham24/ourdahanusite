# Fix AdSense "Low Value Content" Rejection

**Date:** 2026-07-22
**Status:** Design approved, ready for implementation plan

## Summary

Google rejected the site's AdSense application citing "Low value content." A
database audit found the likely cause: two auto-generated surfaces produce a
large number of near-empty pages that Google's crawler sees as thin/doorway
content — category landing pages with only 1–2 entries, and Find directory
professional profiles with no note, no reviews, and no linked business. This
plan adds conditional `noindex` to exactly those pages, computed live from
existing data. No content is deleted, no page becomes inaccessible to
visitors, and no auto-generated filler text is added (which would itself risk
a *separate* "automatically generated content" policy violation).

## Verified findings (queried directly against the live DB before writing this spec)

- 62 approved business listings: healthy (1 has a thin description, 3 lack an
  image) — **not** part of this problem, untouched by this plan.
- 27 listing categories: **9 have exactly 1 listing.**
- 40 Find profession categories: **23 have exactly 1 professional.**
- 78 approved+active Find professional profiles: **64 already have genuine
  content** (a written note and/or real review text — both already fully
  displayed on the profile page, including verified reviewer comments).
  **13 are "truly bare"**: no note, no approved rating, no linked business —
  just name/phone/profession/locality.

## Goals

- Category pages (both `/listings/category/[slug]` and `/find/c/[slug]`)
  become non-indexable when they have fewer than 3 entries; they graduate
  back to indexable automatically once a 3rd entry is added — no manual
  re-flagging, no stored flag, computed live every time.
- The 13 truly-bare Find profiles become non-indexable; any of them graduates
  back automatically the moment its submitter adds a note or it earns its
  first approved rating.
- `sitemap.ts` never lists a URL that is simultaneously marked `noindex` —
  today it lists every category and every profile regardless of size/content.
- Zero visual or functional change for site visitors. Every affected page
  keeps rendering exactly as it does today (including "No {profession} yet —
  be the first to add one" empty states) — only its `robots` meta tag and
  sitemap presence change.

## Non-Goals (YAGNI)

- No auto-generated filler text on thin profiles or categories — explicitly
  rejected because it risks a second, distinct AdSense/webmaster violation
  ("automatically generated content").
- No changes to the 62 real business listings, to submission forms, or to
  what data is collected at submission time.
- No stored `is_indexable` column or background job — the threshold is
  cheap to compute live on every request/build (page counts are already
  small: dozens of categories, ~80 profiles), so a stored flag would only add
  staleness risk for no real performance benefit at this scale.
- No change to `/listings/[id]` (business detail pages), `/events`, or any
  other route not named above.

## Design

**Shared threshold + predicate — new file `src/lib/seo-thresholds.ts`:**

```ts
export const MIN_CATEGORY_SIZE = 3

export function isProfileIndexable(pro: {
  note: string | null
  rating_count: number
  business: unknown | null
}): boolean {
  return Boolean(pro.note?.trim()) || pro.rating_count > 0 || Boolean(pro.business)
}
```

Both category pages, both sitemap branches, and the profile page all import
from this one file, so the three places that decide "is this indexable"
can never drift out of sync with each other.

**`src/app/listings/category/[slug]/page.tsx`:** `generateMetadata` already
computes `listingCount` (`directory.listings.length`) to build the page's
description. Add, alongside the existing `!category` noindex branch:

```ts
...(listingCount < MIN_CATEGORY_SIZE ? { robots: { index: false, follow: true } } : {}),
```

(A 0-count category already resolves to a 404 via `notFound()` in the page
body, so this condition is mostly relevant for the 1–2 case, but including 0
in the same check is harmless and keeps the condition simple.)

**`src/app/find/c/[slug]/page.tsx`:** already has exactly this mechanism, just
at the wrong threshold —

```ts
...(count === 0 ? { robots: { index: false, follow: true } } : {}),
```

becomes

```ts
...(count < MIN_CATEGORY_SIZE ? { robots: { index: false, follow: true } } : {}),
```

**`src/app/find/p/[id]/page.tsx`:** `generateMetadata` already has the full
`pro: ProfessionalWithStats` object (`note`, `rating_count`, `business`) from
`getProfessionalById` — exactly the shape `isProfileIndexable` expects. Add:

```ts
...(isProfileIndexable(pro) ? {} : { robots: { index: false, follow: true } }),
```

**`src/app/sitemap.ts`:** needs to apply the same two rules before emitting
URLs, which requires two changes to what it fetches:

1. The `find_professionals` query currently selects only
   `id, updated_at, professions`. Add `note, business_listing_id`.
2. Add one more query — `find_ratings` filtered to `status = 'approved'`,
   selecting `professional_id` — to build a `Set` of professional IDs with at
   least one approved rating. (This mirrors the same two-query shape
   `find/p/[id]/page.tsx` already uses via `getApprovedRatings`, just scoped
   to existence-checking rather than fetching full rows.)

Then:

- **`categoryRoutes`** (listings): count listings per category from the
  already-fetched `sitemapListings` array (no extra query — the data is
  already in memory) and only emit a category URL when its count is
  `>= MIN_CATEGORY_SIZE`.
- **`findRoutes` category entries**: same idea — count professionals per
  profession from the already-fetched `findRows` (as today), filter to
  `>= MIN_CATEGORY_SIZE` before mapping to URLs.
- **`findRoutes` profile entries**: for each row, call
  `isProfileIndexable({ note: row.note, rating_count: ratedIds.has(row.id) ? 1 : 0, business: row.business_listing_id })`
  and only emit the URL when it returns `true`. (Passing `1`/`business_listing_id`
  as stand-ins is safe because the predicate only checks truthiness/`> 0`,
  never the actual values.)

## Testing

No test framework in this project — verification is `npx tsc --noEmit`,
`npx eslint <touched files>`, `npm run build`, plus live verification against
the actual database:

- Confirm at least one known 1-listing category (e.g. "Grocery & Shops") and
  one known 1-professional profession (e.g. "Bag Seller") render
  `noindex, follow` in their page source, and do **not** appear in
  `sitemap.xml`.
- Confirm at least one known 3+-entry category (e.g. "Arts & Crafts", 5
  listings; "Tutor/Teacher", 10 professionals) still renders `index, follow`
  and still appears in the sitemap.
- Confirm at least one known "truly bare" profile (query the DB for one
  matching the truly-bare criteria at implementation time, since the specific
  13 may have changed since this spec was written) renders `noindex, follow`
  and is absent from the sitemap.
- Confirm at least one profile with a note or rating still renders
  `index, follow` and still appears in the sitemap.
- Confirm none of the affected pages changed visually or functionally for a
  signed-out visitor (spot-check a thin category page still shows its normal
  content/empty-state, a bare profile page still renders normally with its
  call-to-action to rate/add info).
