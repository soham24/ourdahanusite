import Link from 'next/link'
import { ArrowRight, Bell, ShoppingBag, Store } from 'lucide-react'
import { siteConfig } from '@/lib/site'

export default function ShopPage() {
  return (
    <div className="od-page min-h-[80vh] px-4 py-10 md:py-16">
      <div className="od-shell grid items-center gap-8 md:grid-cols-[1fr_420px]">
        <div>
          <p className="od-eyebrow mb-3">Local commerce</p>
          <h1 className="od-section-title max-w-2xl text-4xl md:text-6xl">
            Shop from {siteConfig.town} businesses, directly.
          </h1>
          <p className="od-muted mt-4 max-w-xl text-base leading-7">
            Product buying is being rolled into business profiles first, so customers can buy from the actual seller and owners can manage orders in one place.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/listings" className="od-button-primary px-5 py-3">
              <Store size={17} /> Browse Businesses
            </Link>
            <Link href="/listings/submit" className="od-button-secondary px-5 py-3">
              Add Products <ArrowRight size={17} />
            </Link>
          </div>
        </div>

        <div className="od-card p-5">
          <div className="flex items-center gap-3 border-b border-[var(--od-border)] pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(192,88,46,0.1)] text-[var(--od-brand)]">
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="font-extrabold text-[var(--od-ink)]">Marketplace preview</p>
              <p className="od-muted text-sm">Products live inside verified business pages.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {['Fresh chikoo boxes', 'Warli art pieces', 'Home bakers', 'Local services'].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-2xl bg-[#F4EDE3]/70 px-4 py-3">
                <span className="font-semibold text-[var(--od-ink-2)]">{item}</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--od-brand)]">Soon</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Bell size={16} className="mt-0.5 flex-shrink-0" />
            <span>Until the shop index is ready, the best shopping entry point is each business profile.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
