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
  // Category grid collapses while the search is engaged so results stay above
  // the fold; starts collapsed on a deep-linked search. See the search
  // focus/blur/change handlers below and CategoryGridClient's header toggle.
  const [categoriesOpen, setCategoriesOpen] = useState(initialFilters.q.trim() === '')
  const reqId = useRef(0)
  // Synchronous "a request is in flight" flag. React's `loading`/`appending`
  // state lags a render behind, so the scroll observer could read a stale
  // `loading === false` in the split-second after a search starts and fire an
  // unfiltered append — which then got a newer reqId and clobbered the search
  // (searching only worked once everything was already loaded). This ref is
  // set the instant a fetch begins, so loadMore never starts an append while
  // any query is pending.
  const busy = useRef(false)

  // Run a fresh query (offset 0) or append (offset = items.length).
  const runQuery = useCallback(async (f: Filters, offset: number) => {
    const id = ++reqId.current
    busy.current = true
    if (offset > 0) setAppending(true)
    else setLoading(true)
    const res = await fetchFindPage({
      q: f.q,
      profession: f.profession ?? undefined,
      sort: f.sort,
      offset,
    })
    if (id !== reqId.current) return // a newer request superseded this one; it owns `busy`
    busy.current = false
    // Append that came back empty = end-of-list race or an error fallback
    // ({ items: [], total: 0 }). Treat it as a no-op so a transient failure
    // mid-scroll never wipes the already-loaded cards or resets total to 0.
    if (offset > 0 && res.items.length === 0) {
      setAppending(false)
      return
    }
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

  // Debounce the search input → applied query. A search is always global: a
  // non-empty query clears any active category so matches in other professions
  // aren't hidden by the category filter.
  useEffect(() => {
    if (queryInput === filters.q) return
    const t = setTimeout(() => {
      const q = queryInput
      applyFilters({ ...filters, q, profession: q.trim() ? null : filters.profession })
    }, 250)
    return () => clearTimeout(t)
  }, [queryInput, filters, applyFilters])

  // Infinite scroll: observe a sentinel; load next page when it appears.
  // Keep the loadMore closure in a ref, refreshed after every render (effect,
  // not during render) so the IntersectionObserver always calls the latest one
  // without needing to re-create the observer on each state change.
  const loadMoreRef = useRef<() => void>(() => {})
  useEffect(() => {
    loadMoreRef.current = () => {
      if (busy.current) return // a query is already in flight (synchronous guard)
      if (items.length >= total) return
      runQuery(filters, items.length)
    }
  })
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
        <FindSearchControls
          value={queryInput}
          onChange={(v) => { setQueryInput(v); setCategoriesOpen(v.trim() === '') }}
          onFocus={() => setCategoriesOpen(false)}
          onBlur={() => { if (queryInput.trim() === '') setCategoriesOpen(true) }}
        />
      </div>

      {categoriesTotal > 0 && (
        <CategoryGridClient
          tiles={categories}
          total={categoriesTotal}
          active={filters.profession}
          onSelect={(profession) => {
            // Picking a category is browse mode — clear any search so the two
            // filters never combine (keeps search strictly global).
            setQueryInput('')
            applyFilters({ q: '', profession, sort: filters.sort })
          }}
          open={categoriesOpen}
          onOpenChange={setCategoriesOpen}
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
            {!hasMore && (
              <p className="mt-6 text-center text-xs text-[var(--od-muted)]">You’ve reached the end · {total} in all</p>
            )}
          </>
        )}

        {/* Sentinel rendered unconditionally (outside the loading/empty/results
            ternary) so it stays a stable node across loading toggles — the
            once-created observer keeps observing it after a filter/search/sort
            instead of a detached, unmounted node. loadMore guards loading/empty. */}
        <div ref={sentinelRef} aria-hidden className="h-1" />
      </div>
    </div>
  )
}
