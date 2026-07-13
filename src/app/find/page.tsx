import Link from 'next/link'
import { Suspense } from 'react'
import { MapPin, MessageCircle, Phone, SearchX, ShieldCheck } from 'lucide-react'
import { getApprovedProfessionals, getProfessionCounts, type FindSort } from '@/lib/data/find'
import { PROFESSIONS, professionMarathi } from '@/lib/find/professions'
import type { ProfessionalWithStats } from '@/lib/find/types'
import FindSearchControls from './FindSearchControls'
import CategoryGridClient from './CategoryGridClient'
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

interface FindParams {
  q?: string
  profession?: string
  sort?: string
}

function findHref(next: { profession?: string | null; q?: string; sort?: FindSort }) {
  const sp = new URLSearchParams()
  if (next.q) sp.set('q', next.q)
  if (next.profession) sp.set('profession', next.profession)
  if (next.sort === 'new') sp.set('sort', 'new')
  const s = sp.toString()
  return s ? `/find?${s}` : '/find'
}

function CategoryGridSkeleton() {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-[14px] bg-[var(--color-gray-100)]" />
      ))}
    </div>
  )
}

// Only categories with at least one approved+active professional are shown —
// with 35+ possible categories, listing every one regardless of data made the
// filter mostly empty tiles. Ordered by count (busiest categories first);
// collapses past the first rows on phones (see CategoryGridClient).
async function CategoryGrid({ active, q, sort }: { active?: string; q?: string; sort?: FindSort }) {
  const { counts, total } = await getProfessionCounts()
  if (total === 0) return null

  const present = PROFESSIONS
    .filter((p) => (counts.get(p) ?? 0) > 0)
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))

  return (
    <CategoryGridClient
      tiles={present.map((p) => ({
        href: findHref({ profession: p, q, sort }),
        label: p,
        mr: professionMarathi(p),
        count: counts.get(p) ?? 0,
        active: active === p,
      }))}
      allHref={findHref({ q, sort })}
      allActive={!active}
      total={total}
    />
  )
}

