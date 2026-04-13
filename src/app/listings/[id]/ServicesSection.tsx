'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react'
import {
  DEFAULT_SERVICE_IMAGE_ASPECT,
  getServiceImageAspectOption,
  type ServiceImageAspect,
} from '@/lib/service-image'

const OrderModal = dynamic(() => import('@/components/OrderModal'))

interface Service {
  name: string
  price?: string
  desc?: string
  image?: string
  imageAspect?: ServiceImageAspect
  type?: 'service' | 'product'
}

interface Props {
  services: Service[]
  listing: {
    id: string
    name: string
    upi_id?: string | null
    whatsapp?: string | null
  }
  whatsappNum: string | null
  businessUrl: string
  userName?: string
  userEmail?: string
}

const ITEMS_PER_PAGE = 10

function parsePriceNum(price?: string): number | null {
  if (!price) return null
  const match = price.replace(/,/g, '').match(/[\d]+(\.\d+)?/)
  if (!match) return null
  const value = Number.parseFloat(match[0])
  return Number.isNaN(value) || value <= 0 ? null : value
}

export default function ServicesSection({
  services,
  listing,
  whatsappNum,
  businessUrl,
  userName = '',
  userEmail = '',
}: Props) {
  const [activeService, setActiveService] = useState<{ index: number; service: Service } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const canOrder = false
  const totalPages = Math.max(1, Math.ceil(services.length / ITEMS_PER_PAGE))

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const visibleServices = services.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  const visibleEnd = Math.min(startIndex + visibleServices.length, services.length)

  return (
    <>
      <div className="space-y-3">
        {visibleServices.map((service, index) => {
          const serviceIndex = startIndex + index
          const priceNum = parsePriceNum(service.price)
          const canOrderThis = canOrder && priceNum !== null
          const imageAspect = getServiceImageAspectOption(service.imageAspect, DEFAULT_SERVICE_IMAGE_ASPECT)

          const waMsg = encodeURIComponent(
            `Hi! I'm interested in your ${service.type === 'product' ? 'product' : 'service'} — *${service.name}*${service.price ? ` (${service.price})` : ''}.\n\nCan you please share more details?\n\n${businessUrl}`,
          )
          const waLink = whatsappNum
            ? `https://wa.me/${whatsappNum.replace(/\D/g, '')}?text=${waMsg}`
            : null

          return (
            <div key={serviceIndex} className="overflow-hidden rounded-xl border border-warli-sand/50 bg-warli-light/40">
              {service.image && (
                <div className={`bg-gray-100 ${imageAspect.value === 'portrait' ? 'p-3' : ''}`}>
                  <div
                    className={`relative overflow-hidden ${imageAspect.value === 'portrait' ? 'mx-auto max-w-72 rounded-lg' : 'w-full'}`}
                    style={{ aspectRatio: imageAspect.cssAspectRatio }}
                  >
                    <Image
                      src={service.image}
                      alt={service.name}
                      fill
                      sizes={
                        imageAspect.value === 'portrait'
                          ? '(max-width: 640px) 75vw, 288px'
                          : '(max-width: 640px) 100vw, 640px'
                      }
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{service.name}</p>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        service.type === 'product'
                          ? 'bg-blue-100 text-blue-600'
                          : 'border border-warli-sand bg-warli-light text-warli-terra'
                      }`}
                    >
                      {service.type === 'product' ? '📦 Product' : '🛠 Service'}
                    </span>
                  </div>

                  {service.desc && <p className="mt-0.5 text-xs text-gray-500">{service.desc}</p>}

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {canOrderThis && (
                      <button
                        type="button"
                        onClick={() => setActiveService({ index: serviceIndex, service })}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-warli-terra px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-warli-deep"
                      >
                        <ShoppingCart size={12} />
                        {service.type === 'product' ? 'Order Now' : 'Book Now'}
                      </button>
                    )}

                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        {canOrderThis ? 'Enquire' : service.type === 'product' ? 'Order Now' : 'Book Now'}
                      </a>
                    )}
                  </div>
                </div>

                {service.price && (
                  <span className="flex-shrink-0 rounded-lg border border-warli-sand bg-white px-2.5 py-1 text-sm font-bold text-warli-terra">
                    {service.price}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warli-sand/50 bg-warli-light/30 px-3 py-2.5">
          <p className="text-xs font-medium text-gray-500">
            Showing {startIndex + 1}-{visibleEnd} of {services.length}
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-warli-sand hover:text-warli-terra disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={12} />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {Array.from({ length: totalPages }, (_, index) => {
              const page = index + 1

              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition-colors ${
                    page === currentPage
                      ? 'bg-warli-terra text-warli-cream'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-warli-sand hover:text-warli-terra'
                  }`}
                >
                  {page}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-warli-sand hover:text-warli-terra disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {activeService && (
        <OrderModal
          listing={{
            id: listing.id,
            name: listing.name,
            upi_id: listing.upi_id!,
            whatsapp: listing.whatsapp,
          }}
          service={{
            name: activeService.service.name,
            price: parsePriceNum(activeService.service.price)!,
            type: activeService.service.type,
          }}
          serviceIndex={activeService.index}
          userName={userName}
          userEmail={userEmail}
          onClose={() => setActiveService(null)}
        />
      )}
    </>
  )
}
