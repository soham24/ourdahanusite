import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { listOwnerCatalogItems } from '@/app/actions/catalog'
import { LISTING_NOT_LIVE_MESSAGE, sellingPausedMessage } from '@/lib/selling/shop-mode'
import { loadShopState } from '@/lib/selling/shop-state'
import { loadSuspensionReason } from '@/lib/selling/suspension-reasons'
import { createClient } from '@/lib/supabase/server'

import { ProductsManager } from './ProductsManager'

export default async function ListingProductsPage({
  params,
}: {
  params: Promise<{ listingId: string }>
}) {
  const { listingId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, category, approved, owner_id, payments_suspended_at, whatsapp, phone')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) notFound()

  if (listing.owner_id !== user.id) {
    redirect('/my-business/products')
  }

  if (!listing.approved) {
    return (
      <div className="od-page min-h-screen py-8 md:py-10">
        <div className="od-shell max-w-2xl">
          <section className="od-card p-6 text-center">
            <p className="text-base font-bold text-[var(--od-ink)]">{LISTING_NOT_LIVE_MESSAGE}</p>
            <Link href="/my-business" className="od-button-secondary mt-4 px-4 py-2.5 text-sm">
              Back to My Business
            </Link>
          </section>
        </div>
      </div>
    )
  }

  if (listing.payments_suspended_at) {
    return (
      <div className="od-page min-h-screen py-8 md:py-10">
        <div className="od-shell max-w-2xl">
          <section className="od-card p-6 text-center">
            <p className="text-base font-bold text-[var(--od-ink)]">
              {sellingPausedMessage(await loadSuspensionReason(listing.id))}
            </p>
            <Link href="/my-business" className="od-button-secondary mt-4 px-4 py-2.5 text-sm">
              Back to My Business
            </Link>
          </section>
        </div>
      </div>
    )
  }

  const [items, shop] = await Promise.all([listOwnerCatalogItems(listingId), loadShopState(listingId)])

  return (
    <div className="od-page min-h-screen py-6 md:py-10">
      <div className="od-shell max-w-2xl space-y-5">
        <Link
          href="/my-business/products"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
        >
          <ArrowLeft size={14} aria-hidden />
          All businesses
        </Link>

        <header>
          <p className="od-eyebrow">{listing.category ?? 'Business'}</p>
          <h1 className="od-section-title mt-1 text-3xl md:text-4xl">{listing.name}</h1>
          <p className="od-muted mt-2 text-sm leading-relaxed">
            Your products and services. Changes show on your business page straight away.
          </p>
        </header>

        <ProductsManager
          listingId={listingId}
          shopMode={shop?.mode ?? 'off'}
          whatsappNumber={listing.whatsapp || listing.phone || null}
          initialItems={items}
        />
      </div>
    </div>
  )
}
