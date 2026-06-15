import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Bike, Clock, MapPin } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/ui/EmptyState'

export const metadata: Metadata = {
  title: 'Food & Grocery Delivery in Dahanu',
  description: 'Order food and groceries from local Dahanu businesses for doorstep delivery.',
  alternates: { canonical: 'https://ourdahanu.in/delivery' },
}

interface DeliveryListing {
  id: string
  name: string
  category: string | null
  image_url: string | null
  image_thumb_url: string | null
  prep_time_min: number
}

export default async function DeliveryBrowsePage() {
  const supabase = await createClient()

  const { data: configs } = await supabase
    .from('listing_delivery_config')
    .select('listing_id, prep_time_min')
    .eq('delivery_enabled', true)

  const ids = (configs ?? []).map((c) => c.listing_id)
  const prepById = new Map((configs ?? []).map((c) => [c.listing_id, c.prep_time_min]))

  let listings: DeliveryListing[] = []
  if (ids.length > 0) {
    const { data } = await supabase
      .from('listings')
      .select('id, name, category, image_url, image_thumb_url')
      .in('id', ids)
      .eq('approved', true)
      .order('name')
    listings = (data ?? []).map((l) => ({ ...l, prep_time_min: prepById.get(l.id) ?? 20 }))
  }

  return (
    <div className="od-page min-h-screen">
      <section className="bg-[var(--color-surface-dark)] text-white">
        <div className="mx-auto max-w-[1160px] px-5 py-12 md:px-6 md:py-16">
          <p className="od-eyebrow text-[#F0C87A]">Quick commerce</p>
          <h1 className="mt-2 font-display text-[40px] leading-tight md:text-[56px]">
            Food &amp; grocery, <em className="italic text-[#F0C87A]">delivered.</em>
          </h1>
          <p className="mt-3 max-w-xl text-[#F8E9D5]/80">
            Order from local Dahanu shops and get it at your door. Cash on delivery or pay online.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1160px] px-5 py-10 md:px-6">
        {listings.length === 0 ? (
          <EmptyState
            icon={<Bike size={26} />}
            title="No delivery shops yet"
            description="Local businesses are coming online for delivery soon. Check back shortly."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const img = l.image_url || l.image_thumb_url
              return (
                <Link
                  key={l.id}
                  href={`/delivery/${l.id}`}
                  className="group overflow-hidden rounded-2xl border border-[var(--od-border)] bg-white shadow-[0_8px_24px_rgba(46,18,5,0.05)] transition-all hover:-translate-y-1 hover:border-[rgba(192,88,46,0.35)] hover:shadow-[0_16px_40px_rgba(46,18,5,0.10)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-[var(--od-surface-soft)]">
                    {img ? (
                      <Image src={img} alt={l.name} fill sizes="(min-width:1024px) 360px, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center font-display text-4xl text-[var(--od-brand)]/25">OD</div>
                    )}
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-[var(--od-ink)]">
                      <Bike size={12} className="text-[var(--od-brand)]" /> Delivery
                    </span>
                  </div>
                  <div className="p-4">
                    {l.category && <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--od-brand)]">{l.category}</p>}
                    <h2 className="mt-1 font-display text-xl leading-tight text-[var(--od-ink)] group-hover:text-[var(--od-brand-strong)]">{l.name}</h2>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--od-muted)]">
                      <Clock size={12} /> ~{l.prep_time_min} min prep
                      <span className="mx-1">·</span>
                      <MapPin size={12} /> Dahanu
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
