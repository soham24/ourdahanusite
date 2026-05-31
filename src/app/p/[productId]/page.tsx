import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ArrowLeft, Package, Wrench } from 'lucide-react'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { fetchProductAndListing } from '@/lib/data/product-detail'

function formatPrice(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

const WA_ICON = (
  <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>
}): Promise<Metadata> {
  const { productId } = await params
  const data = await fetchProductAndListing(productId)
  if (!data?.product) return { title: 'Product | OurDahanu' }

  const { product, listing } = data
  const price = formatPrice(product.price_paise)
  const businessUrl = getCanonicalListingUrl(String(listing?.id ?? ''), listing?.subdomain ?? null)
  const title = `${product.name} — ${price} | ${listing?.name ?? 'OurDahanu'}`
  const description = product.description ?? `${product.name} for ${price}`
  return {
    title,
    description,
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
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ProductContent params={params} />
    </Suspense>
  )
}

async function ProductContent({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  const data = await fetchProductAndListing(productId)
  if (!data?.product) notFound()
  if (!data?.listing) notFound()

  const { product, listing } = data

  const businessUrl = getCanonicalListingUrl(String(listing.id), listing.subdomain as string | null)
  const whatsappNum = ((listing.whatsapp || listing.phone) as string | null)
  const price = formatPrice(product.price_paise)
  const waMsg = encodeURIComponent(
    `Hi! I'm interested in your ${product.type === 'product' ? 'product' : 'service'} — *${product.name}* (${price}).\n\nCan you share more details?\n\n${businessUrl}/p/${product.id}`,
  )
  const waLink = whatsappNum
    ? `https://wa.me/${whatsappNum.replace(/\D/g, '')}?text=${waMsg}`
    : null
  const isOutOfStock = product.quantity_in_stock === 0
  const imageUrl = (product.image_thumb_url || product.image_url) as string | null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Back to listing */}
        <Link
          href={businessUrl}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand transition-colors"
        >
          <ArrowLeft size={14} />
          {String(listing.name)}
        </Link>

        <div className="overflow-hidden rounded-2xl border border-border/50 bg-white shadow-sm">
          {/* Image */}
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={product.name} className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-[#fdf7f0] text-[#c4a990]">
              {product.type === 'service' ? <Wrench size={64} /> : <Package size={64} />}
            </div>
          )}

          <div className="p-5 space-y-3">
            {/* Type badge */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                product.type === 'service'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-orange-50 text-brand'
              }`}
            >
              {product.type === 'service' ? <Wrench size={10} /> : <Package size={10} />}
              {product.type}
            </span>

            <h1 className="text-xl font-extrabold text-gray-900">{product.name}</h1>

            {product.description && (
              <p className="text-sm leading-relaxed text-gray-500">{product.description}</p>
            )}

            <p className="text-2xl font-extrabold text-gray-900">{price}</p>

            {isOutOfStock && (
              <p className="text-sm font-semibold text-red-500">Currently out of stock</p>
            )}

            {/* CTA buttons */}
            <div className="space-y-2 pt-1">
              {waLink && !isOutOfStock && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                >
                  {WA_ICON}
                  {product.type === 'service' ? 'Enquire on WhatsApp' : 'Order on WhatsApp'}
                </a>
              )}
              <Link
                href={businessUrl}
                className="flex w-full items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:border-brand/40 hover:text-brand"
              >
                View full business page
              </Link>
            </div>
          </div>
        </div>

        {/* Powered by */}
        <p className="mt-6 text-center text-xs text-gray-400">
          Listed on{' '}
          <Link href="https://ourdahanu.in" className="hover:text-brand">
            OurDahanu
          </Link>
        </p>
      </div>
    </div>
  )
}
