import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, Package } from 'lucide-react'

import { LISTING_NOT_LIVE_MESSAGE } from '@/lib/selling/shop-mode'
import { createClient } from '@/lib/supabase/server'

type Listing = {
  id: string
  name: string
  category: string | null
  approved: boolean | null
}

export default async function MyBusinessProductsIndex() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listingsData } = await supabase
    .from('listings')
    .select('id, name, category, approved')
    .eq('owner_id', user.id)
    .order('name', { ascending: true })
  const listings = (listingsData ?? []) as Listing[]

  const productCounts = new Map<string, number>()
  if (listings.length > 0) {
    const { data: countsData } = await supabase
      .from('listing_products')
      .select('listing_id')
      .in('listing_id', listings.map((listing) => listing.id))
    for (const row of (countsData ?? []) as { listing_id: string }[]) {
      productCounts.set(row.listing_id, (productCounts.get(row.listing_id) ?? 0) + 1)
    }
  }

  return (
    <div className="od-page min-h-screen py-8 md:py-10">
      <div className="od-shell max-w-2xl space-y-5">
        <Link
          href="/my-business"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
        >
          <ArrowLeft size={14} aria-hidden />
          My Business
        </Link>

        <header>
          <p className="od-eyebrow">Sell online</p>
          <h1 className="od-section-title mt-1 flex items-center gap-2 text-3xl md:text-4xl">
            <Package size={28} className="text-[var(--od-brand)]" aria-hidden />
            Products &amp; Services
          </h1>
          <p className="od-muted mt-2 text-sm leading-relaxed">
            Add items customers can buy from your business page. You can add them before you connect Razorpay.
          </p>
        </header>

        {listings.length === 0 ? (
          <section className="od-card p-6 text-center">
            <p className="text-base font-bold text-[var(--od-ink)]">Add your business first</p>
            <Link href="/listings/submit" className="od-button-primary mt-4 px-4 py-2.5 text-sm">
              Add your business
            </Link>
          </section>
        ) : (
          <ul className="space-y-3">
            {listings.map((listing) => {
              const count = productCounts.get(listing.id) ?? 0
              if (!listing.approved) {
                return (
                  <li key={listing.id} className="od-card p-4">
                    <p className="truncate font-bold text-[var(--od-ink)]">{listing.name}</p>
                    <p className="od-muted mt-0.5 text-xs">{LISTING_NOT_LIVE_MESSAGE}</p>
                  </li>
                )
              }
              return (
                <li key={listing.id}>
                  <Link
                    href={`/my-business/products/${listing.id}`}
                    className="od-card od-card-hover flex items-center justify-between gap-3 p-4"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-[var(--od-ink)]">{listing.name}</span>
                      <span className="od-muted block text-xs">
                        {listing.category ?? 'Business'} · {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-[var(--od-muted)]" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
