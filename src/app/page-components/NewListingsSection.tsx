import Image from 'next/image'
import { ArrowRight, CheckCircle2, MapPin, Sparkles, Star } from 'lucide-react'

import SafeAppLink from '@/components/SafeAppLink'
import SectionHeader from '@/components/ui/SectionHeader'
import { summarizeAddress } from '@/lib/listing-content'
import type { HomeListing } from '@/lib/data/home'
import { getListingHref } from '@/lib/listing-url'

interface NewListingsSectionProps {
  newListings: HomeListing[]
}

export default function NewListingsSection({ newListings }: NewListingsSectionProps) {
  if (newListings.length === 0) return null

  return (
    <section className="bg-[#fffdf9] py-12 md:py-16">
      <div className="mx-auto max-w-[1160px] px-5 md:px-6">
        <SectionHeader
          label="New arrivals"
          title="Recently Listed"
          sub="Fresh businesses and services added to the directory"
          viewAllHref="/listings"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {newListings.slice(0, 6).map((listing, index) => {
            const href = getListingHref(listing.id, listing.subdomain)
            const address = summarizeAddress(listing.address, 2)
            const imageUrl = listing.image_url || listing.image_thumb_url

            return (
              <SafeAppLink
                key={listing.id}
                href={href}
                className="group overflow-hidden rounded-xl border border-[var(--od-border)] bg-white shadow-[0_10px_30px_rgba(46,18,5,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(192,88,46,0.35)] hover:shadow-[0_18px_44px_rgba(46,18,5,0.10)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[var(--od-surface-soft)]">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={listing.name}
                      fill
                      sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-display text-4xl text-[var(--od-brand)]/25">
                      OD
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--od-ink)]">
                    <Sparkles size={11} className="text-[#C8881E]" />
                    New {index + 1}
                  </div>
                  {listing.verified && (
                    <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-blue-700 px-2.5 py-1 text-[10px] font-bold text-white">
                      <CheckCircle2 size={10} />
                      Verified
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--od-brand)]">
                    {listing.category}
                  </div>
                  <h3 className="line-clamp-2 min-h-[44px] font-display text-[20px] leading-[1.1] text-[var(--od-ink)] transition-colors group-hover:text-[var(--od-brand-strong)]">
                    {listing.name}
                  </h3>
                  {listing.tagline ? (
                    <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-5 text-[var(--od-muted)]">
                      {listing.tagline}
                    </p>
                  ) : (
                    <p className="mt-2 min-h-[40px] text-sm leading-5 text-[var(--od-muted)]">
                      Newly added to OurDahanu.
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--od-border)] pt-3 text-xs text-[var(--od-muted)]">
                    {listing.rating && listing.rating > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[var(--od-ink)]">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        {listing.rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="font-semibold text-[var(--od-brand)]">New</span>
                    )}
                    {address && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin size={11} />
                        <span className="truncate">{address}</span>
                      </span>
                    )}
                    <ArrowRight size={13} className="flex-shrink-0 text-[var(--od-brand)]" />
                  </div>
                </div>
              </SafeAppLink>
            )
          })}
        </div>
      </div>
    </section>
  )
}
