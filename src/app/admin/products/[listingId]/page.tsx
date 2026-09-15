import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Package,
} from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
import SellingStatusBadge from '@/app/admin/payments/SellingStatusBadge'
import { deriveSellingStatus, deriveShopMode } from '@/lib/selling/shop-mode'
import { OWNER_CATALOG_ITEM_SELECT, toCatalogItem, type OwnerCatalogRow } from '@/lib/catalog/catalog'
import { ProductsManager } from '@/app/my-business/products/[listingId]/ProductsManager'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

type AdminListing = {
  id: string
  name: string
  category: string | null
  subdomain: string | null
  payments_enabled: boolean | null
  payments_suspended_at: string | null
  approved: boolean | null
  owner_id: string | null
  whatsapp: string | null
  phone: string | null
}

type OwnerProfile = {
  id: string
  full_name: string | null
  email: string | null
}

type PaymentConfigRow = {
  verified_at: string | null
  razorpay_key_id: string
  razorpay_key_last4: string | null
}

export default async function AdminListingProductsPage({
  params,
}: {
  params: Promise<{ listingId: string }>
}) {
  const { listingId } = await params

  const supabase = await createClient()
  await requireAdmin(supabase)

  const adminClient = createAdminClient()
  if (!adminClient) {
    throw new Error('Admin client not configured.')
  }

  const [{ data: listingData }, { data: productsData }, { data: configData }] =
    await Promise.all([
      adminClient
        .from('listings')
        .select(
          'id, name, category, subdomain, payments_enabled, payments_suspended_at, approved, owner_id, whatsapp, phone',
        )
        .eq('id', listingId)
        .maybeSingle(),
      // Use admin client so we see ALL products (active + inactive),
      // bypassing the RLS policy that hides inactive items from non-owners.
      adminClient
        .from('listing_products')
        .select(OWNER_CATALOG_ITEM_SELECT)
        .eq('listing_id', listingId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      adminClient
        .from('listing_payment_configs')
        .select('verified_at, razorpay_key_id, razorpay_key_last4')
        .eq('listing_id', listingId)
        .maybeSingle(),
    ])

  const listing = (listingData ?? null) as AdminListing | null
  if (!listing) notFound()

  const items = ((productsData ?? []) as unknown as OwnerCatalogRow[]).map((row) => toCatalogItem(row))
  const config = (configData ?? null) as PaymentConfigRow | null

  let owner: OwnerProfile | null = null
  if (listing.owner_id) {
    const { data: ownerData } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', listing.owner_id)
      .maybeSingle()
    owner = (ownerData ?? null) as OwnerProfile | null
  }

  const sellingStatus = deriveSellingStatus({
    approved: listing.approved === true,
    paymentsEnabled: listing.payments_enabled === true,
    suspendedAt: listing.payments_suspended_at,
    verifiedAt: config?.verified_at ?? null,
    keyId: config?.razorpay_key_id ?? null,
  })

  const shopMode = deriveShopMode({
    approved: listing.approved === true,
    paymentsEnabled: listing.payments_enabled === true,
    suspendedAt: listing.payments_suspended_at,
    verifiedAt: config?.verified_at ?? null,
    keyId: config?.razorpay_key_id ?? null,
  })

  // Public site URL: prefer the subdomain rewrite if the listing has one.
  const publicHref = listing.subdomain
    ? `https://${listing.subdomain}.ourdahanu.in`
    : `/listings/${listing.id}`

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand transition-colors"
        >
          <ArrowLeft size={14} />
          All listings
        </Link>
      </div>

      <header className="rounded-[30px] border border-[#ecd8c5] bg-gradient-to-br from-[#fff7ef] via-white to-[#f4ede4] px-6 py-7 shadow-sm sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Package size={24} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">
                {listing.category ?? 'Listing'}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[#2d160b]">{listing.name}</h1>
              <p className="mt-1 text-sm text-[#7c6253]">
                {owner?.full_name || owner?.email
                  ? `Owner: ${owner.full_name ?? owner.email}`
                  : 'No owner on file'}
              </p>
            </div>
          </div>

          <Link
            href={publicHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl border border-[#dfcdbd] bg-white px-3 py-2 text-sm font-semibold text-[#6f584a] transition-colors hover:border-brand hover:text-brand"
          >
            <ExternalLink size={14} />
            View public page
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <SellingStatusBadge status={sellingStatus} />
          {config?.razorpay_key_last4 && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-600">
              Key …{config.razorpay_key_last4}
            </span>
          )}

          {!listing.approved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">
              <AlertTriangle size={11} />
              Listing not approved
            </span>
          )}
        </div>

        {sellingStatus !== 'live' && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Customers can&apos;t buy these items yet.</p>
            <p className="mt-1 leading-5">
              Customers see these items with WhatsApp buttons. Buy buttons appear once the owner
              connects live Razorpay keys; with test keys only the owner sees them. You can still add
              or edit items here.{' '}
              <Link href="/admin/payments" className="font-semibold underline underline-offset-2">
                Open payments
              </Link>
              .
            </p>
          </div>
        )}
      </header>

      <ProductsManager
        listingId={listingId}
        shopMode={shopMode}
        whatsappNumber={listing.whatsapp || listing.phone || null}
        initialItems={items}
      />
    </div>
  )
}
