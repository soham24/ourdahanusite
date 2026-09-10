"use client"

import React from 'react'
import { Video, Sparkles, CheckCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import PhotoGalleryDeferred from '../PhotoGalleryDeferred'
import BeforeAfterToggleDeferred from '../BeforeAfterToggleDeferred'
import ServicesSection from '../ServicesSection'
import ProductCard from '@/components/ProductCard'
import BuyButton from '@/components/BuyButton'
import BookingWidget from '@/components/appointments/BookingWidget'
import { useListingViewer } from '../ListingViewerContext'

interface ListingContentProps {
  listing: any
  photos: string[]
  beforeAfter: { before: string; after: string } | null
  videoEmbedId: string | null
  highlights: { label: string; value: string }[]
  services: any[]
  listingId: string
  whatsappNum: string | null
  businessUrl: string
  marketplaceReady: boolean
  marketplaceProducts: any[]
  appointmentsEnabled: boolean
  appointmentSettings: any
  appointmentBookingFee: number
}

export default function ListingContent({
  listing,
  photos,
  beforeAfter,
  videoEmbedId,
  highlights,
  services,
  listingId,
  whatsappNum,
  businessUrl,
  marketplaceReady,
  marketplaceProducts,
  appointmentsEnabled,
  appointmentSettings,
  appointmentBookingFee,
}: ListingContentProps) {
  const viewer = useListingViewer()

  return (
    <div className="lg:col-span-2 space-y-5">
      {/* About */}
      {listing.description && (
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

      {/* Services & Products */}
      {services.length > 0 && (
        <Card id="services" className="scroll-mt-32">
          <h2 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-brand rounded-full inline-block" />
            Services & Products
          </h2>
          <ServicesSection
            services={services}
            listing={{
              id:       listingId,
              name:     String(listing.name),
              upi_id:   listing.upi_id ?? null,
              whatsapp: listing.whatsapp ?? null,
            }}
            whatsappNum={whatsappNum}
            businessUrl={businessUrl}
            userName={viewer.name}
            userEmail={viewer.email}
          />
        </Card>
      )}

      {/* Marketplace — shoppable products & services */}
      {marketplaceReady && marketplaceProducts.length > 0 && (
        <Card id={services.length > 0 ? undefined : 'services'} className="scroll-mt-32">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span className="w-1 h-4 bg-brand rounded-full inline-block" />
              Shop
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
              <CheckCircle size={11} />
              Direct payment to {String(listing.name)}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {marketplaceProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                shareUrl={`${businessUrl}/p/${product.id}`}
                buySlot={
                  <BuyButton
                    product={{
                      id: product.id,
                      name: product.name,
                      pricePaise: product.price_paise,
                      quantityInStock: product.quantity_in_stock,
                      listingName: String(listing.name),
                      type: product.type,
                    }}
                    isSignedIn={viewer.isLoggedIn}
                  />
                }
              />
            ))}
          </div>
        </Card>
      )}

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
