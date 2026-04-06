'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { ShoppingCart } from 'lucide-react'

const OrderModal = dynamic(() => import('@/components/OrderModal'))

interface Service {
  name: string
  price?: string
  desc?: string
  image?: string
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

/** Parse a price string like "₹200", "Rs. 1500", "200" → number, or null */
function parsePriceNum(price?: string): number | null {
  if (!price) return null
  const match = price.replace(/,/g, '').match(/[\d]+(\.\d+)?/)
  if (!match) return null
  const n = parseFloat(match[0])
  return isNaN(n) || n <= 0 ? null : n
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

  const canOrder = false // Payments disabled — Razorpay X pending activation

  return (
    <>
      <div className="space-y-3">
      {services.map((svc, i) => {
          const priceNum = parsePriceNum(svc.price)
          const canOrderThis = canOrder && priceNum !== null

          const waMsg = encodeURIComponent(
            `Hi! I'm interested in your ${svc.type === 'product' ? 'product' : 'service'} — *${svc.name}*${svc.price ? ` (${svc.price})` : ''}.\n\nCan you please share more details?\n\n${businessUrl}`
          )
          const waLink = whatsappNum
            ? `https://wa.me/${whatsappNum.replace(/\D/g, '')}?text=${waMsg}`
            : null

          return (
            <div key={i} className="rounded-xl border border-warli-sand/50 overflow-hidden bg-warli-light/40">
              {svc.image && (
                <div className="relative w-full h-40 bg-gray-100">
                  <Image src={svc.image} alt={svc.name} fill className="object-cover" />
                </div>
              )}
              <div className="p-3.5 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{svc.name}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      svc.type === 'product'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-warli-light text-warli-terra border border-warli-sand'
                    }`}>
                      {svc.type === 'product' ? '📦 Product' : '🛠 Service'}
                    </span>
                  </div>
                  {svc.desc && <p className="text-xs text-gray-500 mt-0.5">{svc.desc}</p>}

                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {/* Order Now (Razorpay) */}
                    {canOrderThis && (
                      <button
                        onClick={() => setActiveService({ index: i, service: svc })}
                        className="inline-flex items-center gap-1.5 bg-warli-terra hover:bg-warli-deep text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <ShoppingCart size={12} />
                        {svc.type === 'product' ? 'Order Now' : 'Book Now'}
                      </button>
                    )}

                    {/* WhatsApp enquiry */}
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        {canOrderThis ? 'Enquire' : (svc.type === 'product' ? 'Order Now' : 'Book Now')}
                      </a>
                    )}
                  </div>
                </div>
                {svc.price && (
                  <span className="flex-shrink-0 text-sm font-bold text-warli-terra bg-white border border-warli-sand px-2.5 py-1 rounded-lg">
                    {svc.price}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Order Modal */}
      {activeService && (
        <OrderModal
          listing={{
            id:       listing.id,
            name:     listing.name,
            upi_id:   listing.upi_id!,
            whatsapp: listing.whatsapp,
          }}
          service={{
            name:  activeService.service.name,
            price: parsePriceNum(activeService.service.price)!,
            type:  activeService.service.type,
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
