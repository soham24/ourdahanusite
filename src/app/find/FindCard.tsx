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
