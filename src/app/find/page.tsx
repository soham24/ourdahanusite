import { Suspense } from 'react'
import { getApprovedProfessionals, getProfessionCounts, FIND_PAGE_SIZE, type FindSort } from '@/lib/data/find'
import { PROFESSIONS, professionMarathi } from '@/lib/find/professions'
import { ShieldCheck } from 'lucide-react'
import FindDirectory from './FindDirectory'
import type { CategoryTile } from './CategoryGridClient'

interface FindParams { q?: string; profession?: string; sort?: string }

function FindResultsSkeleton() {
  return (
    <div aria-hidden>
      <div className="mx-auto mt-5 max-w-xl">
        <div className="h-12 animate-pulse rounded-[14px] bg-white/60" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-[14px] bg-[var(--color-gray-100)]" />
        ))}
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="od-card animate-pulse p-5">
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
      </div>
    </div>
  )
}

// Slow, data-dependent portion — isolated in its own async component so the
// hero paints immediately and only this region shows a skeleton while the
// cached directory is read. Awaiting the data at the page-component top would
// suspend the whole page (hero included) behind the route's full-screen loader.
async function FindResults({ q, profession, sort }: { q?: string; profession?: string; sort: FindSort }) {
  const [page, { counts, total: categoriesTotal }] = await Promise.all([
    getApprovedProfessionals({ q, profession, sort, offset: 0, limit: FIND_PAGE_SIZE }),
    getProfessionCounts(),
  ])

  const categories: CategoryTile[] = PROFESSIONS
    .filter((p) => (counts.get(p) ?? 0) > 0)
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .map((p) => ({ label: p, mr: professionMarathi(p), count: counts.get(p) ?? 0 }))

  return (
    <FindDirectory
      initialItems={page.items}
      initialTotal={page.total}
      initialFilters={{ q: q ?? '', profession: profession ?? null, sort }}
      categories={categories}
      categoriesTotal={categoriesTotal}
    />
  )
}

export default async function FindHomePage({
  searchParams,
}: {
  searchParams: Promise<FindParams>
}) {
  const { q, profession, sort: rawSort } = await searchParams
  const sort: FindSort = rawSort === 'new' ? 'new' : 'top'

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

      <Suspense fallback={<FindResultsSkeleton />}>
        <FindResults q={q} profession={profession} sort={sort} />
      </Suspense>
    </div>
  )
}
