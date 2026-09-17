"use client"

import React from 'react'
import dynamic from 'next/dynamic'
import { Video, Sparkles } from 'lucide-react'
import Card from '@/components/ui/Card'
import PhotoGalleryDeferred from '../PhotoGalleryDeferred'
import BeforeAfterToggleDeferred from '../BeforeAfterToggleDeferred'
const BookingWidget = dynamic(() => import('@/components/appointments/BookingWidget'), {
  loading: () => <div className="min-h-40 rounded-2xl bg-surface-soft animate-pulse" aria-hidden="true" />,
})
import { useListingViewer } from '../ListingViewerContext'
import type { ListingRecord } from '@/lib/data/listing-detail'
import type { CatalogItem } from '@/lib/catalog/types'
import type { ShopMode } from '@/lib/selling/shop-mode'
import type { AppointmentSettings } from '@/lib/listing-content'
import CatalogSection from './CatalogSection'

interface ListingContentProps {
  listing: ListingRecord
  photos: string[]
  beforeAfter: { before: string; after: string } | null
  videoEmbedId: string | null
  highlights: { label: string; value: string }[]
  listingId: string
  whatsappNum: string | null
  businessUrl: string
  shopMode: ShopMode
  catalogItems: CatalogItem[]
  appointmentsEnabled: boolean
  appointmentSettings: AppointmentSettings | null
  appointmentBookingFee: number
}

export default function ListingContent({
  listing,
  photos,
  beforeAfter,
  videoEmbedId,
  highlights,
  listingId,
  whatsappNum,
  businessUrl,
  shopMode,
  catalogItems,
  appointmentsEnabled,
  appointmentSettings,
  appointmentBookingFee,
}: ListingContentProps) {
  const viewer = useListingViewer()

  return (
    <div className="lg:col-span-2 space-y-5">
      {/* About */}
      {Boolean(listing.description) && (
        <Card id="about" className="scroll-mt-32">
          <h2 className="text-base font-bold text-ink mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-brand rounded-full inline-block" />
            About
          </h2>
          <p className="text-ink-2/70 text-sm leading-relaxed whitespace-pre-line">
            {String(listing.description)}
          </p>
        </Card>
      )}

      {/* Photo Gallery */}
      {photos.length > 0 && (
        <Card id="photos" className="scroll-mt-32">
          <h2 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-brand rounded-full inline-block" />
            Gallery
          </h2>
          <PhotoGalleryDeferred photos={photos} />
        </Card>
      )}

      {/* Before/After */}
      {beforeAfter?.before && beforeAfter?.after && (
        <Card id="before-after" className="scroll-mt-32">
          <h2 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-brand rounded-full inline-block" />
            Before & After
          </h2>
          <BeforeAfterToggleDeferred before={beforeAfter.before} after={beforeAfter.after} />
        </Card>
      )}

      {/* YouTube Video */}
      {videoEmbedId && (
        <Card id="video" className="scroll-mt-32">
          <h2 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-brand rounded-full inline-block" />
            <Video size={15} className="text-brand" />
            Watch
          </h2>
          <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoEmbedId}`}
              title="Business video"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </Card>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <Card id="highlights" className="scroll-mt-32">
          <h2 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-brand rounded-full inline-block" />
            <Sparkles size={14} className="text-brand" />
            Why Choose Us
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {highlights.map((h, i) => (
              <div key={i} className="bg-surface-soft border border-border rounded-xl p-4 text-center">
                <div className="text-xl font-bold text-brand">{h.value}</div>
                <div className="text-xs text-ink-2/60 mt-0.5">{h.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <CatalogSection
        items={catalogItems}
        shopMode={shopMode}
        listingName={String(listing.name)}
        businessUrl={businessUrl}
        whatsappNum={whatsappNum}
      />

      {appointmentsEnabled && appointmentSettings && (
        <BookingWidget
          listingId={listingId}
          listingName={String(listing.name)}
          bookingFee={appointmentBookingFee}
          appointmentSettings={appointmentSettings}
          isLoggedIn={viewer.isLoggedIn}
          userName={viewer.name}
          userPhone={viewer.phone}
          userEmail={viewer.email}
        />
      )}
    </div>
  )
}
