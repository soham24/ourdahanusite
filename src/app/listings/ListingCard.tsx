import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, Star, CheckCircle } from 'lucide-react'

import { formatPhoneForDisplay, normalizePhoneOrNull, summarizeAddress } from '@/lib/listing-content'
import { getListingHref } from '@/lib/listing-url'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface Listing {
  id: string | number
  name: string
  category: string
  subdomain?: string | null
  tagline?: string | null
  phone?: string | null
  address?: string | null
  rating?: number | null
  reviews?: number | null
  review_count?: number | null
  badge?: string | null
  icon?: string
  description?: string | null
  tags?: string[]
  image_url?: string | null
  plan?: string | null
  verified?: boolean | null
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const href = getListingHref(listing.id, listing.subdomain)
  const summary = listing.tagline || listing.description
  const shortAddress = summarizeAddress(listing.address, 2)
  const phoneHref = normalizePhoneOrNull(listing.phone)
  const phoneLabel = formatPhoneForDisplay(listing.phone)
  const reviewCount = listing.review_count ?? listing.reviews ?? 0
  const badge =
    listing.badge ??
    (listing.plan === 'featured' || listing.plan === 'premium'
      ? 'Featured'
      : listing.verified
        ? 'Verified'
        : null)

  return (
    <Card hover className="relative overflow-hidden" padding="md">
      <Link href={href} className="absolute inset-0 z-0" aria-label={`View ${listing.name}`} />

      <div className="relative z-10 flex items-start gap-4">
        <div className="relative flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--od-surface-soft)] text-3xl border border-[var(--od-border)]">
          {listing.image_url ? (
            <Image src={listing.image_url} alt={listing.name} fill className="object-cover" sizes="72px" />
          ) : (
            <span>{listing.icon || '🏪'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h2 className="text-lg font-extrabold leading-tight text-[var(--od-ink)]">{listing.name}</h2>
            {badge ? (
              <Badge
                variant={badge === 'Featured' ? 'gold' : 'brand'}
                size="xs"
                className="whitespace-nowrap flex-shrink-0"
              >
                {badge === 'Verified' ? <CheckCircle size={10} className="inline mr-0.5" /> : null}
                {badge}
              </Badge>
            ) : null}
          </div>
          <Badge variant="outline" size="sm" className="font-semibold">{listing.category}</Badge>
        </div>
      </div>

      {summary ? (
        <p className="relative z-10 mt-4 mb-4 line-clamp-2 text-sm leading-relaxed text-[var(--od-muted)]">{summary}</p>
      ) : null}

      {listing.tags && listing.tags.length > 0 ? (
        <div className="relative z-10 flex flex-wrap gap-1.5 mb-4">
          {listing.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[var(--od-surface-soft)] border border-[var(--od-border)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--od-ink-2)]">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative z-10 flex flex-col gap-2 text-[13px] text-[var(--od-muted)]">
        {listing.address ? (
          <div className="flex items-center gap-2">
            <MapPin size={13} className="flex-shrink-0 text-[var(--od-brand)]" />
            <span className="line-clamp-1">{shortAddress}</span>
          </div>
        ) : null}
        {phoneLabel ? (
          <div className="flex items-center gap-2">
            <Phone size={13} className="flex-shrink-0 text-[var(--od-brand)]" />
            {phoneLabel}
          </div>
        ) : null}
      </div>

      <div className="relative z-10 flex items-center justify-between mt-5 pt-4 border-t border-[var(--od-border)]">
        <div className="flex items-center gap-1.5">
          {listing.rating && listing.rating > 0 ? (
            <>
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-bold text-[var(--od-ink-2)]">{listing.rating.toFixed(1)}</span>
              <span className="text-xs text-[var(--od-muted)]">({reviewCount})</span>
            </>
          ) : (
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--od-muted)]">New listing</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            href={href}
            variant="secondary"
            size="sm"
            className="relative z-20"
          >
            View
          </Button>
          {phoneHref ? (
            <Button
              href={`tel:${phoneHref}`}
              variant="primary"
              size="sm"
              className="relative z-20"
            >
              Call Now
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
