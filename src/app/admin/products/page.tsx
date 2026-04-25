import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle,
  CreditCard,
  Eye,
  EyeOff,
  Package,
  Sparkles,
  Store,
} from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

type AdminListingRow = {
  id: string
  name: string
  category: string | null
  subdomain: string | null
  payments_enabled: boolean | null
  approved: boolean | null
}

type ProductRow = {
  listing_id: string
  is_active: boolean
}

type PaymentConfigRow = {
  listing_id: string
  verified_at: string | null
}

export default async function AdminProductsIndex() {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const adminClient = createAdminClient()
  if (!adminClient) {
    throw new Error('Admin client not configured.')
  }

  const [{ data: listingsData }, { data: productsData }, { data: configsData }] =
    await Promise.all([
      adminClient
        .from('listings')
        .select('id, name, category, subdomain, payments_enabled, approved')
        .order('name', { ascending: true }),
      adminClient.from('listing_products').select('listing_id, is_active'),
      adminClient.from('listing_payment_configs').select('listing_id, verified_at'),
    ])

  const listings = (listingsData ?? []) as AdminListingRow[]
  const products = (productsData ?? []) as ProductRow[]
  const configs = (configsData ?? []) as PaymentConfigRow[]

  const totalByListing = new Map<string, number>()
  const activeByListing = new Map<string, number>()
  for (const p of products) {
    totalByListing.set(p.listing_id, (totalByListing.get(p.listing_id) ?? 0) + 1)
    if (p.is_active) {
      activeByListing.set(p.listing_id, (activeByListing.get(p.listing_id) ?? 0) + 1)
    }
  }

  const verifiedByListing = new Map(
    configs
      .filter((c) => c.verified_at)
      .map((c) => [c.listing_id, c.verified_at!]),
  )

  const rows = listings
    .map((listing) => {
      const totalProducts = totalByListing.get(listing.id) ?? 0
      const activeProducts = activeByListing.get(listing.id) ?? 0
      return {
        id: listing.id,
        name: listing.name,
        category: listing.category,
        subdomain: listing.subdomain,
        paymentsEnabled: listing.payments_enabled === true,
        approved: listing.approved === true,
        keysVerified: verifiedByListing.has(listing.id),
        totalProducts,
        activeProducts,
        marketplaceReady:
          listing.payments_enabled === true &&
          verifiedByListing.has(listing.id) &&
          activeProducts > 0,
      }
    })
    .sort(
      (a, b) =>
        Number(b.paymentsEnabled) - Number(a.paymentsEnabled) ||
        b.totalProducts - a.totalProducts ||
        a.name.localeCompare(b.name),
    )

  const totalListings = rows.length
  const enabledCount = rows.filter((r) => r.paymentsEnabled).length
  const listingsWithProducts = rows.filter((r) => r.totalProducts > 0).length
  const liveCount = rows.filter((r) => r.marketplaceReady).length
  const totalProductsCount = rows.reduce((acc, r) => acc + r.totalProducts, 0)
  const totalActiveCount = rows.reduce((acc, r) => acc + r.activeProducts, 0)

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[30px] border border-[#ecd8c5] bg-gradient-to-br from-[#34160a] via-[#4b2210] to-[#8a4b26] px-6 py-7 text-warli-cream shadow-[0_24px_60px_rgba(61,26,8,0.22)] lg:px-8">
        <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute left-0 top-16 h-40 w-40 rounded-full bg-[#d28b5f]/30 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#f6dfca]">
              <Sparkles size={13} />
              Catalog Management
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Products &amp; Services</h1>
            <p className="mt-3 text-sm leading-6 text-[#f2d6c0] sm:text-[15px]">
              Manage what listings sell on their business pages. You can add, edit, hide, or
              delete items on behalf of any owner — useful for onboarding new businesses or
              correcting catalogue mistakes.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8c8af]">Items Live</p>
              <p className="mt-1 text-2xl font-bold">{totalActiveCount}</p>
              <p className="mt-1 text-sm text-[#f2d6c0]">visible on business pages</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8c8af]">Selling</p>
              <p className="mt-1 text-2xl font-bold">{liveCount}</p>
              <p className="mt-1 text-sm text-[#f2d6c0]">listings with a live Shop</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3e7] text-warli-terra">
              <Store size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Listings</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{totalListings}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Total businesses on the platform.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef8f0] text-green-700">
              <CreditCard size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Payments On</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{enabledCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Listings that can accept direct payments.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-blue-700">
              <Package size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">With Items</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{listingsWithProducts}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Listings that have at least one product.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff6e8] text-amber-700">
              <Package size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Total Items</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{totalProductsCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Products &amp; services across all listings.</p>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#eee2d7] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Package size={18} className="text-warli-terra" />
          <h2 className="text-lg font-bold text-[#2d160b]">All Listings</h2>
        </div>
        <p className="mt-2 text-sm text-[#7c6253]">
          Sorted by payments-enabled first, then by item count. Click Manage to add, edit,
          hide, or delete products on behalf of the owner. Admin mutations still send
          read-your-own-writes cache updates, so changes appear on the public page immediately.
        </p>

        <div className="mt-5 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#ead8c8] bg-[#fcf7f2] px-4 py-8 text-center text-sm text-[#8c7364]">
              No listings yet.
            </div>
          ) : (
            rows.map((row) => (
              <Link
                key={row.id}
                href={`/admin/products/${row.id}`}
                className="group block rounded-[24px] border border-[#efe2d6] bg-[#fffdfb] p-5 transition-all hover:border-warli-sand hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-bold text-[#2d160b]">{row.name}</p>

                      {row.paymentsEnabled ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                          Payments On
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                          Payments Off
                        </span>
                      )}

                      {row.keysVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                          <CheckCircle size={10} />
                          Keys Verified
                        </span>
                      )}

                      {row.marketplaceReady ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Eye size={10} />
                          Shop Live
                        </span>
                      ) : row.totalProducts > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                          <EyeOff size={10} />
                          Not Live
                        </span>
                      ) : null}

                      {!row.approved && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                          Not Approved
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-[#8b7264]">
                      {row.category ?? 'Uncategorized'}
                      {row.subdomain && (
                        <>
                          <span className="mx-2 text-[#d6c2b0]">·</span>
                          <span className="text-[#6f584a]">{row.subdomain}.ourdahanu.in</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#2d160b]">
                        {row.activeProducts}
                        <span className="text-sm font-medium text-[#8b7264]">
                          {' '}/ {row.totalProducts}
                        </span>
                      </p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[#8b7264]">
                        active / total
                      </p>
                    </div>
                    <ArrowRight
                      size={18}
                      className="flex-shrink-0 text-gray-300 transition-colors group-hover:text-warli-terra"
                    />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
