import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ArrowLeft, Package, Wrench } from 'lucide-react'

import { CatalogActionButton } from '@/components/catalog/CatalogItemCard'
import {
  catalogItemAction,
  catalogPriceLine,
  catalogWhatsAppHref,
  formatPaise,
} from '@/lib/catalog/catalog'
import { fetchProductAndListing } from '@/lib/data/product-detail'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { getServiceImageAspectOption } from '@/lib/service-image'
import { siteConfig } from '@/lib/site'
import { metaDescription, softenLineBreaks } from '@/lib/catalog/description'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>
}): Promise<Metadata> {
  const { productId } = await params
  const data = await fetchProductAndListing(productId)
  if (!data?.listing) return { title: 'Product' }

  const { product, listing } = data
  const price = catalogPriceLine(product)
  const businessUrl = getCanonicalListingUrl(listing.id, listing.subdomain)
  const title = `${product.name} — ${price} | ${listing.name}`
  // Trimmed: WhatsApp, Facebook and X all cut what they are given, and none
  // of them cut it at a word.
  const description = product.description
    ? metaDescription(product.description)
    : `${product.name} (${price}) from ${listing.name} in ${siteConfig.town}.`
  return {
    title,
    description,
    // The product is reachable by id on the main domain and on every
    // subdomain; its home is under its own business.
    alternates: { canonical: `${businessUrl}/p/${product.id}` },
    openGraph: {
      title,
      description,
      url: `${businessUrl}/p/${product.id}`,
      images: product.image_url ? [{ url: product.image_url }] : undefined,
    },
    twitter: {
      card: product.image_url ? 'summary_large_image' : 'summary',
      title,
      description,
      images: product.image_url ? [product.image_url] : undefined,
    },
  }
}

// Root page: non-async, wraps content in Suspense so PPR prerendering
// can build a static shell while the dynamic params/data resolve at request time.
export default function StandaloneProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  return (
    <Suspense fallback={<div className="od-page min-h-screen" />}>
      <ProductContent params={params} />
    </Suspense>
  )
}

async function ProductContent({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  const data = await fetchProductAndListing(productId)
  if (!data?.listing) notFound()

  const { product, listing, shopMode } = data
  const businessUrl = getCanonicalListingUrl(listing.id, listing.subdomain)
  const itemUrl = `${businessUrl}/p/${product.id}`
  const whatsappNum = listing.whatsapp || listing.phone
  const priceLine = catalogPriceLine(product)
  // This page is cached for everyone, so it never knows the viewer: only a
  // live shop shows Buy here. Owners practise on test keys from the business page.
  const action = catalogItemAction(product, shopMode, { isOwner: false, isAdmin: false }, Boolean(whatsappNum))
  const whatsappHref =
    action.kind === 'whatsapp' ? catalogWhatsAppHref(whatsappNum, product, priceLine, itemUrl) : null
  const aspect = getServiceImageAspectOption(product.image_aspect, 'square')
  const imageUrl = product.image_url || product.image_thumb_url
  const isService = product.type === 'service'

  return (
    <div className="od-page min-h-screen">
      <div className="mx-auto max-w-lg px-4 py-6">
        <Link
          href={businessUrl}
          className="mb-5 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
        >
          <ArrowLeft size={14} aria-hidden />
          {listing.name}
        </Link>

        <div className="od-card overflow-hidden">
          {imageUrl ? (
            <div className="bg-[var(--od-surface-soft)]">
              <div
                className={`relative overflow-hidden ${aspect.value === 'portrait' ? 'mx-auto w-3/4' : 'w-full'}`}
                style={{ aspectRatio: aspect.cssAspectRatio }}
              >
                <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
              </div>
            </div>
          ) : null}

          <div className="space-y-3.5 p-6">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--od-surface-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--od-brand-strong)]">
              {isService ? <Wrench size={11} aria-hidden /> : <Package size={11} aria-hidden />}
              {isService ? 'Service' : 'Product'}
            </span>

            <h1 className="font-display text-2xl leading-tight text-[var(--od-ink)]">{product.name}</h1>

            {/* Full text, never clamped: this page exists to tell someone
                about the item, so there is nothing to protect the layout
                from. Bigger and looser than the card's teaser because this
                is meant to be read, not scanned. */}
            {product.description && (
              <p className="whitespace-pre-line text-[15px] leading-7 text-[var(--od-ink-2)]">
                {softenLineBreaks(product.description)}
              </p>
            )}

            <p className="font-display text-[28px] leading-none text-[var(--od-brand-strong)]">{priceLine}</p>

            {product.options.length > 0 && (
              <ul className="divide-y divide-[var(--od-border)] rounded-xl border border-[var(--od-border)]">
                {product.options.map((option) => (
                  <li key={option.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                    <span className="font-semibold text-[var(--od-ink-2)]">{option.label}</span>
                    <span className="font-bold text-[var(--od-ink)]">
                      {formatPaise(option.price_paise)}
                      {option.quantity_in_stock === 0 && (
                        <span className="ml-1.5 font-semibold text-[var(--od-muted)]">· Sold out</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2.5 pt-2">
              <CatalogActionButton action={action} whatsappHref={whatsappHref} size="lg" />
              <Link href={businessUrl} className="od-button-secondary min-h-12 w-full text-sm">
                View full business page
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--od-muted)]">
          Listed on{' '}
          <Link href="https://ourdahanu.in" className="font-semibold hover:text-[var(--od-brand)]">
            OurDahanu
          </Link>
        </p>
      </div>
    </div>
  )
}
