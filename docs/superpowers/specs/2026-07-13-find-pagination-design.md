# Find Directory — Pagination, Infinite Scroll & Instant Filtering

**Date:** 2026-07-13
**Status:** Design approved, ready for implementation plan

## Summary

The find landing (`/find`) currently renders **every** approved professional on
each request. That is invisible at ~50 rows but does not scale to the ~1000+
the directory is heading toward (huge HTML payload, 1000 DOM nodes, slow first
paint on low-end mobile). This change moves to **server-render page 1 → client
component owns filtering + infinite scroll**, slicing on top of the existing
hourly-cached directory. Category filtering and search become **instant**
(client-driven, no full-page navigation). DB reads stay ~zero — everything is
in-memory array work over the cached data.

## Goals

- Render only ~24 cards at first paint (and only ~24 more per scroll), never the
  whole directory.
- Category tap and search are **instant** (no navigation, no skeleton flash from
  a server round-trip beyond the small cache-backed slice fetch).
- Infinite scroll appends the next page as the user nears the bottom.
- Preserve SSR first paint, SEO, and shareable/deep-linked URLs.
- Zero additional database reads — pagination/filter/search all slice the cached
  directory in memory.
- Scales cleanly to 1000+ professionals.

## Non-Goals (YAGNI)

- No DB-side pagination / cursor queries — the cached in-memory array is sliced.
  (Revisit only at true scale, e.g. many thousands + heavy ratings, when caching
  the whole directory in memory or aggregating ratings per-request stops being
  cheap. Documented, not built.)
- No "Load more" button — infinite scroll only (chosen).
- No back-button stepping through filters — URL is kept current via
  `replaceState` (shareable) but filter changes don't push history entries.
- No change to the detail page, submit flow, admin, or the cached data source.

## Architecture

**First load — `src/app/find/page.tsx` (server component):**
Reads URL params (`q`, `profession`, `sort`), fetches **page 1** via the data
layer, and renders `<FindResults initialItems initialTotal q profession sort />`
(a client component) plus the hero. Category counts (`getProfessionCounts`) are
passed in for the grid. This preserves SSR first paint, SEO, and deep links
(`/find?profession=Doctor` server-renders Doctor's page 1).

**After hydration — `src/app/find/FindResults.tsx` (client, new):**
Owns `items`, `total`, `filters ({ q, profession, sort })`, `loading`. Renders
the category grid, search box, sort toggle, results count, and the card list.
- Category tap / search (debounced ~250ms) / sort change → set `filters` →
  `fetchFindPage(filters, offset=0)` → replace list + `history.replaceState` the
  URL.
- Scroll near bottom (IntersectionObserver sentinel) → `fetchFindPage(filters,
  offset=items.length)` → append. Stops when `items.length >= total`.
- Each fetch carries a monotonically increasing request id; stale responses are
  dropped (no flicker from fast typing).

**Server action — `src/app/actions/find.ts` (`'use server'`):**
`fetchFindPage({ q, profession, sort, offset }): Promise<{ items:
ProfessionalWithStats[]; total: number }>`. Public (no auth). Thin wrapper over
`getApprovedProfessionals` (cache-backed) — no DB read; just filters/sorts/slices
the cached array. (This is a `'use server'` file that may export ONLY async
functions.)

**Data layer — `src/lib/data/find.ts`:**
- `getApprovedProfessionals(opts)` gains `offset?`/`limit?` and returns
  `{ items: ProfessionalWithStats[]; total: number }` (was a bare array). It
  filters + sorts the cached array as today, then `total = filtered.length` and
  `items = filtered.slice(offset ?? 0, (offset ?? 0) + (limit ?? filtered.length))`.
- `FIND_PAGE_SIZE = 24` exported constant, used by the page and action.

**Card — `src/app/find/FindCard.tsx` (client, new):**
The current `Card` (premium + basic branches) extracted from `page.tsx` so
`FindResults` renders it for both initial and appended items. Its pieces
(`TrackedContactLink`, `Monogram`/`BusinessAvatar`, `GoldStars`, `businessHref`,
`professionLabels`, `Mr`, `PremiumBadge`, `VisitBusinessLink`) are already
client-safe.

**Absorbed:** `CategoryGridClient` and `FindSearchControls` fold into (or are
driven by) `FindResults` — the category grid and search look identical but their
actions become state updates instead of `<Link>`/`router.push` navigation.

## Behavior & States

- **Premium pinning:** automatic — the existing premium-first sort already puts
  business-linked professionals at the top of page 1 (and of a filtered
  category's page 1). No special logic.
- **Loading:** initial page SSR'd (no spinner). Filter/search swaps in the
  existing skeleton grid while `fetchFindPage` resolves. Infinite-scroll appends
  show a short skeleton row at the bottom.
- **End of list:** at `items.length >= total`, the observer stops; no endless
  spinner.
- **Empty:** unchanged "No matches / Nobody here yet" card when `total === 0`.
- **Count + sort:** existing "N professionals · Category" line + Top-rated/Newest
  toggle, driven by `filters`/`total`.
- **URL sync:** `history.replaceState` on filter/search/sort change keeps
  `/find?profession=…&q=…&sort=…` current and shareable, no navigation/history
  spam. Back button leaves `/find` (accepted trade-off).
- **Accessibility:** search/category/sort keep current a11y; the scroll sentinel
  is `aria-hidden`; an `aria-live="polite"` region announces "Showing N of M".

## Error Handling

- `fetchFindPage` never throws to the client: on an unexpected error it returns
  `{ items: [], total: <current-or-0> }` and the client keeps the existing list
  (an append failure is a no-op; a filter-change failure shows the empty state).
- Stale-response guard (request id) prevents out-of-order list replacement.
- The initial SSR page is independent of the client fetch path, so JS-disabled /
  pre-hydration users still see page 1.

## Testing / Verification

No test framework — `npx tsc --noEmit` + `npm run build` + live checks on
`find.localhost:3000`. Because real data is ~50 rows, temporarily seed a couple
hundred throwaway `find_professionals` rows (clearly-marked names) to exercise:
- page-1 render (~24 cards, not all),
- infinite scroll appends the next pages and stops at the end,
- instant category filter + instant (debounced) search replace the list with no
  full-page navigation,
- premium-linked professionals still sort first,
- URL stays in sync and a deep link (`/find?profession=…`) SSRs correctly,
- empty state on a no-match search.
Then delete ONLY the seeded rows (matched by their marker) — never touch real
data. Supabase is live production.
