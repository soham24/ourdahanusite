import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import {
  DEFAULT_SERVICE_IMAGE_ASPECT,
  getServiceImageAspectOption,
} from '@/lib/service-image'
import { fetchListingAndService } from '@/lib/data/service-detail'

// generateMetadata cannot call headers() at build time — return generic fallback.
// Full OG data is available at request time via the page component.
export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Service | OurDahanu' }
}

const WA_ICON = (
  <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

export default async function StandaloneServicePage({
  params,
}: {
  params: Promise<{ index: string }>
}) {
  const { index } = await params
  const serviceIndex = Number(index)

  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  if (!subdomain || Number.isNaN(serviceIndex)) notFound()

  const result = await fetchListingAndService(subdomain, serviceIndex)
  if (!result) notFound()

  const { listing, service } = result
  const businessUrl = getCanonicalListingUrl(String(listing.id), listing.subdomain as string | null)
  const whatsappNum = ((listing.whatsapp || listing.phone) as string | null)
  const imageAspect = getServiceImageAspectOption(service.imageAspect, DEFAULT_SERVICE_IMAGE_ASPECT)

  const waMsg = encodeURIComponent(
    `Hi! I'm interested in your ${service.type === 'product' ? 'product' : 'service'} — *${service.name}*${service.price ? ` (${service.price})` : ''}.\n\nCan you share more details?\n\n${businessUrl}/s/${serviceIndex}`,
  )
  const waLink = whatsappNum
    ? `https://wa.me/${whatsappNum.replace(/\D/g, '')}?text=${waMsg}`
    : null

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
          {service.image && (
            <div
              className={`relative overflow-hidden bg-gray-100 ${imageAspect.value === 'portrait' ? 'p-4' : ''}`}
            >
              <div
                className={`relative overflow-hidden ${imageAspect.value === 'portrait' ? 'mx-auto max-w-72 rounded-xl' : 'w-full'}`}
                style={{ aspectRatio: imageAspect.cssAspectRatio }}
              >
                <Image
                  src={service.image}
                  alt={service.name}
                  fill
                  sizes={
                    imageAspect.value === 'portrait'
                      ? '(max-width: 640px) 75vw, 288px'
                      : '(max-width: 640px) 100vw, 512px'
                  }
                  className="object-cover"
                />
              </div>
            </div>
          )}

          <div className="p-5 space-y-3">
            {/* Type badge */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                service.type === 'product'
                  ? 'bg-blue-100 text-blue-600'
                  : 'border border-border bg-surface-soft text-brand'
              }`}
            >
              {service.type === 'product' ? '📦 Product' : '🛠 Service'}
            </span>

            <h1 className="text-xl font-extrabold text-gray-900">{service.name}</h1>

            {service.desc && (
              <p className="text-sm leading-relaxed text-gray-500">{service.desc}</p>
            )}

            {service.price && (
              <p className="text-2xl font-extrabold text-gray-900">{service.price}</p>
            )}

            {/* CTA buttons */}
            <div className="space-y-2 pt-1">
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                >
                  {WA_ICON}
                  {service.type === 'product' ? 'Order on WhatsApp' : 'Book on WhatsApp'}
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
