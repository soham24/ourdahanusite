# Explore Categories Bento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage's flat ten-tile category grid with six bento tiles rolled up through the category groups that already exist, each carrying real business thumbnails and expanding in place to its member categories.

**Architecture:** A new pure module rolls `categoryCounts` up through the existing `LISTING_CATEGORY_GROUPS`, picks the top six non-empty groups, and attaches up to three photo-bearing businesses per group. `getHomeStats` gains one extra query for photo-bearing listings and exposes the result as `categoryGroups`. `CategoryGrid` becomes a client component rendering an uneven bento with expand-in-place behaviour.

**Tech Stack:** Next.js 16 App Router (Cache Components), React 19, TypeScript, Tailwind, Supabase, `node:test` via `tsx --test`.

## Global Constraints

- **This is NOT the Next.js you know.** Read the relevant guide in `node_modules/next/dist/docs/` before writing routing/caching code. Heed deprecation notices. (from `AGENTS.md`)
- **Supabase is live production.** This work is **read-only** — no migrations, no INSERT/UPDATE/DELETE. Read-only `SELECT` for verification is fine.
- Cache invalidation uses `updateTag()` via helpers in `src/lib/cache-tags.ts`, never `revalidateTag(tag, 'max')`.
- New test files must be added to the explicit list in the `test:existing` script in `package.json` — the runner does **not** glob, so an unregistered test file silently never runs.
- **Do not remove or repurpose `HomeStats.topCategoryLabels`.** `StatsBar` renders `${topCategoryLabelsLength || 8}+` from its length (`src/app/page-components/StatsBar.tsx:22`). `categoryGroups` is **added alongside** it. Removing it silently changes a homepage stat.
- **Never render a group whose count is 0.** Hospitality & Stay currently has none; a "0 places" tile worsens the exact problem this work fixes.
- Counts are phrased **"N places"**, not "N businesses".
- **No new routes and no new URLs.** Group tiles expand in place. A `/listings/group/[slug]` route is explicitly out of scope — it would add twelve duplicate listing pages, the thin-content pattern AdSense flagged.
- Verification for non-pure code: `npx tsc --noEmit`, `npx eslint <changed files>`, `npx next build`. There is no React component test framework in this repo.
- Lint must be at **parity with `main`** on touched files — do not introduce new errors, and do not fix unrelated pre-existing ones.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/category-groups.ts` (create) | Pure rollup: counts to groups, top-N selection, thumbnail and member assignment. No I/O. The unit-tested surface. |
| `src/lib/category-groups.test.ts` (create) | `node:test` coverage for the pure logic. |
| `src/lib/data/home.ts` (modify) | Fetch photo-bearing listings; expose `categoryGroups` on `HomeStats`. |
| `src/app/page-components/CategoryGrid.tsx` (rewrite) | Bento layout, thumbnails, expand-in-place. |
| `src/app/page.tsx` (modify) | Pass `categoryGroups` to `CategoryGrid`. |
| `package.json` (modify) | Register the new test file. |

---

## Task 1: Pure group rollup and selection

**Files:**
- Create: `src/lib/category-groups.ts`
- Create: `src/lib/category-groups.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `LISTING_CATEGORY_GROUPS`, `getCategoryPath`, `toCategorySlug`, `compareStableText` from `src/lib/listing-category.ts`.
- Produces:
  - `interface GroupThumbSource { id: string; name: string; category: string; image_thumb_url: string | null; image_url: string | null; rating: number | null; review_count: number | null }`
  - `interface CategoryGroupThumb { id: string; name: string; imageUrl: string }`
  - `interface CategoryGroupMember { label: string; count: number; href: string }`
  - `interface CategoryGroupSummary { label: string; icon: string; slug: string; count: number; thumbs: CategoryGroupThumb[]; members: CategoryGroupMember[] }`
  - `function buildCategoryGroups(categoryCounts: Record<string, number>, photoListings: GroupThumbSource[], limit?: number): CategoryGroupSummary[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/category-groups.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildCategoryGroups, type GroupThumbSource } from './category-groups'

function listing(over: Partial<GroupThumbSource> = {}): GroupThumbSource {
  return {
    id: 'l1',
    name: 'Test Business',
    category: 'Restaurants',
    image_thumb_url: 'https://img/thumb.jpg',
    image_url: null,
    rating: 5,
    review_count: 3,
    ...over,
  }
}

test('rolls granular categories up into their group', () => {
  const out = buildCategoryGroups({ Restaurants: 4, Cafe: 2, 'Homemade Food': 4 }, [])
  assert.equal(out.length, 1)
  assert.equal(out[0].label, 'Food & Dining')
  assert.equal(out[0].count, 10)
  assert.equal(out[0].icon, '🍽️')
})

test('excludes groups with a zero count', () => {
  // Hotels & Stay is the only member of Hospitality & Stay.
  const out = buildCategoryGroups({ Restaurants: 4, 'Hotels & Stay': 0 }, [])
  assert.deepEqual(out.map(g => g.label), ['Food & Dining'])
})

test('orders by count descending', () => {
  const out = buildCategoryGroups({ Restaurants: 2, 'Arts & Crafts': 9 }, [])
  assert.deepEqual(out.map(g => g.label), ['Arts & Crafts', 'Food & Dining'])
})

test('breaks count ties by label ascending', () => {
  const out = buildCategoryGroups(
    { 'Arts & Crafts': 5, 'Event Services': 5, 'Repair Services': 5 },
    [],
  )
  assert.deepEqual(out.map(g => g.label), [
    'Arts & Crafts',
    'Events & Entertainment',
    'Home Services',
  ])
})

test('respects the limit', () => {
  const out = buildCategoryGroups(
    { Restaurants: 9, 'Arts & Crafts': 8, 'Repair Services': 7, 'Event Services': 6 },
    [],
    2,
  )
  assert.equal(out.length, 2)
  assert.deepEqual(out.map(g => g.label), ['Food & Dining', 'Arts & Crafts'])
})

test('attaches up to three thumbnails, best rated first', () => {
  const out = buildCategoryGroups({ Restaurants: 4 }, [
    listing({ id: 'a', rating: 3, review_count: 1 }),
    listing({ id: 'b', rating: 5, review_count: 9 }),
    listing({ id: 'c', rating: 5, review_count: 2 }),
    listing({ id: 'd', rating: 4, review_count: 1 }),
  ])
  assert.deepEqual(out[0].thumbs.map(t => t.id), ['b', 'c', 'd'])
})

test('falls back to image_url when image_thumb_url is missing', () => {
  const out = buildCategoryGroups({ Restaurants: 1 }, [
    listing({ id: 'a', image_thumb_url: null, image_url: 'https://img/full.jpg' }),
  ])
  assert.equal(out[0].thumbs[0].imageUrl, 'https://img/full.jpg')
})

test('never selects a listing with no image at all', () => {
  const out = buildCategoryGroups({ Restaurants: 2 }, [
    listing({ id: 'a', image_thumb_url: null, image_url: null }),
    listing({ id: 'b' }),
  ])
  assert.deepEqual(out[0].thumbs.map(t => t.id), ['b'])
})

test('ignores listings whose category is outside the group', () => {
  const out = buildCategoryGroups({ Restaurants: 1 }, [
    listing({ id: 'x', category: 'Arts & Crafts' }),
  ])
  assert.deepEqual(out[0].thumbs, [])
})

test('lists only live member categories, with links', () => {
  const out = buildCategoryGroups({ Restaurants: 4, Cafe: 2, 'Dairy & Milk': 0 }, [])
  assert.deepEqual(out[0].members.map(m => m.label), ['Restaurants', 'Cafe'])
  assert.equal(out[0].members[0].count, 4)
  assert.equal(out[0].members[0].href, '/listings/category/restaurants')
})

test('empty input produces empty output', () => {
  assert.deepEqual(buildCategoryGroups({}, []), [])
})
```

