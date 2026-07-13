# Find Pagination + Infinite Scroll + Instant Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render page 1 (~24 cards) at first paint, then let a client component filter/search instantly and infinite-scroll more — slicing the already-cached directory, never rendering 1000 cards or hitting the DB.

**Architecture:** The cached `getFindDirectory` is unchanged. `getApprovedProfessionals` gains offset/limit and returns `{ items, total }`. A public `'use server'` action `fetchFindPage` returns a page from the cache. `page.tsx` server-renders page 1 into a client `FindDirectory` that owns filter state, instant search, category filtering, sort, URL sync, and IntersectionObserver infinite scroll.

**Tech Stack:** Next.js 16.2.1 (App Router, `'use cache'`, server actions, client components), React 19, Supabase (public client, cached), Tailwind v4, lucide-react.

## Global Constraints

- **No test framework** — verify with `npx tsc --noEmit`, `npm run build`, running `find.localhost:3000`. Do NOT add a test runner.
- `src/lib/data/find.ts` is `'use cache'`; **do not touch `getFindDirectory`'s cache primitives**. Pagination is pure in-memory slicing over its result — **no new DB reads**.
- `src/app/actions/find.ts` is a `'use server'` module — it may export ONLY async functions. Importing consts/types INTO it is fine; do not re-export types from it.
- Premium-first sort already exists in `getApprovedProfessionals` — keep it; premium cards therefore land on page 1 automatically.
- **Supabase is LIVE production.** The only DB writes in this plan are temporary seed rows for scale-testing, deleted immediately after by their marker. Never touch real rows.
- Design-system tokens/classes only; reuse existing `find-ui.tsx` pieces and the current card/skeleton/empty markup verbatim (this is a restructure, not a redesign — the UI must look the same, just paginated).
- Commit after each task; end messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Do NOT commit `.superpowers/`, `next-env.d.ts`, or package.json/lock churn.

---

## File Structure

