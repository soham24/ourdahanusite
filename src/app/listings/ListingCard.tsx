import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, Star, CheckCircle } from 'lucide-react'

import { formatPhoneForDisplay, normalizePhoneOrNull, summarizeAddress } from '@/lib/listing-content'
import { getListingHref } from '@/lib/listing-url'

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
    <div className="relative bg-white rounded-2xl border border-gray-100 hover:border-warli-sand hover:shadow-md transition-all p-6">
      <Link href={href} className="absolute inset-0 z-0 rounded-2xl" aria-label={`View ${listing.name}`} />

      <div className="relative z-10 flex items-start gap-4">
        <div className="relative w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
          {listing.image_url?.startsWith('http') ? (
            <Image src={listing.image_url} alt={listing.name} fill className="object-cover" sizes="56px" />
          ) : (
            <span>{listing.icon || '🏪'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="font-bold text-gray-900 text-lg leading-tight">{listing.name}</h2>
            {badge ? (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                  badge === 'Featured' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {badge === 'Verified' ? <CheckCircle size={10} className="inline mr-0.5" /> : null}
                {badge}
              </span>
            ) : null}
          </div>
          <span className="text-xs text-chikoo-brown bg-warli-light px-2 py-0.5 rounded-full">{listing.category}</span>
        </div>
      </div>

      {summary ? (
        <p className="relative z-10 mt-3 mb-3 line-clamp-2 text-sm leading-relaxed text-gray-500">{summary}</p>
      ) : null}

      {listing.tags && listing.tags.length > 0 ? (
        <div className="relative z-10 flex flex-wrap gap-1.5 mb-3">
          {listing.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative z-10 flex flex-col gap-1.5 text-sm text-gray-500">
        {listing.address ? (
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-warli-terra flex-shrink-0" />
            <span className="line-clamp-1">{shortAddress}</span>
          </div>
        ) : null}
        {phoneLabel ? (
          <div className="flex items-center gap-2">
            <Phone size={13} className="text-warli-terra flex-shrink-0" />
            {phoneLabel}
          </div>
        ) : null}
      </div>

      <div className="relative z-10 flex items-center justify-between mt-4">
        <div className="flex items-center gap-1">
          {listing.rating && listing.rating > 0 ? (
            <>
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-semibold text-gray-700">{listing.rating.toFixed(1)}</span>
              <span className="text-xs text-gray-400">({reviewCount} reviews)</span>
            </>
          ) : (
            <span className="text-xs font-medium text-gray-400">New listing</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={href}
            className="relative z-20 border border-gray-200 text-gray-600 hover:border-warli-sand hover:bg-warli-light text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            View
          </Link>
          {phoneHref ? (
            <a
              href={`tel:${phoneHref}`}
              className="relative z-20 bg-warli-terra hover:bg-warli-deep text-warli-cream text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Call Now
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
