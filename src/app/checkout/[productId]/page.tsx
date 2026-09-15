import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, PackageX, Store } from 'lucide-react'

import { getUserRole } from '@/app/actions/admin'
import { fetchProductAndListing } from '@/lib/data/product-detail'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { SHOP_NOT_OPEN_MESSAGE, canBuyFromShop } from '@/lib/selling/shop-mode'
import { loadShopState } from '@/lib/selling/shop-state'
import { createClient } from '@/lib/supabase/server'
import CheckoutForm from './CheckoutForm'

// Checkout is per-buyer and must never be cached or indexed.
export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
}

function CheckoutUnavailable({
  icon,
  title,
  message,
  businessUrl,
  listingName,
}: {
  icon: React.ReactNode
  title: string
  message: string
  businessUrl: string
  listingName: string
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-soft)] text-[var(--od-muted)]">
        {icon}
      </span>
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="max-w-xs text-sm leading-relaxed text-[var(--od-muted)]">{message}</p>
      <Link href={businessUrl} className="od-button-primary mt-1 px-4 py-2 text-sm">
        Back to {listingName}
      </Link>
    </div>
  )
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params

  const data = await fetchProductAndListing(productId)
  if (!data?.product || !data.listing) notFound()
  const { product, listing } = data

  // Reading auth cookies makes this route dynamic automatically — no
  // `export const dynamic` needed.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/checkout/${productId}`)}`)
  }

  const businessUrl = getCanonicalListingUrl(String(listing.id), listing.subdomain)

  // Uncached: a shop on test keys sells only to its owner (and admins).
  const [shop, { role }, { data: profile }] = await Promise.all([
    loadShopState(String(listing.id)),
    getUserRole(supabase),
    supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
  ])

  if (!shop || !canBuyFromShop(shop.mode, { isOwner: shop.ownerId === user.id, isAdmin: role === 'admin' })) {
    return (
      <CheckoutUnavailable
        icon={<Store size={30} aria-hidden />}
        title="Not open yet"
        message={SHOP_NOT_OPEN_MESSAGE}
        businessUrl={businessUrl}
        listingName={listing.name}
      />
    )
  }

  if (product.quantity_in_stock === 0) {
    return (
      <CheckoutUnavailable
        icon={<PackageX size={30} aria-hidden />}
        title="Sold out"
        message={`${product.name} is out of stock right now. ${listing.name} may restock it soon.`}
        businessUrl={businessUrl}
        listingName={listing.name}
      />
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <Link
        href={businessUrl}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
      >
        <ArrowLeft size={14} aria-hidden />
        {listing.name}
      </Link>

      <CheckoutForm
        product={{
          id: product.id,
          name: product.name,
          pricePaise: product.price_paise,
          quantityInStock: product.quantity_in_stock,
          type: product.type,
          imageUrl: product.image_thumb_url || product.image_url,
        }}
        listing={{ id: String(listing.id), name: listing.name, whatsapp: listing.whatsapp }}
        businessUrl={businessUrl}
        buyerName={profile?.full_name || user.email?.split('@')[0] || ''}
        buyerPhone={profile?.phone || ''}
        buyerEmail={user.email ?? ''}
        testMode={shop.mode === 'test'}
      />
    </div>
  )
}
