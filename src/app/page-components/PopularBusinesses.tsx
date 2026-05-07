import Image from 'next/image'
import { ArrowRight, CheckCircle2, MapPin, Star } from 'lucide-react'

import SafeAppLink from '@/components/SafeAppLink'
import SectionHeader from '@/components/ui/SectionHeader'
import { summarizeAddress } from '@/lib/listing-content'
import type { HomeListing } from '@/lib/data/home'
import { getListingHref } from '@/lib/listing-url'

interface PopularBusinessesProps {
  listings: HomeListing[]
}

export default function PopularBusinesses({ listings }: PopularBusinessesProps) {
  if (listings.length === 0) return null

  const [lead, ...rest] = listings.slice(0, 6)

  return (
    <section className="border-y border-[var(--od-border)] bg-[#f7efe4] py-12 md:py-16">
      <div className="mx-auto max-w-[1160px] px-5 md:px-6">
        <SectionHeader
          label="Most trusted"
          title="Popular Around Dahanu"
          sub="Highly rated local businesses people return to"
          viewAllHref="/listings"
        />

        <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          {lead ? <LeadPopularCard listing={lead} /> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {rest.slice(0, 4).map((listing) => (
              <CompactPopularCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function LeadPopularCard({ listing }: { listing: HomeListing }) {
  const href = getListingHref(listing.id, listing.subdomain)
  const address = summarizeAddress(listing.address, 2)
  const imageUrl = listing.image_url || listing.image_thumb_url

  return (
    <SafeAppLink
      href={href}
      className="group grid overflow-hidden rounded-xl border border-[var(--od-border)] bg-white shadow-[0_16px_46px_rgba(46,18,5,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(192,88,46,0.35)] md:grid-cols-[0.95fr_1fr]"
    >
      <div className="relative min-h-[260px] overflow-hidden bg-[var(--od-surface-soft)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={listing.name}
            fill
            sizes="(min-width: 1024px) 320px, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-4xl text-[var(--od-brand)]/25">
            OD
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {listing.rating && listing.rating > 0 ? (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-bold text-white backdrop-blur-sm">
            <Star size={13} className="fill-amber-400 text-amber-400" />
            {listing.rating.toFixed(1)}
            <span className="text-xs font-medium text-white/75">({listing.review_count ?? 0})</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col justify-center p-5 md:p-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--od-surface-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--od-brand)]">
            {listing.category}
          </span>
          {listing.verified && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
              <CheckCircle2 size={12} />
              Verified
            </span>
          )}
        </div>
        <h3 className="font-display text-[28px] leading-[1.08] text-[var(--od-ink)] transition-colors group-hover:text-[var(--od-brand-strong)]">
          {listing.name}
        </h3>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--od-muted)]">
          {listing.tagline || 'A popular business from the OurDahanu community.'}
        </p>
        <div className="mt-5 flex items-center justify-between gap-4 text-sm text-[var(--od-muted)]">
          {address ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin size={13} />
              <span className="truncate">{address}</span>
            </span>
          ) : <span />}
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--od-brand)]">
            View <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </SafeAppLink>
  )
}

function CompactPopularCard({ listing }: { listing: HomeListing }) {
  const href = getListingHref(listing.id, listing.subdomain)
  const address = summarizeAddress(listing.address, 2)
  const imageUrl = listing.image_thumb_url || listing.image_url

  return (
    <SafeAppLink
      href={href}
      className="group flex min-h-[132px] gap-4 rounded-xl border border-[var(--od-border)] bg-white p-3 shadow-[0_10px_28px_rgba(46,18,5,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(192,88,46,0.35)]"
    >
      <div className="relative h-[108px] w-[112px] flex-shrink-0 overflow-hidden rounded-lg bg-[var(--od-surface-soft)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={listing.name}
            fill
            sizes="112px"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-2xl text-[var(--od-brand)]/25">
            OD
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--od-brand)]">
          {listing.category}
        </div>
        <h3 className="mt-1 line-clamp-2 font-display text-[18px] leading-[1.1] text-[var(--od-ink)] transition-colors group-hover:text-[var(--od-brand-strong)]">
          {listing.name}
        </h3>
        <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-xs text-[var(--od-muted)]">
          {listing.rating && listing.rating > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--od-ink)]">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              {listing.rating.toFixed(1)}
            </span>
          ) : (
            <span>New</span>
          )}
          {address ? <span className="min-w-0 truncate text-right">{address}</span> : null}
        </div>
      </div>
    </SafeAppLink>
  )
}
