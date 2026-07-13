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
