import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getDeliveryConfig } from '@/app/actions/delivery'
import EmptyState from '@/components/ui/EmptyState'

import { DeliveryStore, type StoreProduct } from './DeliveryStore'

export default async function DeliveryStorePage({
  params,
}: {
  params: Promise<{ listingId: string }>
}) {
  const { listingId } = await params
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, category, approved, lat, lng')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing || !listing.approved) notFound()

  const config = await getDeliveryConfig(listingId)

  const { data: products } = await supabase
    .from('listing_products')
    .select('id, name, description, price_paise, quantity_in_stock, image_thumb_url, image_url, is_active')
    .eq('listing_id', listingId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const items = (products ?? []) as StoreProduct[]

  return (
    <div className="od-page min-h-screen">
      <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6">
        <Link href="/delivery" className="inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] hover:text-brand transition-colors">
          <ArrowLeft size={14} /> All delivery shops
        </Link>

        <header className="mt-4 mb-6">
          {listing.category && <p className="od-eyebrow">{listing.category}</p>}
          <h1 className="mt-1 font-display text-3xl text-[var(--od-ink)]">{listing.name}</h1>
        </header>

        {!config.delivery_enabled ? (
          <EmptyState icon="🛵" title="Delivery is currently off" description="This shop isn't accepting delivery orders right now." />
        ) : items.length === 0 ? (
          <EmptyState icon="🧺" title="No items yet" description="This shop hasn't added products for delivery yet." />
        ) : (
          <DeliveryStore
            listingId={listing.id}
            listingName={listing.name}
            config={config}
            products={items}
          />
        )}
      </div>
    </div>
  )
}
