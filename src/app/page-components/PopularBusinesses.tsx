import Image from 'next/image'
import { Star, MapPin, CheckCircle2 } from 'lucide-react'
import SafeAppLink from '@/components/SafeAppLink'
import { getListingHref } from '@/lib/listing-url'
import { summarizeAddress } from '@/lib/listing-content'
import SectionHeader from '@/components/ui/SectionHeader'
import Card from '@/components/ui/Card'
import type { HomeListing } from '@/lib/data/home'

interface PopularBusinessesProps {
  listings: HomeListing[]
}

export default function PopularBusinesses({ listings }: PopularBusinessesProps) {
  if (listings.length === 0) return null

  return (
    <section className="bg-[var(--color-cream)]/40 py-16 border-y border-[var(--color-border)]">
      <div className="max-w-[1160px] mx-auto px-6">
        <SectionHeader
          label="Popular"
          title="Around Dahanu"
          sub="Trusted and highly-reviewed local businesses"
          viewAllHref="/listings"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
          {listings.map((listing) => {
            const href = getListingHref(listing.id, listing.subdomain)
            const address = summarizeAddress(listing.address, 2)
            return (
              <Card
                key={listing.id}
                padding="none"
                hover
                className="border-[var(--color-border)]"
              >
                <SafeAppLink href={href} className="group block">
                  <div
                    className="relative h-[180px] overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, var(--color-muted), #E8C49A)' }}
                  >
                    {listing.image_url ? (
                      <Image
                        src={listing.image_url}
                        alt={listing.name}
                        fill
                        sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[52px] text-[var(--color-brand)]/20">
                        🏪
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                    <span className="absolute bottom-3 left-3 bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                      {listing.category}
                    </span>
                    {listing.verified && (
                      <span className="absolute top-3 right-3 bg-blue-700 text-white text-[10px] font-bold px-2.5 py-[3px] rounded-full flex items-center gap-1">
                        <CheckCircle2 size={9} />
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="p-[18px]">
                    <h3 className="font-bold text-[16px] text-[var(--color-bark)] leading-[1.25] mb-1 group-hover:text-[var(--color-brand)] transition-colors">
                      {listing.name}
                    </h3>
                    {listing.tagline && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate mb-3">{listing.tagline}</p>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      {listing.rating && listing.rating > 0 ? (
                        <div className="flex items-center gap-1">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          <span className="font-bold text-[13px] text-[var(--color-bark)]">
                            {listing.rating.toFixed(1)}
                          </span>
                          <span className="text-[var(--color-text-muted)]">({listing.review_count ?? 0})</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-muted)] px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                      {address && (
                        <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
                          <MapPin size={10} />
                          <span className="truncate max-w-[110px]">{address}</span>
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