- [ ] **Step 2: Register the test file**

In `package.json`, append `src/lib/category-groups.test.ts` to the end of the `test:existing` script's file list. **Copy the existing value and append** — do not retype it from this plan, in case other test files have been added since this plan was written. The runner takes an explicit list; a file left out never runs.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx tsx --test src/lib/category-groups.test.ts`
Expected: FAIL — cannot resolve module `./category-groups`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/category-groups.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsx --test src/lib/category-groups.test.ts`
Expected: PASS, 10/10.

- [ ] **Step 6: Run the full suite and lint**

Run: `npm test`
Expected: all pass, including the pre-existing suites.

Run: `npx eslint src/lib/category-groups.ts src/lib/category-groups.test.ts`
Expected: no output.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/category-groups.ts src/lib/category-groups.test.ts package.json
git commit -m "feat(home): add pure category-group rollup with tests"
```

---

## Task 2: Expose `categoryGroups` from the cached homepage query

**Files:**
- Modify: `src/lib/data/home.ts`

**Interfaces:**
- Consumes: `buildCategoryGroups`, `GroupThumbSource`, `CategoryGroupSummary` from Task 1.
- Produces: `HomeStats.categoryGroups: CategoryGroupSummary[]`.

- [ ] **Step 1: Add the import and extend the interface**

