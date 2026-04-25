import Image from 'next/image'
import { Star, MapPin, CheckCircle2 } from 'lucide-react'
import SafeAppLink from '@/components/SafeAppLink'
import { getListingHref } from '@/lib/listing-url'
import { summarizeAddress } from '@/lib/listing-content'
import SectionHeader from '@/components/ui/SectionHeader'
import Card from '@/components/ui/Card'
import type { HomeListing } from '@/lib/data/home'

interface NewListingsSectionProps {
  newListings: HomeListing[]
}

export default function NewListingsSection({ newListings }: NewListingsSectionProps) {
  if (newListings.length === 0) return null

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6 mb-6">
        <SectionHeader
          label="Just added"
          title="What's New"
          sub="Fresh additions — be the first to check them out"
          viewAllHref="/listings"
        />
      </div>
      <div className="max-w-[1160px] mx-auto">
        <div className="flex overflow-x-auto scrollbar-hide gap-4 px-5 md:px-6 pb-4 snap-x">
          {newListings.map((listing) => {
            const href = getListingHref(listing.id, listing.subdomain)
            const address = summarizeAddress(listing.address, 2)
            return (
              <Card
                key={listing.id}
                padding="none"
                hover
                className="min-w-[280px] sm:min-w-[300px] snap-start flex-shrink-0 border-[var(--color-border)]"
              >
                <SafeAppLink href={href} className="group block">
                  <div
                    className="relative h-[170px] overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, var(--color-muted), #E8C49A)' }}
                  >
                    {listing.image_url ? (
                      <Image
                        src={listing.image_url}
                        alt={listing.name}
                        fill
                        sizes="300px"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[52px] text-[var(--color-brand)]/20">
                        🏪
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                    <span className="absolute top-3 left-3 bg-[#C8881E] text-[var(--color-bark)] text-[10px] font-bold px-2.5 py-[3px] rounded-full uppercase tracking-wide">
                      New
                    </span>
                    {listing.verified && (
                      <span className="absolute top-3 right-3 bg-blue-700 text-white text-[10px] font-bold px-2.5 py-[3px] rounded-full flex items-center gap-1">
                        <CheckCircle2 size={9} />
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <span className="font-label-sm text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand)]">
                      {listing.category}
                    </span>
                    <h4 className="font-display text-[18px] text-[var(--color-bark)] leading-[1.25] mt-1 group-hover:text-[var(--color-brand)] transition-colors line-clamp-2">
                      {listing.name}
                    </h4>
                    {listing.tagline && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5 line-clamp-1">
                        {listing.tagline}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs mt-3">
                      {listing.rating && listing.rating > 0 ? (
                        <div className="flex items-center gap-1">
                          <Star size={11} className="fill-amber-400 text-amber-400" />
                          <span className="font-bold text-[12px] text-[var(--color-bark)]">
                            {listing.rating.toFixed(1)}
                          </span>
                          <span className="text-[var(--color-text-muted)]">({listing.review_count ?? 0})</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-muted)] px-2 py-0.5 rounded-full">
                          Be the first
                        </span>
                      )}
                      {address && (
                        <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
                          <MapPin size={10} />
                          <span className="truncate max-w-[100px]">{address}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </SafeAppLink>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
