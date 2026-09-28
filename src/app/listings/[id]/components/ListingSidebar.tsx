"use client"

import React from 'react'
import Link from 'next/link'
import { 
  Phone, MapPin, Navigation, Globe, ExternalLink, Clock, 
  Award, CreditCard, Truck, IndianRupee, AtSign, Share2, 
  CheckCircle, Heart, Edit2 
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { useListingViewer } from '../ListingViewerContext'
import type { ListingRecord } from '@/lib/data/listing-detail'
import { siteConfig } from '@/lib/site'

interface ListingSidebarProps {
  phoneHref: string | null
  phoneLabel: string | null
  displayAddress: string | null
  directionsUrl: string | null
  listing: ListingRecord
  certifications: string[]
  paymentMethods: string[]
  deliveryInfo: { areas?: string; note?: string } | null
  favouriteCount: number
  platformEditUrl: string
}

export default function ListingSidebar({
  phoneHref,
  phoneLabel,
  displayAddress,
  directionsUrl,
  listing,
  certifications,
  paymentMethods,
  deliveryInfo,
  favouriteCount,
  platformEditUrl,
}: ListingSidebarProps) {
  const viewer = useListingViewer()

  return (
    <div className="space-y-4">
      {/* Contact card */}
      <Card id="contact" className="scroll-mt-32 p-5" padding="none">
        <h3 className="font-bold text-sm uppercase tracking-wide text-ink-2/50 mb-4">Contact & Location</h3>
        <div className="space-y-3">
          {phoneHref && (
            <a href={`tel:${phoneHref}`}
              className="flex items-center gap-3 text-sm text-ink-2 hover:text-brand transition-colors group">
              <div className="w-9 h-9 bg-surface-soft group-hover:bg-border rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                <Phone size={15} className="text-brand" />
              </div>
              <div>
                <div className="text-xs text-ink-2/40">Phone</div>
                <div className="font-medium">{phoneLabel}</div>
              </div>
            </a>
          )}
          {displayAddress ? (
            <div className="flex items-start gap-3 text-sm text-ink-2">
              <div className="w-9 h-9 bg-surface-soft rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin size={15} className="text-brand" />
              </div>
              <div>
                <div className="text-xs text-ink-2/40">Address</div>
                <div className="font-medium">{displayAddress}</div>
              </div>
            </div>
          ) : null}
          {directionsUrl && (
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm text-ink-2 hover:text-brand transition-colors group">
              <div className="w-9 h-9 bg-surface-soft group-hover:bg-border rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                <Navigation size={15} className="text-brand" />
              </div>
              <div>
                <div className="text-xs text-ink-2/40">Directions</div>
                <div className="font-medium flex items-center gap-1">Get Directions <ExternalLink size={11} /></div>
              </div>
            </a>
          )}
          {Boolean(listing.website) && (
            <a href={String(listing.website)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm text-ink-2 hover:text-brand transition-colors group">
              <div className="w-9 h-9 bg-surface-soft group-hover:bg-border rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                <Globe size={15} className="text-brand" />
              </div>
              <div>
                <div className="text-xs text-ink-2/40">Website</div>
                <div className="font-medium flex items-center gap-1">Visit Site <ExternalLink size={11} /></div>
              </div>
            </a>
          )}
        </div>
      </Card>

      {/* Hours */}
      {Boolean(listing.hours) && (
        <Card className="p-5" padding="none">
          <h3 className="font-bold text-sm uppercase tracking-wide text-ink-2/50 mb-3 flex items-center gap-2">
            <Clock size={14} className="text-brand" /> Opening Hours
          </h3>
          <pre className="text-xs text-ink-2 whitespace-pre-wrap font-sans leading-relaxed">
            {String(listing.hours)}
          </pre>
        </Card>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <Card className="p-5" padding="none">
          <h3 className="font-bold text-sm uppercase tracking-wide text-ink-2/50 mb-3 flex items-center gap-2">
            <Award size={14} className="text-amber-500" /> Certifications & Awards
          </h3>
          <div className="flex flex-wrap gap-2">
            {certifications.map((c, i) => (
              <Badge key={i} variant="gold" size="sm">
                🏆 {c}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Payment Methods */}
      {paymentMethods.length > 0 && (
        <Card className="p-5" padding="none">
          <h3 className="font-bold text-sm uppercase tracking-wide text-ink-2/50 mb-3 flex items-center gap-2">
            <CreditCard size={14} className="text-brand" /> Payment Accepted
          </h3>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((m, i) => (
              <Badge key={i} variant="default" size="sm">
                {m}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Delivery / Service Area */}
      {(deliveryInfo?.areas || deliveryInfo?.note) && (
        <Card className="p-5" padding="none">
          <h3 className="font-bold text-sm uppercase tracking-wide text-ink-2/50 mb-3 flex items-center gap-2">
            <Truck size={14} className="text-brand" /> Delivery / Service Area
          </h3>
          {deliveryInfo.areas && (
            <p className="text-sm text-ink font-medium">{deliveryInfo.areas}</p>
          )}
          {deliveryInfo.note && (
            <p className="text-xs text-ink-2/50 mt-1">{deliveryInfo.note}</p>
          )}
        </Card>
      )}

      {/* UPI */}
      {Boolean(listing.upi_id) && (
        <Card className="p-5" padding="none">
          <h3 className="font-bold text-sm uppercase tracking-wide text-ink-2/50 mb-3 flex items-center gap-2">
            <IndianRupee size={14} className="text-brand" /> Pay Directly
          </h3>
          <div className="bg-surface-soft border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-ink-2/40 mb-0.5">UPI ID</p>
            <p className="font-mono font-bold text-sm text-ink">{String(listing.upi_id)}</p>
          </div>
        </Card>
      )}

      {/* Social */}
      {Boolean(listing.instagram || listing.facebook) && (
        <Card className="p-5" padding="none">
          <h3 className="font-bold text-sm uppercase tracking-wide text-ink-2/50 mb-3">Follow</h3>
          <div className="space-y-2">
            {Boolean(listing.instagram) && (
              <a href={`https://instagram.com/${String(listing.instagram).replace('@', '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-ink-2 hover:text-pink-600 transition-colors p-2 rounded-xl hover:bg-pink-50">
                <AtSign size={16} className="text-pink-500" />
                @{String(listing.instagram).replace('@', '')}
              </a>
            )}
            {Boolean(listing.facebook) && (
              <a href={String(listing.facebook)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-ink-2 hover:text-blue-600 transition-colors p-2 rounded-xl hover:bg-blue-50">
                <Share2 size={16} className="text-blue-600" />
                Facebook Page
              </a>
            )}
          </div>
        </Card>
      )}

      {/* "Verified by OurDahanu" info */}
      {Boolean(listing.verified) && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <CheckCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-700">Verified by {siteConfig.name}</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Our team has verified this business&apos;s contact details, location, and basic info.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Favourites count */}
      {favouriteCount > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-2.5">
          <Heart size={16} className="text-red-500 fill-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">
            <span className="font-bold">{favouriteCount}</span> {favouriteCount === 1 ? 'person has' : 'people have'} saved this listing
          </p>
        </div>
      )}

      {/* Owner edit shortcut */}
      {viewer.isOwner && (
        <Link href={platformEditUrl}
          className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-border text-brand hover:bg-surface-soft font-semibold py-3 rounded-2xl transition-colors text-sm">
          <Edit2 size={14} /> Edit Your Profile
        </Link>
      )}
    </div>
  )
}