In `src/lib/data/home.ts`, add to the imports:

```ts
import {
  buildCategoryGroups,
  type CategoryGroupSummary,
  type GroupThumbSource,
} from '@/lib/category-groups'
```

Extend `HomeStats` — **add** the field, leaving `topCategoryLabels` in place. `StatsBar` renders its length as the homepage "categories" stat; removing it silently changes that number:

```ts
export interface HomeStats {
  totalListings: number
  featuredListing: FeaturedListing | null
  categoryCounts: Record<string, number>
  topCategoryLabels: string[]
  categoryGroups: CategoryGroupSummary[]
}
```

- [ ] **Step 2: Add the field to the empty fallback**

Find the `const empty: HomeStats = { ... }` object and add `categoryGroups: []` so the fallback still satisfies the type:

```ts
  const empty: HomeStats = {
    totalListings: 0,
    featuredListing: null,
    categoryCounts: {},
    topCategoryLabels: FALLBACK_TOP_CATEGORIES,
    categoryGroups: [],
  }
```

- [ ] **Step 3: Fetch photo-bearing listings and build the groups**

Inside the same `try` block that already builds `categoryCounts`, after `topCategoryLabels` is computed, add the fetch and the rollup.

One query for all approved listings, grouped in JS. The whole directory is 64 rows, so this is cheaper and simpler than one query per group:

```ts
    // Thumbnails for the bento tiles. buildCategoryGroups re-sorts per group,
    // but ordering here too keeps the row cap meaningful rather than arbitrary.
    const { data: thumbData } = await supabase
      .from('listings')
      .select('id, name, category, image_thumb_url, image_url, rating, review_count')
      .eq('approved', true)
      .not('category', 'is', null)
      .order('rating', { ascending: false, nullsFirst: false })
      .order('review_count', { ascending: false })
      .order('id', { ascending: true })
      .limit(200)

    const categoryGroups = buildCategoryGroups(
      categoryCounts,
      (thumbData ?? []) as unknown as GroupThumbSource[],
    )
```

Then add `categoryGroups` to the returned object:

```ts
    return {
      totalListings: stats.total_listings ?? 0,
      featuredListing: stats.featured_listing ?? null,
      categoryCounts,
      topCategoryLabels,
      categoryGroups,
    }
```

- [ ] **Step 4: Verify it compiles and the data is right**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint src/lib/data/home.ts`
Expected: no output.

Confirm the expected rollup against production with a read-only query (Supabase MCP `execute_sql`, project_id `slmbqngmxketyxjauxxk`):

```sql
select category, count(*) n from listings where approved = true
group by category order by n desc;
```

Expected at time of writing: 28 categories, Arts & Crafts 5 at the top, 64 rows total. Rolled up through the groups this must yield Food & Dining 17, Shopping & Retail 8, Digital & Creative 6, Health & Wellness 6, Arts & Crafts 5, Events & Entertainment 5 — the six the UI will render. If the live numbers have moved since, use what you observe and note it in your report.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/home.ts
git commit -m "feat(home): expose category group rollups with thumbnails"
```

---

## Task 3: Bento layout with expand-in-place

**Files:**
- Modify: `src/app/page-components/CategoryGrid.tsx` (full rewrite)
- Modify: `src/app/page.tsx` (the `<CategoryGrid ... />` element, currently lines 105-108)

**Interfaces:**
- Consumes: `CategoryGroupSummary` from Task 1, `HomeStats.categoryGroups` from Task 2.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Check how existing sections render listing images**

Before writing any image markup, read how a sibling section renders a listing thumbnail so the new tiles use the same mechanism and the same allowed image host:

Run: `grep -n "Image\|img" src/app/page-components/PopularBusinesses.tsx | head -20`
Run: `grep -n "remotePatterns" -A 15 next.config.ts`

Use whatever the sibling uses — `next/image` if that is what it uses and the host is in `remotePatterns`, or a plain `<img>` if that is the established pattern. **Do not add a new domain to `next.config.ts` unilaterally.** If images cannot be rendered with the existing setup, stop and report.

- [ ] **Step 2: Rewrite the component**

