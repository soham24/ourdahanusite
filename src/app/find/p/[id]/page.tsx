import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LogIn, MapPin, MessageCircle, Phone, Share2, ShieldCheck } from 'lucide-react'
import { getProfessionalById, getApprovedRatings, getApprovedProfessionals } from '@/lib/data/find'
import { truncateAtWord } from '@/lib/text'
import { createClient } from '@/lib/supabase/server'
import { professionSlug } from '@/lib/find/professions'
import StructuredData from '@/components/StructuredData'
import { BusinessAvatar, GoldStars, Monogram, Mr, premiumSurfaceClass, PremiumBadge, professionLabels, telHref, timeAgo, VisitBusinessLink, waHref } from '../../find-ui'
import { findLoginHref } from '../../find-server'
import TrackedContactLink from '../../TrackedContactLink'
import FindCard from '../../FindCard'
import RatingForm from './RatingForm'

const NEARBY_AREAS = ['Dahanu', 'Bordi', 'Gholvad', 'Palghar']

const FIND_URL = 'https://find.ourdahanu.in'

// Per-professional SEO: "Jayprakash Jaiswal — Electrician in Dahanu" is
// exactly what people search for. getProfessionalById is cached, so the
// page render reuses this fetch.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const pro = await getProfessionalById(id)
  if (!pro) return {}
  const professions = professionLabels(pro).map((l) => l.label).join(', ')
  const title = `${pro.name} — ${professions} in Dahanu`
  const descriptionParts = [
    pro.rating_count > 0
      ? `Rated ${pro.avg_rating.toFixed(1)}/5 by ${pro.rating_count} verified customer${pro.rating_count > 1 ? 's' : ''}.`
      : 'Vouched for by neighbours on FindDahanu.',
    pro.locality ? `Serves ${pro.locality}.` : null,
    pro.note,
  ]
    .filter(Boolean)
    .join(' ')
  const description = truncateAtWord(descriptionParts, 159)
  const url = `${FIND_URL}/p/${pro.id}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'profile', siteName: 'FindDahanu' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function ProfessionalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const pro = await getProfessionalById(id)
  if (!pro) notFound()
  const ratings = await getApprovedRatings(id)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let alreadyRated = false
  if (user) {
    const { data: mine } = await supabase
      .from('find_ratings')
      .select('id')
      .eq('professional_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    alreadyRated = !!mine
  }

  const profileUrl = `${FIND_URL}/p/${pro.id}`
  const proLabels = professionLabels(pro).map((l) => l.label)
  const professionsText = proLabels.join(', ')
  const primaryProfession = proLabels[0] ?? 'Professional'
  const primarySlug = professionSlug(primaryProfession)
  const categoryUrl = `${FIND_URL}/c/${primarySlug}`

  // "More {profession} in Dahanu" — internal links out to related profiles,
  // so crawlers keep moving between pages instead of dead-ending here.
  const { items: sameProfession } = await getApprovedProfessionals({
    profession: primaryProfession,
    sort: 'top',
  })
  const related = sameProfession.filter((p) => p.id !== pro.id).slice(0, 4)
  const otherAreas = NEARBY_AREAS.filter((a) => a !== pro.locality)

  // JSON-LD: a rated local service provider + breadcrumb. The rating/review
  // data shown on this page is what earns ★ rich snippets in search results.
  const proSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': profileUrl,
    name: pro.name,
    description: `${professionsText} in Dahanu${pro.locality ? `, ${pro.locality}` : ''}.`,
    url: profileUrl,
    telephone: pro.phone,
    areaServed: ['Dahanu', 'Bordi', 'Gholvad', 'Palghar'],
    address: {
      '@type': 'PostalAddress',
      addressLocality: pro.locality || 'Dahanu',
      addressRegion: 'Maharashtra',
      addressCountry: 'IN',
    },
    ...(pro.business?.image_url ? { image: pro.business.image_url } : {}),
    ...(pro.rating_count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: pro.avg_rating.toFixed(1),
            reviewCount: pro.rating_count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }
  const reviewNodes = ratings
    .filter((r) => r.comment && r.comment.trim())
    .slice(0, 5)
    .map((r) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      author: { '@type': 'Person', name: 'Verified customer' },
      reviewBody: r.comment,
      datePublished: r.created_at.slice(0, 10),
    }))
  if (reviewNodes.length) proSchema.review = reviewNodes

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'FindDahanu', item: `${FIND_URL}/` },
      { '@type': 'ListItem', position: 2, name: primaryProfession, item: categoryUrl },
      { '@type': 'ListItem', position: 3, name: pro.name, item: profileUrl },
    ],
  }

  return (
    <div className="mx-auto max-w-2xl">
      <StructuredData data={[proSchema, breadcrumbSchema]} />

      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5">
        <Link
          href="/find"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]"
        >
          <ArrowLeft size={13} aria-hidden /> FindDahanu
        </Link>
        <span className="text-[var(--od-muted)]" aria-hidden>/</span>
        <Link
          href={`/find/c/${primarySlug}`}
          className="rounded-full border border-[var(--od-border)] bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]"
        >
          {primaryProfession}
        </Link>
      </nav>

      <div className={`relative p-5 sm:p-6 ${pro.business ? premiumSurfaceClass : 'od-card'}`}>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            `${pro.name} — ${professionLabels(pro).map((l) => l.label).join(', ')} in Dahanu\n${FIND_URL}/p/${pro.id}`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share ${pro.name}’s profile on WhatsApp`}
          title="Share on WhatsApp"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--od-border)] bg-white/70 text-[var(--od-muted)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]"
        >
          <Share2 size={15} aria-hidden />
        </a>
        <div className="flex items-start gap-4 pr-10">
          {pro.business ? <BusinessAvatar business={pro.business} name={pro.name} size="lg" /> : <Monogram name={pro.name} size="lg" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-balance font-display text-3xl leading-tight sm:text-4xl">
              {pro.name}
            </h1>
            {pro.business && <div className="mt-1"><PremiumBadge /></div>}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {professionLabels(pro).map(({ label, mr }) => (
                <span
                  key={label}
                  className="rounded-full bg-[rgba(192,88,46,0.09)] px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)]"
                >
                  {label} <Mr text={mr} />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-[var(--color-surface-soft)] px-4 py-3">
          {pro.rating_count > 0 ? (
            <>
              <span className="font-display text-3xl tabular-nums leading-none">
                {pro.avg_rating.toFixed(1)}
              </span>
              <span>
                <GoldStars value={pro.avg_rating} size={15} />
                <span className="mt-0.5 block text-xs text-[var(--od-muted)]">
                  {pro.rating_count} verified rating{pro.rating_count > 1 ? 's' : ''}
                </span>
              </span>
            </>
          ) : (
            <span className="text-sm text-[var(--od-muted)]">
              No ratings yet — be the first to rate.
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <TrackedContactLink
            href={telHref(pro.phone)}
            method="call"
            professionalId={pro.id}
            professionalName={pro.name}
            className="od-button-primary h-11 flex-1 text-[15px] active:scale-[0.98]"
          >
            <Phone size={16} aria-hidden /> Call <span className="tabular-nums">{pro.phone}</span>
          </TrackedContactLink>
          {pro.whatsapp && (
            <TrackedContactLink
              href={waHref(pro.phone)}
              method="whatsapp"
              professionalId={pro.id}
              professionalName={pro.name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[rgba(19,138,75,0.3)] bg-[rgba(19,138,75,0.06)] text-[15px] font-bold text-[var(--color-success-strong)] transition-colors duration-150 hover:bg-[rgba(19,138,75,0.12)] active:scale-[0.98]"
            >
              <MessageCircle size={16} className="text-[var(--od-success)]" aria-hidden /> WhatsApp
            </TrackedContactLink>
          )}
          {pro.business && <VisitBusinessLink business={pro.business} className="h-11 flex-1" />}
        </div>

        <div className="mt-4 space-y-1.5 border-t border-[var(--od-border)] pt-4">
          {pro.locality && (
            <p className="flex items-center gap-1.5 text-sm text-[var(--od-ink-2)]">
              <MapPin size={14} className="text-[var(--od-muted)]" aria-hidden /> {pro.locality}
            </p>
          )}
          <p className="text-xs text-[var(--od-muted)]">Also serves {otherAreas.join(', ')}</p>
          {pro.note && (
            <p className="text-sm leading-relaxed text-[var(--od-ink-2)]">{pro.note}</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        {user ? (
          <RatingForm professionalId={pro.id} alreadyRated={alreadyRated} />
        ) : (
          <div className="od-card flex flex-col items-center px-6 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
              <LogIn size={22} aria-hidden />
            </span>
            <h2 className="mt-3 font-display text-xl">Used {pro.name}’s service?</h2>
            <p className="mt-1 max-w-sm text-sm text-[var(--od-muted)]">
              Log in to leave a rating. Your rating appears after a moderator checks it.
            </p>
            <a
              href={await findLoginHref(`/p/${pro.id}`)}
              className="od-button-primary mt-4 px-5 py-2 text-sm"
            >
              Log in with Google
            </a>
          </div>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 flex items-baseline gap-2 font-display text-2xl">
          Ratings
          {ratings.length > 0 && (
            <span className="text-sm font-sans font-semibold tabular-nums text-[var(--od-muted)]">
              {ratings.length}
            </span>
          )}
        </h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-[var(--od-muted)]">No approved ratings yet.</p>
        ) : (
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li
                key={r.id}
                className="rounded-[var(--od-radius)] border border-[var(--od-border)] bg-[var(--color-surface-2)] p-4"
              >
                <span className="flex items-center justify-between gap-2">
                  <GoldStars value={r.rating} size={13} />
                  <span className="text-[11px] text-[var(--od-muted)]">
                    {timeAgo(r.created_at)}
                  </span>
                </span>
                <span className="sr-only">Rated {r.rating} out of 5</span>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--od-ink-2)]">
                  {r.comment}
                </p>
                <p className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-[var(--color-success-strong)]">
                  <ShieldCheck size={12} className="text-[var(--od-success)]" aria-hidden /> Verified
                  — used this service
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section className="mt-10 border-t border-[var(--od-border)] pt-8">
          <h2 className="mb-3 font-display text-2xl">
            More {primaryProfession.toLowerCase()}s in Dahanu
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((p) => (
              <FindCard key={p.id} p={p} />
            ))}
          </div>
          <Link
            href={`/find/c/${primarySlug}`}
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--od-brand)] hover:text-[var(--od-brand-strong)]"
          >
            View all {primaryProfession.toLowerCase()}s in Dahanu →
          </Link>
        </section>
      )}
    </div>
  )
}
