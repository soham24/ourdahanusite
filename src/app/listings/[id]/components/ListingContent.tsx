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
import type { ListingRecord, ListingProductPublic } from '@/lib/data/listing-detail'
import type { ShopMode } from '@/lib/selling/shop-mode'
import type { NormalizedService, AppointmentSettings } from '@/lib/listing-content'

interface ListingContentProps {
  listing: ListingRecord
  photos: string[]
  beforeAfter: { before: string; after: string } | null
  videoEmbedId: string | null
  highlights: { label: string; value: string }[]
  services: NormalizedService[]
  listingId: string
  whatsappNum: string | null
  businessUrl: string
  shopMode: ShopMode
  marketplaceProducts: ListingProductPublic[]
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
  services,
  listingId,
  whatsappNum,
  businessUrl,
  shopMode,
  marketplaceProducts,
  appointmentsEnabled,
  appointmentSettings,
  appointmentBookingFee,
}: ListingContentProps) {
  const viewer = useListingViewer()
  // A shop on test keys is a rehearsal: only its owner sees it. The server
  // refuses checkout for anyone else too (see /checkout and
  // create-marketplace-order), so this is presentation, not the safeguard.
  const showShop =
    marketplaceProducts.length > 0 &&
    (shopMode === 'live' || (shopMode === 'test' && viewer.isOwner))

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
              upi_id:   (listing.upi_id as string | null) ?? null,
              whatsapp: (listing.whatsapp as string | null) ?? null,
            }}
            whatsappNum={whatsappNum}
            businessUrl={businessUrl}
            userName={viewer.name}
            userEmail={viewer.email}
          />
        </Card>
      )}

      {/* Marketplace — shoppable products & services */}
      {showShop && (
        <Card id={services.length > 0 ? undefined : 'services'} className="scroll-mt-32">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span className="w-1 h-4 bg-brand rounded-full inline-block" />
              Shop
            </h2>
            {shopMode === 'live' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                <CheckCircle size={11} />
                Direct payment to {String(listing.name)}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[rgba(200,136,30,0.14)] px-2.5 py-1 text-[11px] font-bold text-[var(--od-brand-strong)]">
                Test mode
              </span>
            )}
          </div>
          {shopMode === 'test' && (
            <p
              role="note"
              className="mb-4 rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--od-ink-2)]"
            >
              Test mode · only you can see your shop. Try a practice purchase — no real money moves.
            </p>
          )}
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