Replace the contents of `src/app/page-components/CategoryGrid.tsx`. The code below uses `next/image`; if Step 1 showed the sibling uses a plain `<img>`, swap the `<Image ... fill sizes="32px" />` for `<img src={thumb.imageUrl} alt="" className="h-full w-full object-cover" />` and drop the `next/image` import.

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, ChevronDown } from 'lucide-react'

import SafeAppLink from '@/components/SafeAppLink'
import SectionHeader from '@/components/ui/SectionHeader'
import type { CategoryGroupSummary } from '@/lib/category-groups'

interface CategoryGridProps {
  groups: CategoryGroupSummary[]
}

/** The first tile carries the most listings, so it earns the wide slot. */
function tileSpanClass(index: number): string {
  return index === 0 ? 'col-span-2' : ''
}

function Thumbs({ group }: { group: CategoryGroupSummary }) {
  // Fewer than two reads as a lopsided fragment rather than a mosaic, so the
  // tile shows its icon alone instead.
  if (group.thumbs.length < 2) return null

  const remainder = group.count - group.thumbs.length

  return (
    <div className="mt-3 flex items-center justify-center">
      <div className="flex -space-x-2">
        {group.thumbs.map((thumb) => (
          <span
            key={thumb.id}
            className="relative block h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[var(--color-surface-soft)] shadow-sm"
            title={thumb.name}
          >
            <Image src={thumb.imageUrl} alt="" fill sizes="32px" className="object-cover" />
          </span>
        ))}
      </div>
      {remainder > 0 && (
        <span className="ml-2 text-[11px] font-semibold text-[var(--color-text-muted)]">
          +{remainder}
        </span>
      )}
    </div>
  )
}

