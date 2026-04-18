import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, CreditCard, Package, Store } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'

type Listing = {
  id: string
  name: string
  category: string | null
  payments_enabled: boolean | null
}

type ProductCountRow = {
  listing_id: string
  count: number
}

export default async function MyBusinessProductsIndex() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listingsData } = await supabase
    .from('listings')
    .select('id, name, category, payments_enabled')
    .eq('owner_id', user.id)
    .order('name', { ascending: true })

  const listings = (listingsData ?? []) as Listing[]
  const enabledListings = listings.filter((l) => l.payments_enabled)

  // Count products per listing in one round-trip
  const productCounts = new Map<string, number>()
  if (enabledListings.length > 0) {
    const { data: countsData } = await supabase
      .from('listing_products')
      .select('listing_id')
      .in('listing_id', enabledListings.map((l) => l.id))

    for (const row of (countsData ?? []) as ProductCountRow[]) {
      productCounts.set(row.listing_id, (productCounts.get(row.listing_id) ?? 0) + 1)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <Link
          href="/my-business"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-warli-terra transition-colors"
        >
          <ArrowLeft size={14} />
          Back to My Business
        </Link>
      </div>

      <header className="rounded-[30px] border border-[#ecd8c5] bg-gradient-to-br from-[#fff7ef] via-white to-[#f4ede4] px-6 py-7 shadow-sm sm:px-8">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warli-terra/10 text-warli-terra">
            <Package size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-[#2d160b]">Products &amp; Services</h1>
            <p className="mt-2 text-sm leading-6 text-[#6f584a]">
              Add items customers can buy directly from your business page. Stock, pricing,
              images, and the Buy button all live here.
            </p>
          </div>
        </div>
      </header>

      {listings.length === 0 ? (
        <section className="rounded-[28px] border border-[#eee2d7] bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-lg font-semibold text-[#2d160b]">You don&apos;t have any listings yet.</p>
          <p className="mt-2 text-sm text-[#7c6253]">
            Submit a listing first, then an admin can enable payments for it.
          </p>
          <Link
            href="/listings/submit"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-warli-terra px-4 py-2.5 text-sm font-semibold text-warli-cream transition-colors hover:bg-warli-deep"
          >
            Add a listing
          </Link>
        </section>
      ) : enabledListings.length === 0 ? (
        <section className="rounded-[28px] border border-[#eee2d7] bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-lg font-semibold text-[#2d160b]">No listings are ready to sell yet.</p>
          <p className="mt-2 text-sm text-[#7c6253]">
            Ask an admin to enable payments on one of your listings, then come back here to add products.
          </p>
          <Link
            href="/my-business/payments"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#dfcdbd] bg-white px-4 py-2.5 text-sm font-semibold text-[#2d160b] transition-colors hover:border-warli-terra hover:text-warli-terra"
          >
            <CreditCard size={14} />
            Set up payments
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {enabledListings.map((listing) => {
            const productCount = productCounts.get(listing.id) ?? 0
            return (
              <Link
                key={listing.id}
                href={`/my-business/products/${listing.id}`}
                className="group block rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm transition-all hover:border-warli-sand hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3e7] text-warli-terra">
                      <Store size={20} />
                    </span>
                    <div>
                      <p className="text-base font-bold text-[#2d160b]">{listing.name}</p>
                      <p className="mt-0.5 text-xs text-[#8b7264]">
                        {listing.category ?? 'Uncategorized'}
                        <span className="mx-2 text-[#d6c2b0]">·</span>
                        <span className="font-semibold text-[#6f584a]">
                          {productCount} {productCount === 1 ? 'item' : 'items'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={18}
                    className="flex-shrink-0 text-gray-300 transition-colors group-hover:text-warli-terra"
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
