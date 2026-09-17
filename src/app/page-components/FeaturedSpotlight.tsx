import Image from 'next/image'
import { ArrowRight, CheckCircle2, MapPin, Sparkles, Star } from 'lucide-react'

import SafeAppLink from '@/components/SafeAppLink'
import Badge from '@/components/ui/Badge'
import { summarizeAddress } from '@/lib/listing-content'
import type { FeaturedListing } from '@/lib/data/home'
import { getListingHref } from '@/lib/listing-url'

export default function FeaturedSpotlight({ listing }: { listing: FeaturedListing }) {
  const href = getListingHref(listing.id, listing.subdomain)
  const address = summarizeAddress(listing.address, 2)

  return (
    <section className="od-mobile-section bg-white py-10 md:py-16">
      <div className="mx-auto max-w-[1160px] px-4 md:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="od-eyebrow">Featured</p>
            <h2 className="mt-1 font-display text-[26px] leading-[1.15] text-[var(--od-ink)] md:text-[30px]">
              A Local Standout
            </h2>
          </div>
          <SafeAppLink
            href="/listings"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--od-brand)] transition-colors hover:text-[var(--od-brand-strong)]"
          >
            View all <ArrowRight size={13} />
          </SafeAppLink>
        </div>

        <article className="group overflow-hidden rounded-xl border border-[var(--od-border)] bg-[#fffdf9] shadow-[0_18px_50px_rgba(46,18,5,0.08)] md:grid md:grid-cols-[minmax(360px,0.9fr)_1fr]">
          <div
            className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-[430px]"
            style={{ background: 'linear-gradient(135deg, #F7E7CF, #C4663A)' }}
          >
            {listing.image_url || listing.image_thumb_url ? (
              <Image
                src={(listing.image_url || listing.image_thumb_url) as string}
                alt={listing.name}
                fill
                sizes="(min-width: 768px) 420px, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center font-display text-[56px] text-white/40" aria-hidden>
                OD
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
            <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--od-ink)] shadow-sm">
              <Sparkles size={12} className="text-[#C8881E]" />
              Featured
            </div>
            {listing.rating && listing.rating > 0 ? (
              <div className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-bold text-white backdrop-blur-sm">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                {listing.rating.toFixed(1)}
                <span className="text-xs font-medium text-white/75">({listing.review_count ?? 0})</span>
              </div>
            ) : null}
          </div>

          <div className="p-5 md:flex md:flex-col md:justify-center md:p-9">
            <div className="mb-5 flex items-center gap-2">
              <Badge variant="brand">{listing.category}</Badge>
              {listing.verified && (
                <Badge variant="success">
                  <CheckCircle2 size={11} /> Verified
                </Badge>
              )}
            </div>

            <h3 className="font-display text-[30px] leading-[1.08] text-[var(--od-ink)] md:text-[40px]">
              {listing.name}
            </h3>
            {address && (
              <div className="mt-3 flex items-center gap-1.5 text-[13px] text-[var(--od-muted)]">
                <MapPin size={13} />
                <span>{address}</span>
              </div>
            )}

            <p className="mt-3 line-clamp-2 max-w-[540px] text-sm leading-6 text-[var(--od-muted)] md:mt-5 md:text-[15px] md:leading-7">
              {listing.tagline || 'A handpicked business from the OurDahanu directory, selected for discovery this week.'}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 md:mt-7">
              <SafeAppLink
                href={href}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--od-ink)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--od-brand-strong)]"
              >
                Visit business
                <ArrowRight size={13} />
              </SafeAppLink>
              <SafeAppLink
                href="/listings"
                className="hidden items-center gap-2 rounded-lg border border-[var(--od-border)] px-4 py-2.5 text-sm font-semibold text-[var(--od-ink)] transition-all hover:border-[rgba(192,88,46,0.35)] hover:bg-[var(--od-surface-soft)] sm:inline-flex"
              >
                Browse directory
              </SafeAppLink>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
