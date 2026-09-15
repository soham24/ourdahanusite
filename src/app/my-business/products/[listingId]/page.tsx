import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'

import { listOwnerProducts } from '@/app/actions/products'
import { LISTING_NOT_LIVE_MESSAGE } from '@/lib/selling/shop-mode'
import { createClient } from '@/lib/supabase/server'

import { ProductsManager } from './ProductsManager'

export default async function ListingProductsPage({
  params,
}: {
  params: Promise<{ listingId: string }>
}) {
  const { listingId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, category, approved, owner_id')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) notFound()

  if (listing.owner_id !== user.id) {
    redirect('/my-business/products')
  }

  if (!listing.approved) {
    return (
      <div className="od-page min-h-screen py-8 md:py-10">
        <div className="od-shell max-w-2xl">
          <section className="od-card p-6 text-center">
            <p className="text-base font-bold text-[var(--od-ink)]">{LISTING_NOT_LIVE_MESSAGE}</p>
            <Link href="/my-business" className="od-button-secondary mt-4 px-4 py-2.5 text-sm">
              Back to My Business
            </Link>
          </section>
        </div>
      </div>
    )
  }

  const products = await listOwnerProducts(listingId)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <Link
          href="/my-business/products"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand transition-colors"
        >
          <ArrowLeft size={14} />
          All listings
        </Link>
      </div>

      <header className="rounded-[30px] border border-[#ecd8c5] bg-gradient-to-br from-[#fff7ef] via-white to-[#f4ede4] px-6 py-7 shadow-sm sm:px-8">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Package size={24} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">
              {listing.category ?? 'Listing'}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#2d160b]">{listing.name}</h1>
            <p className="mt-2 text-sm leading-6 text-[#6f584a]">
              Manage products and services customers can buy on this listing. Prices are in rupees.
              Leave stock blank for unlimited items (typical for services).
            </p>
          </div>
        </div>
      </header>

      <ProductsManager listingId={listingId} initialProducts={products} />
    </div>
  )
}
