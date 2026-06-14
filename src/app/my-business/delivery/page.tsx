import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, Bike, Store } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'

type Listing = { id: string; name: string; category: string | null }

export default async function MyBusinessDeliveryIndex() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listingsData } = await supabase
    .from('listings')
    .select('id, name, category')
    .eq('owner_id', user.id)
    .order('name', { ascending: true })

  const listings = (listingsData ?? []) as Listing[]

  const enabledSet = new Set<string>()
  if (listings.length > 0) {
    const { data: configs } = await supabase
      .from('listing_delivery_config')
      .select('listing_id, delivery_enabled')
      .in('listing_id', listings.map((l) => l.id))
    for (const c of (configs ?? []) as { listing_id: string; delivery_enabled: boolean }[]) {
      if (c.delivery_enabled) enabledSet.add(c.listing_id)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <Link
        href="/my-business"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] hover:text-brand transition-colors"
      >
        <ArrowLeft size={14} />
        Back to My Business
      </Link>

      <header className="rounded-[30px] border border-[var(--od-border)] bg-gradient-to-br from-[#fff7ef] via-white to-[#f4ede4] px-6 py-7 shadow-sm sm:px-8">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Bike size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-[var(--od-ink)]">Delivery</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--od-ink-2)]">
              Offer doorstep delivery from your shop. Pick a listing to set your delivery area
              and fees. Cash on delivery works out of the box; online payment uses your Razorpay.
            </p>
          </div>
        </div>
      </header>

      {listings.length === 0 ? (
        <section className="rounded-[28px] border border-[var(--od-border)] bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-lg font-semibold text-[var(--od-ink)]">You don&apos;t have any listings yet.</p>
          <Link
            href="/listings/submit"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            Add a listing
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => {
            const on = enabledSet.has(listing.id)
            return (
              <Link
                key={listing.id}
                href={`/my-business/delivery/${listing.id}`}
                className="group block rounded-[24px] border border-[var(--od-border)] bg-white p-5 shadow-sm transition-all hover:border-brand/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3e7] text-brand">
                      <Store size={20} />
                    </span>
                    <div>
                      <p className="text-base font-bold text-[var(--od-ink)]">{listing.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--od-muted)]">
                        {listing.category ?? 'Uncategorized'}
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      on ? 'bg-green-100 text-green-700' : 'bg-[var(--od-surface-soft)] text-[var(--od-muted)]'
                    }`}>
                      {on ? 'Delivery on' : 'Off'}
                    </span>
                    <ArrowRight size={18} className="flex-shrink-0 text-[var(--od-muted)]/50 transition-colors group-hover:text-brand" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