**Create:**
- `src/app/find/FindCard.tsx` — client card (extracted from `page.tsx`'s `Card`).
- `src/app/find/FindDirectory.tsx` — client orchestrator: filter state, instant search, category filter, sort, URL sync, infinite scroll, renders search box + category grid + results.

**Modify:**
- `src/lib/data/find.ts` — `getApprovedProfessionals` → `{ items, total }` + `offset`/`limit`; export `FIND_PAGE_SIZE`, `FindPage`.
- `src/app/actions/find.ts` — add `fetchFindPage`.
- `src/app/find/CategoryGridClient.tsx` — callback-driven (buttons) instead of `<Link>`s.
- `src/app/find/FindSearchControls.tsx` — controlled instant search input (value + onChange) instead of submit→navigate.
- `src/app/find/page.tsx` — server-fetch page 1 + counts, render `<FindDirectory>`; drop the server `Card`/`ProfessionalList`/`SortToggle`/`CategoryGrid` wiring that moves client-side.

---

## Task 1: Data layer — paginated `{ items, total }`

**Files:**
- Modify: `src/lib/data/find.ts`
- Modify: `src/app/find/page.tsx` (update the single caller so the build stays green)

**Interfaces:**
- Produces: `FIND_PAGE_SIZE = 24`; `interface FindPage { items: ProfessionalWithStats[]; total: number }`; `getApprovedProfessionals(opts: { q?; profession?; sort?; offset?; limit? }): Promise<FindPage>`.

- [ ] **Step 1: Change the return shape + add offset/limit**

In `src/lib/data/find.ts`, add near the top (after imports):

```ts
export const FIND_PAGE_SIZE = 24

export interface FindPage {
  items: ProfessionalWithStats[]
  total: number
}
```

Replace the `getApprovedProfessionals` signature + its final `return [...pros].sort(...)` so it sorts into a local, then slices:

```ts
export async function getApprovedProfessionals(
  opts: { q?: string; profession?: string; sort?: FindSort; offset?: number; limit?: number } = {},
): Promise<FindPage> {
  let pros = await getFindDirectory()

  if (opts.profession && opts.profession !== 'All') {
    pros = pros.filter((p) => p.professions.includes(opts.profession!))
  }

  const cleaned = opts.q?.trim().toLowerCase()
  if (cleaned) {
    pros = pros.filter((p) => matchesQuery(p, cleaned))
  }

  const sort: FindSort = opts.sort === 'new' ? 'new' : 'top'
  const sorted = [...pros].sort((a, b) => {
    const ap = a.business ? 0 : 1
    const bp = b.business ? 0 : 1
    if (ap !== bp) return ap - bp
    if (sort === 'top') {
      if (b.avg_rating !== a.avg_rating) return b.avg_rating - a.avg_rating
      if (b.rating_count !== a.rating_count) return b.rating_count - a.rating_count
    }
    return b.created_at.localeCompare(a.created_at)
  })

  const offset = opts.offset ?? 0
  const items = opts.limit != null ? sorted.slice(offset, offset + opts.limit) : sorted.slice(offset)
  return { items, total: sorted.length }
}
```

(With no `offset`/`limit`, `items` is the full sorted list — so existing callers keep working after Step 2.)

- [ ] **Step 2: Update the page caller so it compiles**

In `src/app/find/page.tsx`, the `ProfessionalList` function currently does `const pros = await getApprovedProfessionals({ q, profession, sort })` then uses `pros.length` / `pros.map`. Change the first line and the two references:

```tsx
  const { items: pros, total } = await getApprovedProfessionals({ q, profession, sort })
  if (total === 0) return <EmptyState filtered={!!(q || profession)} />
```

and in the count line replace `{pros.length}` with `{total}` and `{pros.length !== 1 ...}` with `{total !== 1 ? 's' : ''}`. `pros.map(...)` stays (it's now the items array; unbounded here — still renders all, unchanged UX until Task 4 paginates).

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass; `/find` still renders every card (unchanged behavior).

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/find.ts src/app/find/page.tsx
git commit -m "feat(find): paginate getApprovedProfessionals ({ items, total } + offset/limit)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `fetchFindPage` server action

**Files:**
- Modify: `src/app/actions/find.ts`

**Interfaces:**
- Consumes: `getApprovedProfessionals`, `FIND_PAGE_SIZE`, `FindPage`, `FindSort` (Task 1).
- Produces: `fetchFindPage(input: { q?; profession?; sort?; offset? }): Promise<FindPage>` (public, cache-backed, never throws).

- [ ] **Step 1: Add the action**

In `src/app/actions/find.ts`, add the import at the top with the others:

```ts
import { getApprovedProfessionals, FIND_PAGE_SIZE, type FindPage, type FindSort } from '@/lib/data/find'
```

Add at the end of the file (it's a `'use server'` module — this is an async function, allowed):

```ts
// Public paginated read for the find directory's client-side filtering +
// infinite scroll. Reads the cached directory (no DB) and returns one page.
// Never throws to the client — an empty page keeps the UI stable.
export async function fetchFindPage(input: {
  q?: string
  profession?: string
  sort?: FindSort
  offset?: number
}): Promise<FindPage> {
  try {
    return await getApprovedProfessionals({
      q: input.q,
      profession: input.profession,
      sort: input.sort,
      offset: input.offset ?? 0,
      limit: FIND_PAGE_SIZE,
    })
  } catch {
    return { items: [], total: 0 }
  }
}
```

- [ ] **Step 2: Type-check + build + commit**

Run: `npx tsc --noEmit` then `npm run build`
Expected: pass.

```bash
git add src/app/actions/find.ts
git commit -m "feat(find): fetchFindPage server action (cache-backed paginated read)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Extract `FindCard` (client component)

**Files:**
- Create: `src/app/find/FindCard.tsx`
- Modify: `src/app/find/page.tsx` (use `FindCard`, remove the inline `Card`)

**Interfaces:**
- Consumes: `ProfessionalWithStats`; existing `find-ui` exports; `TrackedContactLink`.
- Produces: `export default function FindCard({ p }: { p: ProfessionalWithStats })`.

- [ ] **Step 1: Create FindCard**

Create `src/app/find/FindCard.tsx` with `'use client'` at the top, then the EXACT body of the current `Card` function in `src/app/find/page.tsx` (lines 76–168 — the `<article>…</article>`), plus its imports. The file:

```tsx
'use client'

import Link from 'next/link'
import { MapPin, MessageCircle, Phone } from 'lucide-react'
import type { ProfessionalWithStats } from '@/lib/find/types'
import TrackedContactLink from './TrackedContactLink'
import {
  BusinessAvatar,
  GoldStars,
  Monogram,
  Mr,
  premiumCardClass,
  PremiumBadge,
  professionLabels,
  telHref,
  VisitBusinessLink,
  waHref,
} from './find-ui'

export default function FindCard({ p }: { p: ProfessionalWithStats }) {
  return (
    // ← paste the current Card's <article>…</article> JSX here verbatim (page.tsx lines 78–166)
  )
}
```

Paste the `<article>` block from the current `page.tsx` `Card` unchanged.

- [ ] **Step 2: Use FindCard in page.tsx, delete inline Card**

In `src/app/find/page.tsx`: delete the `Card` function (lines 76–168) and add `import FindCard from './FindCard'`. In `ProfessionalList`, change `<Card key={p.id} p={p} />` to `<FindCard key={p.id} p={p} />`. Remove now-unused imports from `page.tsx` that only `Card` used (`MapPin`, `MessageCircle`, `Phone`, `TrackedContactLink`, `BusinessAvatar`, `Monogram`, `premiumCardClass`, `PremiumBadge`, `professionLabels`, `telHref`, `VisitBusinessLink`, `waHref`) — but KEEP any still used elsewhere in `page.tsx` (`GoldStars` is not used outside Card; `Mr` IS still used in the count line; `SearchX`, `ShieldCheck` still used). Run eslint to confirm no unused-import warnings remain.

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc --noEmit`, `npx eslint src/app/find/page.tsx src/app/find/FindCard.tsx`, `npm run build`
Expected: all pass, no unused-import warnings, `/find` visually identical.

- [ ] **Step 4: Commit**

```bash
git add src/app/find/FindCard.tsx src/app/find/page.tsx
git commit -m "refactor(find): extract FindCard client component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Client orchestrator — instant filter/search + infinite scroll

**Files:**
- Modify: `src/app/find/CategoryGridClient.tsx` (callback-driven)
- Modify: `src/app/find/FindSearchControls.tsx` (controlled instant input)
- Create: `src/app/find/FindDirectory.tsx`
- Modify: `src/app/find/page.tsx` (server-fetch page 1 + counts, render `<FindDirectory>`)

**Interfaces:**
- Consumes: `fetchFindPage` (Task 2), `FindCard` (Task 3), `FIND_PAGE_SIZE`/`FindSort` (Task 1), `getApprovedProfessionals`/`getProfessionCounts`, `professionMarathi`, `PROFESSIONS`, `find-ui` chip styles + `Mr`.
- Produces: `FindDirectory` owning the full interactive directory.

- [ ] **Step 1: Make CategoryGridClient callback-driven**

Replace `src/app/find/CategoryGridClient.tsx` so tiles are `<button>`s calling `onSelect` instead of `<Link>`s (keeps the mobile "Show all" collapse):

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { chipOff, chipOn, Mr } from './find-ui'

export interface CategoryTile {
  label: string
  mr: string | null
  count: number
}

const tileBase =
  'flex items-center justify-between gap-2 rounded-[14px] border px-3.5 py-2.5 text-sm font-semibold transition-colors duration-150 active:scale-[0.98]'
const MOBILE_VISIBLE = 7

export default function CategoryGridClient({
  tiles,
  total,
  active,
  onSelect,
}: {
  tiles: CategoryTile[]
  total: number
  active: string | null
  onSelect: (profession: string | null) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const collapsible = tiles.length > MOBILE_VISIBLE

  return (
    <nav aria-label="Filter by profession" className="mt-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-current={!active ? 'page' : undefined}
          className={`${tileBase} ${!active ? chipOn : chipOff}`}
        >
          <span>All</span>
          <span className="shrink-0 text-xs font-bold tabular-nums opacity-70">{total}</span>
        </button>
        {tiles.map((t, i) => {
          const on = active === t.label
          const collapsedOnMobile = collapsible && !showAll && i >= MOBILE_VISIBLE && !on
          return (
            <button
              type="button"
              key={t.label}
              onClick={() => onSelect(t.label)}
              aria-current={on ? 'page' : undefined}
              className={`${collapsedOnMobile ? 'hidden sm:flex' : 'flex'} ${tileBase} ${on ? chipOn : chipOff}`}
            >
              <span className="min-w-0 truncate">
                {t.label} <Mr text={t.mr} />
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums opacity-70">{t.count}</span>
            </button>
          )
        })}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-[14px] border border-dashed border-[var(--od-border)] py-2 text-[13px] font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand-strong)] sm:hidden"
        >
          {showAll ? (<>Show fewer categories <ChevronUp size={14} aria-hidden /></>) : (<>Show all {tiles.length} categories <ChevronDown size={14} aria-hidden /></>)}
        </button>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: Make FindSearchControls a controlled instant input**

Replace `src/app/find/FindSearchControls.tsx`:

```tsx
'use client'

import { Search, X } from 'lucide-react'

export default function FindSearchControls({
  value,
  onChange,
}: {
  value: string
  onChange: (q: string) => void
}) {
  return (
    <div role="search" className="relative">
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--od-muted)]"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, area, or keyword…"
        aria-label="Search professionals"
        className="od-input h-12 w-full pl-10 pr-10 text-[15px] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--od-muted)] transition-colors hover:bg-[var(--color-gray-100)]"
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create FindDirectory**

Create `src/app/find/FindDirectory.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { fetchFindPage } from '@/app/actions/find'
import { professionMarathi } from '@/lib/find/professions'
import type { FindSort } from '@/lib/data/find'
import type { ProfessionalWithStats } from '@/lib/find/types'
import CategoryGridClient, { type CategoryTile } from './CategoryGridClient'
import FindSearchControls from './FindSearchControls'
import FindCard from './FindCard'
import { Mr } from './find-ui'

interface Filters {
  q: string
  profession: string | null
  sort: FindSort
}

function buildUrl(f: Filters): string {
  const sp = new URLSearchParams()
  if (f.q.trim()) sp.set('q', f.q.trim())
  if (f.profession) sp.set('profession', f.profession)
  if (f.sort === 'new') sp.set('sort', 'new')
  const s = sp.toString()
  return s ? `/find?${s}` : '/find'
}

function CardSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="od-card animate-pulse p-5" aria-hidden>
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-[14px] bg-[var(--color-gray-100)]" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-2/5 rounded bg-[var(--color-gray-100)]" />
              <div className="h-3 w-3/5 rounded bg-[var(--color-gray-100)]" />
            </div>
          </div>
          <div className="mt-5 h-9 rounded-xl bg-[var(--color-gray-100)]" />
        </div>
      ))}
    </>
  )
}

export default function FindDirectory({
  initialItems,
  initialTotal,
  initialFilters,
  categories,
  categoriesTotal,
}: {
  initialItems: ProfessionalWithStats[]
  initialTotal: number
  initialFilters: Filters
  categories: CategoryTile[]
  categoriesTotal: number
}) {
  const [items, setItems] = useState(initialItems)
  const [total, setTotal] = useState(initialTotal)
  const [filters, setFilters] = useState(initialFilters)
  const [queryInput, setQueryInput] = useState(initialFilters.q)
  const [loading, setLoading] = useState(false)   // filter/search change
  const [appending, setAppending] = useState(false)
  const reqId = useRef(0)

  // Run a fresh query (offset 0) or append (offset = items.length).
  const runQuery = useCallback(async (f: Filters, offset: number) => {
    const id = ++reqId.current
    if (offset > 0) setAppending(true)
    else setLoading(true)
    const res = await fetchFindPage({
      q: f.q,
      profession: f.profession ?? undefined,
      sort: f.sort,
      offset,
    })
    if (id !== reqId.current) return // a newer request superseded this one
    setTotal(res.total)
    setItems((prev) => (offset > 0 ? [...prev, ...res.items] : res.items))
    setLoading(false)
    setAppending(false)
  }, [])

  // Apply a filter change: update state, sync URL, refetch page 1.
  const applyFilters = useCallback((next: Filters) => {
    setFilters(next)
    window.history.replaceState(null, '', buildUrl(next))
    runQuery(next, 0)
  }, [runQuery])

  // Debounce the search input → applied query.
  useEffect(() => {
    if (queryInput === filters.q) return
    const t = setTimeout(() => applyFilters({ ...filters, q: queryInput }), 250)
    return () => clearTimeout(t)
  }, [queryInput, filters, applyFilters])

  // Infinite scroll: observe a sentinel; load next page when it appears.
  const loadMoreRef = useRef<() => void>(() => {})
  loadMoreRef.current = () => {
    if (loading || appending) return
    if (items.length >= total) return
    runQuery(filters, items.length)
  }
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current() },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const hasMore = items.length < total
  const filtered = !!(filters.q || filters.profession)

  return (
    <div>
      <div className="mx-auto mt-5 max-w-xl">
        <FindSearchControls value={queryInput} onChange={setQueryInput} />
      </div>

      {categoriesTotal > 0 && (
        <CategoryGridClient
          tiles={categories}
          total={categoriesTotal}
          active={filters.profession}
          onSelect={(profession) => applyFilters({ ...filters, profession })}
        />
      )}

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="min-w-0 text-[13px] font-semibold text-[var(--od-muted)]" aria-live="polite">
            <span className="tabular-nums">{total}</span> professional{total !== 1 ? 's' : ''}
            {filters.profession ? (
              <>
                {' '}· <span className="text-[var(--od-brand-strong)]">{filters.profession}</span>{' '}
                <Mr text={professionMarathi(filters.profession)} />
              </>
            ) : null}
            {filters.q ? <> · “{filters.q}”</> : null}
          </p>
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--od-border)] bg-white/70 p-0.5 text-[12px]">
            {(['top', 'new'] as const).map((value) => {
              const on = filters.sort === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-current={on ? 'page' : undefined}
                  onClick={() => applyFilters({ ...filters, sort: value })}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                    on ? 'bg-[var(--od-brand-strong)] text-[#FFFAF3]' : 'text-[var(--od-muted)] hover:text-[var(--od-brand-strong)]'
                  }`}
                >
                  {value === 'top' ? 'Top rated' : 'Newest'}
                </button>
              )
            })}
          </span>
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2"><CardSkeletons count={6} /></div>
        ) : total === 0 ? (
          <div className="od-card flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
              <SearchX size={26} aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-2xl">{filtered ? 'No matches' : 'Nobody here yet'}</h2>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
              {filtered ? 'No one matches this search. Try a different profession, or clear the filters.' : 'Be the first to add a professional you trust.'}
            </p>
            <div className="mt-5 flex gap-2">
              {filtered && (
                <button
                  type="button"
                  onClick={() => { setQueryInput(''); applyFilters({ q: '', profession: null, sort: filters.sort }) }}
                  className="od-button-secondary px-4 py-2 text-sm"
                >
                  Clear filters
                </button>
              )}
              <Link href="/find/submit" className="od-button-primary px-4 py-2 text-sm">Add a professional</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((p) => <FindCard key={p.id} p={p} />)}
              {appending && <CardSkeletons count={2} />}
            </div>
            <div ref={sentinelRef} aria-hidden className="h-1" />
            {!hasMore && (
              <p className="mt-6 text-center text-xs text-[var(--od-muted)]">You’ve reached the end · {total} in all</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rewrite page.tsx to render FindDirectory**

Replace `src/app/find/page.tsx` entirely:

```tsx
import { getApprovedProfessionals, getProfessionCounts, FIND_PAGE_SIZE, type FindSort } from '@/lib/data/find'
import { PROFESSIONS, professionMarathi } from '@/lib/find/professions'
import { ShieldCheck } from 'lucide-react'
import FindDirectory from './FindDirectory'
import type { CategoryTile } from './CategoryGridClient'

interface FindParams { q?: string; profession?: string; sort?: string }

export default async function FindHomePage({
  searchParams,
}: {
  searchParams: Promise<FindParams>
}) {
  const { q, profession, sort: rawSort } = await searchParams
  const sort: FindSort = rawSort === 'new' ? 'new' : 'top'

  const [page, { counts, total: categoriesTotal }] = await Promise.all([
    getApprovedProfessionals({ q, profession, sort, offset: 0, limit: FIND_PAGE_SIZE }),
    getProfessionCounts(),
  ])

  const categories: CategoryTile[] = PROFESSIONS
    .filter((p) => (counts.get(p) ?? 0) > 0)
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .map((p) => ({ label: p, mr: professionMarathi(p), count: counts.get(p) ?? 0 }))

  return (
    <div>
      <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-[var(--od-border)] bg-[var(--color-surface-2)] px-4 pb-7 pt-9 sm:pb-9 sm:pt-11">
        <div className="warli-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="od-eyebrow">Dahanu’s people directory</p>
          <h1 className="mt-2 text-balance font-display text-4xl leading-[1.08] sm:text-5xl">
            Every name here is <em className="text-[var(--od-brand)]">vouched for</em>.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-[var(--od-muted)] sm:text-[15px]">
            Electricians, plumbers, doctors, tutors — added by neighbours, rated only by people who actually used them.
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--od-ink-2)]">
            <ShieldCheck size={13} className="text-[var(--od-success)]" aria-hidden />
            Every rating checked by a moderator
          </p>
        </div>
      </section>

      <FindDirectory
        initialItems={page.items}
        initialTotal={page.total}
        initialFilters={{ q: q ?? '', profession: profession ?? null, sort }}
        categories={categories}
        categoriesTotal={categoriesTotal}
      />
    </div>
  )
}
```

Note: the search box moves from the hero into `FindDirectory` (rendered just below the hero, same centered `max-w-xl`). This keeps the search visually right under the hero text while letting the client own its state.

- [ ] **Step 5: Type-check, lint, build**

Run: `npx tsc --noEmit`, `npx eslint src/app/find`, `npm run build`
Expected: all pass; no unused-import warnings.

- [ ] **Step 6: Runtime verification at scale**

Load the Supabase MCP tools (`ToolSearch select:mcp__563fcecc-ab5b-42a7-91c8-1f45fd6e27f4__execute_sql`). Seed 200 clearly-marked throwaway rows:

```sql
insert into find_professionals (name, phone, whatsapp, professions, status, is_active)
select 'ZZ Seed ' || g, '90000' || lpad(g::text, 5, '0'), false, array['Electrician'], 'approved', true
from generate_series(1, 200) g;
```

Run `npm run dev`, open `http://find.localhost:3000/`:
- First paint shows ~24 cards, not 200+ (check DOM count of `article`).
- Scrolling down auto-appends more (infinite scroll), and stops with "You've reached the end".
- Tapping a category filters instantly (no full-page reload); the URL updates to `?profession=…`.
- Typing in search filters ~250ms after you stop, instantly (no navigation); clearing shows all again.
- A premium/business-linked professional still appears first.
- `http://find.localhost:3000/?profession=Doctor` server-renders Doctor's page 1 directly.

Then delete ONLY the seed rows:

```sql
delete from find_professionals where name like 'ZZ Seed %';
```

Confirm the delete count ≈ 200 and no real rows were touched.

- [ ] **Step 7: Commit**

```bash
git add src/app/find/CategoryGridClient.tsx src/app/find/FindSearchControls.tsx src/app/find/FindDirectory.tsx src/app/find/page.tsx
git commit -m "feat(find): client-driven instant filter/search + infinite scroll

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Post-implementation notes

- **`getProfessionCounts` unchanged:** counts still come from the full cached directory, so category tiles show accurate totals even though only a page renders.
- **Prefetch / SEO:** the first page is SSR'd inside the client component (client components render on the server), so search engines and no-JS users see page 1 + the hero. Deep links to `?profession=…` SSR correctly.
- **Scale ceiling (documented, not built):** at many thousands of rows + heavy ratings, caching the entire directory in memory and aggregating ratings per cache-refresh stops being cheap — revisit with DB-side pagination/aggregation then. Fine well past 1000.
- **Back button:** filter changes use `replaceState`, so Back leaves `/find` rather than stepping through filters — intended.
