import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ShieldCheck, SearchX } from 'lucide-react'
import { getApprovedProfessionals, getProfessionCounts } from '@/lib/data/find'
import {
  PROFESSIONS,
  professionFromSlug,
  professionSlug,
  professionMarathi,
} from '@/lib/find/professions'
import { MIN_CATEGORY_SIZE } from '@/lib/seo-thresholds'
import { PROFESSION_ICON } from '@/lib/find/profession-icons'
import StructuredData from '@/components/StructuredData'
import FindCard from '../../FindCard'
import { Mr } from '../../find-ui'
import { FIND_NAME, siteConfig } from '@/lib/site'

const FIND_URL = `https://find.${siteConfig.domain}`

// Pre-render one crawlable landing page per real category. 'Other' is not a
// rankable category, so it's excluded.
export function generateStaticParams() {
  return PROFESSIONS.filter((p) => p !== 'Other').map((p) => ({ slug: professionSlug(p) }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const profession = professionFromSlug(slug)
  if (!profession || profession === 'Other') return {}

  const { counts } = await getProfessionCounts()
  const count = counts.get(profession) ?? 0
  const canonical = `${FIND_URL}/c/${slug}`
  const title = `${profession} in ${siteConfig.town} — Trusted, Rated Professionals`
  const description =
    `Find ${count > 0 ? `${count} ` : ''}trusted, neighbour-rated ${profession.toLowerCase()} in ${siteConfig.areas}. Real ratings, checked by moderators.`.slice(
      0,
      160,
    )

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: FIND_NAME },
    // Don't index a category page that doesn't yet look like a real category.
    ...(count < MIN_CATEGORY_SIZE ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const profession = professionFromSlug(slug)
  if (!profession || profession === 'Other') notFound()

  const [{ items }, { counts }] = await Promise.all([
    getApprovedProfessionals({ profession, sort: 'top' }),
    getProfessionCounts(),
  ])

  const mr = professionMarathi(profession)
  const canonical = `${FIND_URL}/c/${slug}`
  const Icon = PROFESSION_ICON[profession]

  const others = PROFESSIONS.filter(
    (p) => p !== profession && p !== 'Other' && (counts.get(p) ?? 0) > 0,
  )
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, 12)

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${profession} in ${siteConfig.town}`,
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${FIND_URL}/p/${p.id}`,
      name: p.name,
    })),
  }
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: FIND_NAME, item: `${FIND_URL}/` },
      { '@type': 'ListItem', position: 2, name: profession, item: canonical },
    ],
  }

  return (
    <div>
      <StructuredData data={[itemListSchema, breadcrumbSchema]} />

      <Link
        href="/find"
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]"
      >
        <ArrowLeft size={13} aria-hidden /> All categories
      </Link>

      <header className="mb-6">
        <h1 className="flex items-center gap-2.5 text-balance font-display text-3xl leading-tight sm:text-4xl">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)] sm:h-12 sm:w-12">
            <Icon size={22} aria-hidden />
          </span>
          <span>
            {profession} <span className="text-[var(--od-brand)]">in {siteConfig.town}</span>
          </span>
        </h1>
        {mr && (
          <p className="mt-1 text-[15px] font-semibold text-[var(--od-muted)]">
            <Mr text={mr} />
          </p>
        )}
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--od-muted)]">
          Trusted, neighbour-rated {profession.toLowerCase()} across {siteConfig.areas} — added by
          locals, rated only by people who actually hired them.
        </p>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[var(--od-ink-2)]">
          <ShieldCheck size={13} className="text-[var(--od-success)]" aria-hidden />
          {items.length} listed · every rating checked by a moderator
        </p>
      </header>

      {items.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((p) => (
            <FindCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="od-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
            <SearchX size={26} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-2xl">No {profession.toLowerCase()} yet</h2>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
            Be the first to add a {profession.toLowerCase()} you trust in {siteConfig.town}.
          </p>
          <Link href="/find/submit" className="od-button-primary mt-5 px-4 py-2 text-sm">
            Add a professional
          </Link>
        </div>
      )}

      {others.length > 0 && (
        <nav aria-label="Other categories" className="mt-10 border-t border-[var(--od-border)] pt-6">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--od-muted)]">
            Browse other categories in {siteConfig.town}
          </p>
          <div className="flex flex-wrap gap-2">
            {others.map((p) => {
              const OtherIcon = PROFESSION_ICON[p]
              return (
                <Link
                  key={p}
                  href={`/find/c/${professionSlug(p)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/70 px-3.5 py-2 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-gold)] hover:bg-white"
                >
                  <OtherIcon size={14} className="shrink-0 opacity-70" aria-hidden />
                  {p} <Mr text={professionMarathi(p)} />
                  <span className="rounded-full bg-[var(--od-surface-soft)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--od-brand-strong)]">
                    {counts.get(p) ?? 0}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