function Card({ p }: { p: ProfessionalWithStats }) {
  return (
    <article className={p.business ? premiumCardClass : 'od-card od-card-hover relative flex flex-col p-4 sm:p-5'}>
      <Link
        href={`/find/p/${p.id}`}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`View ${p.name}’s profile and ratings`}
      />
      {p.business && (
        <div className="relative z-10 mb-2">
          <PremiumBadge />
        </div>
      )}
      <div className="flex items-start gap-3">
        {p.business ? <BusinessAvatar business={p.business} name={p.name} /> : <Monogram name={p.name} />}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[1.05rem] font-bold tracking-[-0.01em]">{p.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1">
            {professionLabels(p).map(({ label, mr }) => (
              <span
                key={label}
                className="rounded-full bg-[rgba(192,88,46,0.09)] px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)]"
              >
                {label} <Mr text={mr} />
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {p.rating_count > 0 ? (
            <>
              <span className="flex justify-end">
                <GoldStars value={p.avg_rating} size={13} />
              </span>
              <p className="mt-1 text-xs font-bold tabular-nums text-[var(--od-ink-2)]">
                {p.avg_rating.toFixed(1)}{' '}
                <span className="font-normal text-[var(--od-muted)]">· {p.rating_count}</span>
              </p>
            </>
          ) : (
            <span className="rounded-full bg-[var(--color-surface-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--od-muted)]">
              No ratings yet
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--od-muted)]">
          {p.locality && (
            <span className="flex items-center gap-1">
              <MapPin size={12} aria-hidden /> {p.locality}
            </span>
          )}
          <span className="tabular-nums">{p.phone}</span>
        </p>
        {p.note && (
          <p className="line-clamp-2 text-sm leading-relaxed text-[var(--od-ink-2)]">{p.note}</p>
        )}
      </div>

      <div className="relative z-10 mt-4 flex gap-2 border-t border-[var(--od-border)] pt-3">
        <TrackedContactLink
          href={telHref(p.phone)}
          method="call"
          professionalId={p.id}
          professionalName={p.name}
          className="od-button-primary flex-1 py-2 text-sm active:scale-[0.98]"
        >
          <Phone size={14} aria-hidden /> Call
        </TrackedContactLink>
        {p.whatsapp && (
          <TrackedContactLink
            href={waHref(p.phone)}
            method="whatsapp"
            professionalId={p.id}
            professionalName={p.name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[rgba(19,138,75,0.3)] bg-[rgba(19,138,75,0.06)] py-2 text-sm font-bold text-[var(--color-success-strong)] transition-colors duration-150 hover:bg-[rgba(19,138,75,0.12)] active:scale-[0.98]"
          >
            <MessageCircle size={14} className="text-[var(--od-success)]" aria-hidden /> WhatsApp
          </TrackedContactLink>
        )}
      </div>
      {p.business && (
        <div className="relative z-10 mt-2">
          <VisitBusinessLink business={p.business} className="w-full" />
        </div>
      )}
    </article>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="od-card flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
        <SearchX size={26} aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-2xl">
        {filtered ? 'No matches' : 'Nobody here yet'}
      </h2>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
        {filtered
          ? 'No one matches this search. Try a different profession, or clear the filters.'
          : 'Be the first to add a professional you trust.'}
      </p>
      <div className="mt-5 flex gap-2">
        {filtered && (
          <Link href="/find" className="od-button-secondary px-4 py-2 text-sm">
            Clear filters
          </Link>
        )}
        <Link href="/find/submit" className="od-button-primary px-4 py-2 text-sm">
          Add a professional
        </Link>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
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
  )
}

function SortToggle({ sort, q, profession }: { sort: FindSort; q?: string; profession?: string }) {
  const opt = (value: FindSort, label: string) => {
    const on = sort === value
    return (
      <Link
        href={findHref({ q, profession, sort: value })}
        aria-current={on ? 'page' : undefined}
        className={`rounded-full px-3 py-1 font-semibold transition-colors ${
          on
            ? 'bg-[var(--od-brand-strong)] text-[#FFFAF3]'
            : 'text-[var(--od-muted)] hover:text-[var(--od-brand-strong)]'
        }`}
      >
        {label}
      </Link>
    )
  }
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--od-border)] bg-white/70 p-0.5 text-[12px]">
      {opt('top', 'Top rated')}
      {opt('new', 'Newest')}
    </span>
  )
}

async function ProfessionalList({
  q,
  profession,
  sort,
}: {
  q?: string
  profession?: string
  sort: FindSort
}) {
  const pros = await getApprovedProfessionals({ q, profession, sort })
  if (pros.length === 0) return <EmptyState filtered={!!(q || profession)} />
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="min-w-0 text-[13px] font-semibold text-[var(--od-muted)]">
          <span className="tabular-nums">{pros.length}</span> professional
          {pros.length !== 1 ? 's' : ''}
          {profession ? (
            <>
              {' '}
              · <span className="text-[var(--od-brand-strong)]">{profession}</span>{' '}
              <Mr text={professionMarathi(profession)} />
            </>
          ) : null}
          {q ? <> · “{q}”</> : null}
        </p>
        <SortToggle sort={sort} q={q} profession={profession} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {pros.map((p) => (
          <Card key={p.id} p={p} />
        ))}
      </div>
    </>
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
            Electricians, plumbers, doctors, tutors — added by neighbours, rated only by people
            who actually used them.
          </p>
          <div className="mx-auto mt-5 max-w-xl">
            <Suspense fallback={<div className="h-12 rounded-[14px] bg-white/60" />}>
              <FindSearchControls />
            </Suspense>
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--od-ink-2)]">
            <ShieldCheck size={13} className="text-[var(--od-success)]" aria-hidden />
            Every rating checked by a moderator
          </p>
        </div>
      </section>

      <Suspense fallback={<CategoryGridSkeleton />}>
        <CategoryGrid active={profession} q={q} sort={sort} />
      </Suspense>

      <div className="mt-5">
        <Suspense fallback={<ListSkeleton />}>
          <ProfessionalList q={q} profession={profession} sort={sort} />
        </Suspense>
      </div>
    </div>
  )
}
