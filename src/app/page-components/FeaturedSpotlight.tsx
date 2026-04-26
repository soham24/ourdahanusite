import Image from 'next/image'
import { ArrowRight, MapPin, Star, CheckCircle2 } from 'lucide-react'
import SafeAppLink from '@/components/SafeAppLink'
import { summarizeAddress } from '@/lib/listing-content'
import { LISTING_CATEGORY_EMOJIS } from '@/lib/listing-category'
import { getListingHref } from '@/lib/listing-url'
import type { FeaturedListing } from '@/lib/data/home'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'

export default function FeaturedSpotlight({ listing }: { listing: FeaturedListing }) {
  const href = getListingHref(listing.id, listing.subdomain)
  const address = summarizeAddress(listing.address, 2)
  const categoryEmoji = LISTING_CATEGORY_EMOJIS[listing.category] ?? '🏪'

  return (
    <section className="py-10 md:py-14">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6">
        <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="od-eyebrow">
              Editor's Choice
            </p>
            <h2 className="font-display text-[26px] md:text-[30px] leading-[1.15] text-[var(--od-ink)] mt-1">
              Featured Spotlight
            </h2>
          </div>
          <SafeAppLink
            href="/listings"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--od-brand)] hover:text-[var(--od-brand-strong)] transition-colors"
          >
            View All <ArrowRight size={13} />
          </SafeAppLink>
        </div>

        <Card padding="none" hover className="md:grid md:grid-cols-[400px_1fr] max-w-full md:max-w-[920px] md:mx-auto">
          {/* Image — top on mobile, left on desktop */}
          <div
            className="relative aspect-[16/10] md:aspect-auto md:h-full overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--color-sand), var(--color-terra))' }}
          >
            {listing.image_thumb_url || listing.image_url ? (
              <Image
                src={(listing.image_thumb_url || listing.image_url) as string}
                alt={listing.name}
                fill
                sizes="(min-width: 768px) 400px, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[80px] text-white/30" aria-hidden>
                🏪
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <Badge variant="gold" className="absolute top-4 left-4">
              ⭐ Featured
            </Badge>
          </div>

          {/* Content — below image on mobile, right on desktop */}
          <div className="p-6 md:p-8 md:flex md:flex-col md:justify-center">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <h3 className="font-display text-[24px] md:text-[28px] leading-[1.2] text-[var(--od-ink)] mb-1.5">
                  {listing.name}
                </h3>
                {address && (
                  <div className="flex items-center gap-1 text-[var(--od-muted)] text-[13px]">
                    <MapPin size={13} />
                    <span>{address}</span>
                  </div>
                )}
              </div>
              {listing.rating && listing.rating > 0 ? (
                <div className="flex items-center gap-1 bg-[var(--od-surface-soft)] border border-[var(--od-border)] text-[var(--od-ink)] px-2.5 py-1 rounded-lg flex-shrink-0">
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  <span className="font-bold text-xs">{listing.rating.toFixed(1)}</span>
                </div>
              ) : (
                <Badge variant="brand" size="sm">New</Badge>
              )}
            </div>

            {listing.tagline && (
              <p className="text-sm text-[var(--od-muted)] leading-[1.6] line-clamp-2 mb-4">
                {listing.tagline}
              </p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="brand">
                {categoryEmoji} {listing.category}
              </Badge>
              {listing.verified && (
                <Badge variant="success">
                  <CheckCircle2 size={11} /> Verified
                </Badge>
              )}
              <SafeAppLink
                href={href}
                className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--od-brand)] hover:text-[var(--od-brand-strong)] hover:gap-2.5 transition-all"
              >
                Visit Page
                <ArrowRight size={13} />
              </SafeAppLink>
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}
