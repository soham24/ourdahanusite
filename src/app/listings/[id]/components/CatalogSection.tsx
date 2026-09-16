'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

import Card from '@/components/ui/Card'
import CatalogItemCard from '@/components/catalog/CatalogItemCard'
import { catalogItemAction, catalogPriceLine, catalogWhatsAppHref } from '@/lib/catalog/catalog'
import type { CatalogItem } from '@/lib/catalog/types'
import type { ShopMode } from '@/lib/selling/shop-mode'
import { useListingViewer } from '../ListingViewerContext'

const INITIAL_VISIBLE = 8

export default function CatalogSection({
  items,
  shopMode,
  listingName,
  businessUrl,
  whatsappNum,
}: {
  items: CatalogItem[]
  shopMode: ShopMode
  listingName: string
  businessUrl: string
  whatsappNum: string | null
}) {
  const viewer = useListingViewer()
  const [showAll, setShowAll] = useState(false)

  if (items.length === 0) return null

  // The server refuses checkout on a test shop for anyone but its owner, so
  // this only decides which button to show.
  const buyer = { isOwner: viewer.isOwner, isAdmin: false }
  const ownerTesting = shopMode === 'test' && viewer.isOwner
  const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE)

  return (
    <Card id="services" className="scroll-mt-32">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <span className="inline-block h-4 w-1 rounded-full bg-brand" />
          Products &amp; Services
        </h2>
        {shopMode === 'live' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
            <CheckCircle size={11} aria-hidden />
            Pay online · straight to {listingName}
          </span>
        )}
        {ownerTesting && (
          <span className="inline-flex items-center rounded-full bg-[rgba(200,136,30,0.14)] px-2.5 py-1 text-[11px] font-bold text-[var(--od-brand-strong)]">
            Test mode
          </span>
        )}
      </div>

      {ownerTesting && (
        <p
          role="note"
          className="mb-4 rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--od-ink-2)]"
        >
          Test mode · only you see Buy buttons. Try a practice purchase — no real money moves.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((item) => {
          const itemUrl = `${businessUrl}/p/${item.id}`
          const action = catalogItemAction(item, shopMode, buyer, Boolean(whatsappNum))
          return (
            <CatalogItemCard
              key={item.id}
              item={item}
              action={action}
              whatsappHref={
                action.kind === 'whatsapp' ? catalogWhatsAppHref(whatsappNum, item, catalogPriceLine(item), itemUrl) : null
              }
              shareUrl={itemUrl}
            />
          )
        })}
      </div>

      {!showAll && items.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="od-button-secondary mt-4 min-h-11 w-full text-sm"
        >
          Show all {items.length} items
        </button>
      )}
    </Card>
  )
}