export default function CategoryGrid({ groups }: CategoryGridProps) {
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  if (groups.length === 0) return null

  return (
    <section
      className="relative py-16"
      style={{
        background: 'linear-gradient(180deg, var(--color-bg) 0%, #F4EADC 100%)',
      }}
    >
      <div className="relative max-w-[1160px] mx-auto px-6">
        <SectionHeader
          label="Browse by need"
          title="Explore Categories"
          sub="One clear place to jump into food, shops, services, health and more"
          viewAllHref="/listings"
        />

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {groups.map((group, index) => {
            const isOpen = openSlug === group.slug
            return (
              <div key={group.slug} className={tileSpanClass(index)}>
                <button
                  type="button"
                  onClick={() => setOpenSlug(isOpen ? null : group.slug)}
                  aria-expanded={isOpen}
                  className="group relative w-full h-full bg-white border border-[var(--color-border)] rounded-2xl p-5 text-center transition-all duration-300 hover:border-[rgba(192,88,46,0.45)] hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(192,88,46,0.14)] overflow-hidden"
                >
                  <span
                    className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(240,200,122,0.45) 0%, transparent 70%)',
                    }}
                    aria-hidden
                  />

                  <div
                    className="relative mx-auto mb-3 flex items-center justify-center w-14 h-14 rounded-2xl border border-[rgba(192,88,46,0.18)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]"
                    style={{
                      background: 'linear-gradient(135deg, #FBF0DC 0%, #F0D9B0 100%)',
                      boxShadow: 'inset 0 -2px 4px rgba(192,88,46,0.08)',
                    }}
                  >
                    <span className="text-[28px] leading-none" aria-hidden>
                      {group.icon}
                    </span>
                  </div>

                  <div className="relative text-[13px] font-bold text-[var(--color-bark)] leading-[1.3] group-hover:text-[var(--color-brand-strong)] transition-colors">
                    {group.label}
                  </div>
                  <div className="relative text-[11px] text-[var(--color-text-muted)] mt-1 font-medium">
                    <span className="text-[var(--color-brown)]">{group.count}</span> places
                  </div>

                  <Thumbs group={group} />

                  <span className="relative mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-brand)]">
                    {isOpen ? 'Hide' : 'See inside'}
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-2 flex flex-wrap gap-2 rounded-2xl border border-[var(--color-border)] bg-white/70 p-3">
                    {group.members.map((member) => (
                      <SafeAppLink
                        key={member.href}
                        href={member.href}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--color-bark)] transition-colors hover:border-[rgba(192,88,46,0.45)] hover:text-[var(--color-brand-strong)]"
                      >
                        {member.label}
                        <span className="text-[var(--color-text-muted)]">{member.count}</span>
                        <ArrowUpRight size={11} />
                      </SafeAppLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

The first tile is `col-span-2` at every breakpoint: on mobile's 2-column grid that makes Food & Dining full-width, and on desktop's 4-column grid it takes half the row — both of which the spec asks for.

- [ ] **Step 3: Update the call site**

In `src/app/page.tsx`, replace the `<CategoryGrid ... />` element with:

```tsx
      <CategoryGrid groups={stats.categoryGroups} />
```

Leave the `StatsBar` element above it untouched — it still reads `stats.topCategoryLabels.length`.

- [ ] **Step 4: Verify it compiles, lints and builds**

Run: `npx tsc --noEmit`
Expected: no output.

Establish the lint baseline first, because `page.tsx` has pre-existing findings:

Run: `git stash && npx eslint src/app/page.tsx; git stash pop`

Then: `npx eslint src/app/page-components/CategoryGrid.tsx src/app/page.tsx`
Expected: parity with that baseline — no new errors or warnings. Do not fix unrelated pre-existing issues.

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 5: Verify in the browser**

Start the preview (`mcp__Claude_Browser__preview_start` with the `dev` launch config) and open `http://localhost:3000/`.

The homepage streams, so `curl` returns only the shell — assert against the live DOM, not the SSR HTML. Confirm:

- Exactly **6** group tiles render
- The first tile is **Food & Dining**, reads **"17 places"**, and is visually wider than the others
- Tile order is Food & Dining, Shopping & Retail, Digital & Creative, Health & Wellness, Arts & Crafts, Events & Entertainment
- **No tile reads "0 places"**, and Hospitality & Stay is absent
- Every tile shows at least 2 thumbnails, and no image is broken — `[...document.querySelectorAll('section img')].filter(i => i.complete && i.naturalWidth === 0)` should be empty
- Clicking a tile reveals member-category chips; clicking again hides them; the chips link to `/listings/category/...`
- Clicking a second tile closes the first (only one open at a time)

Check `read_console_messages` for errors. Then run `resize_window` to the `mobile` preset (375px) and confirm the grid is 2 columns with Food & Dining spanning both.

- [ ] **Step 6: Commit**

```bash
git add src/app/page-components/CategoryGrid.tsx src/app/page.tsx
git commit -m "feat(home): bento category tiles with thumbnails and expand-in-place"
```

---

## Self-Review

**Spec coverage** — every section of `2026-09-07-explore-categories-bento-design.md` maps to a task:

| Spec section | Task |
|---|---|
| Grouping via existing `LISTING_CATEGORY_GROUPS` | Task 1 |
| Top six by count, zero-count groups excluded | Task 1 (tests: exclusion, ordering, limit) |
| Tie-break by label ascending | Task 1 (explicit test) |
| Thumbnails: photo-bearing, rating desc then reviews desc then id | Task 1 (tests incl. `image_url` fallback, no-image exclusion) |
| Fewer than two photos: icon only, no broken image | Task 1 (`thumbs` may be short) + Task 3 (`Thumbs` returns null under 2) |
| Data from cached `getHomeStats`, no new page fetch | Task 2 |
| `topCategoryLabels` preserved for `StatsBar` | Task 2 Step 1 + Global Constraints |
| Bento layout, wide first tile, mobile 2-col | Task 3 Steps 2 and 5 |
| "N places" copy | Task 3 Step 2 |
| Expand in place, live members only, no new routes | Task 1 (`members` filtered) + Task 3 Step 2 |
| "Browse all" link retained | Task 3 (`SectionHeader viewAllHref="/listings"`) |
| No migrations, read-only | Global Constraints; Task 2 Step 4 uses `SELECT` only |

**Placeholder scan** — no TBD/TODO. Task 3 Step 1 deliberately stops rather than guessing at an image-host config change; that is a real decision point, not a deferred detail. Task 1 Step 2 says to copy-and-append the existing `test:existing` value rather than retyping it, since other test files may have been added since this plan was written.

**Type consistency** — `CategoryGroupSummary` fields (`label`, `icon`, `slug`, `count`, `thumbs`, `members`) are defined once in Task 1 and used with those exact names in Tasks 2 and 3. `CategoryGroupThumb` (`id`, `name`, `imageUrl`) matches the `Thumbs` component's usage. `GroupThumbSource` field names are snake_case to match the Supabase row shape, and Task 2's `.select(...)` lists exactly those columns. `buildCategoryGroups(counts, listings, limit?)` is called with two arguments in Task 2 and tested with both two and three in Task 1.

**Ordering** — Task 3 depends on Task 2's `stats.categoryGroups`, which depends on Task 1's `buildCategoryGroups`. The tasks run in order; each is independently reviewable, but none can be verified before its predecessor lands.
