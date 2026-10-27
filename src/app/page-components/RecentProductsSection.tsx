import { ArrowRight, Package, Store, Wrench } from 'lucide-react'

import SafeAppLink from '@/components/SafeAppLink'
import SectionHeader from '@/components/ui/SectionHeader'
import { catalogPriceLine } from '@/lib/catalog/catalog'
import type { HomeProduct } from '@/lib/data/home'

interface RecentProductsSectionProps {
  products: HomeProduct[]
}

export default function RecentProductsSection({ products }: RecentProductsSectionProps) {
  if (products.length === 0) return null

  return (
    <section className="od-mobile-section py-10 md:py-16">
      <div className="mx-auto max-w-[1160px] px-4 md:px-6">
        <SectionHeader
          label="Fresh in the shops"
          title="Just Updated"
          sub="The latest products and services from local businesses"
        />

        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
          {products.map((product) => {
            const imageUrl = product.image_thumb_url || product.image_url
            const isService = product.type === 'service'

            return (
              <SafeAppLink
                key={product.id}
                // The item page works on the main domain too and points
                // search engines at its home under the business.
                href={`/p/${product.id}`}
                className="group flex w-[62vw] max-w-[240px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-[var(--od-border)] bg-white shadow-[0_10px_30px_rgba(46,18,5,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(192,88,46,0.35)] hover:shadow-[0_18px_44px_rgba(46,18,5,0.10)] active:scale-[0.99] sm:w-auto sm:max-w-none"
              >
                <div className="relative aspect-square overflow-hidden bg-[var(--od-surface-soft)]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--od-brand)]/30">
                      {isService ? <Wrench size={36} aria-hidden /> : <Package size={36} aria-hidden />}
                    </div>
                  )}
                  <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--od-ink)]">
                    {isService ? <Wrench size={10} aria-hidden /> : <Package size={10} aria-hidden />}
                    {isService ? 'Service' : 'Product'}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-3.5">
                  <h3 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[var(--od-ink)] transition-colors group-hover:text-[var(--od-brand-strong)]">
                    {product.name}
                  </h3>
                  <p className="mt-1 inline-flex min-w-0 items-center gap-1 text-xs text-[var(--od-muted)]">
                    <Store size={11} className="shrink-0" aria-hidden />
                    <span className="truncate">{product.listing_name}</span>
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className="text-base font-extrabold text-[var(--od-ink)]">{catalogPriceLine(product)}</span>
                    <ArrowRight size={13} className="shrink-0 text-[var(--od-brand)]" aria-hidden />
                  </div>
                </div>
              </SafeAppLink>
            )
          })}
        </div>
      </div>
    </section>
  )
}
