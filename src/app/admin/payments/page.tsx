import Link from 'next/link'
import { Package } from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
import { deriveSellingStatus, type SellingStatus } from '@/lib/selling/shop-mode'
import { loadSuspensionReasons } from '@/lib/selling/suspension-reasons'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

import SellingControls from './SellingControls'
import SellingStatusBadge from './SellingStatusBadge'
import { siteConfig } from '@/lib/site'

type AdminListingRow = {
  id: string
  name: string
  category: string | null
  subdomain: string | null
  approved: boolean | null
  payments_enabled: boolean | null
  payments_suspended_at: string | null
}

type PaymentConfigRow = {
  listing_id: string
  razorpay_key_id: string
  razorpay_key_last4: string
  verified_at: string | null
  updated_at: string
}

type Filter = 'all' | SellingStatus

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'test', label: 'Test' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'not_connected', label: 'Not connected' },
]

const STATUS_ORDER: Record<SellingStatus, number> = { live: 0, test: 1, suspended: 2, not_connected: 3 }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function detailFor(
  listing: AdminListingRow,
  config: PaymentConfigRow | null,
  status: SellingStatus,
  reason: string | null,
): string {
  if (status === 'suspended') return `Paused: ${reason ?? 'no reason given'}`
  if (!listing.approved) return 'Listing not approved'
  if (config && !config.verified_at) return 'Razorpay rejected the saved keys'
  if (config) return `Key …${config.razorpay_key_last4} · connected ${formatDate(config.updated_at)}`
  return 'Owner has not connected Razorpay'
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const { status: requested } = await searchParams
  const filter: Filter = FILTERS.find((option) => option.value === requested)?.value ?? 'all'

  const adminClient = createAdminClient()
  if (!adminClient) {
    throw new Error('Admin client not configured.')
  }

  const [{ data: listingsData }, { data: configsData }] = await Promise.all([
    adminClient
      .from('listings')
      .select('id, name, category, subdomain, approved, payments_enabled, payments_suspended_at')
      .order('name', { ascending: true }),
    adminClient
      .from('listing_payment_configs')
      .select('listing_id, razorpay_key_id, razorpay_key_last4, verified_at, updated_at'),
  ])

  const listings = (listingsData ?? []) as AdminListingRow[]
  const configs = (configsData ?? []) as PaymentConfigRow[]
  const configByListing = new Map(configs.map((config) => [config.listing_id, config]))
  const reasons = await loadSuspensionReasons(
    listings.filter((listing) => listing.payments_suspended_at).map((listing) => listing.id),
  )

  const rows = listings
    .map((listing) => {
      const config = configByListing.get(listing.id) ?? null
      const status = deriveSellingStatus({
        approved: listing.approved === true,
        paymentsEnabled: listing.payments_enabled === true,
        suspendedAt: listing.payments_suspended_at,
        verifiedAt: config?.verified_at ?? null,
        keyId: config?.razorpay_key_id ?? null,
      })
      return { listing, config, status }
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.listing.name.localeCompare(b.listing.name),
    )

  const counts: Record<SellingStatus, number> = { live: 0, test: 0, suspended: 0, not_connected: 0 }
  for (const row of rows) counts[row.status] += 1
  const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter)

  const stats: Array<{ status: SellingStatus; hint: string }> = [
    { status: 'live', hint: 'Customers can pay' },
    { status: 'test', hint: 'Only the owner sees the shop' },
    { status: 'suspended', hint: 'Paused by an admin' },
    { status: 'not_connected', hint: 'No working Razorpay keys' },
  ]

  return (
    <div className="space-y-6">
      <header>
        <p className="od-eyebrow">Sell online</p>
        <h1 className="od-section-title mt-1 text-3xl">Payments</h1>
        <p className="od-muted mt-2 max-w-2xl text-sm leading-relaxed">
          Businesses connect their own Razorpay account. Suspend one to stop new payments; paid orders
          in progress are still saved.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.status} className="od-card p-4">
            <SellingStatusBadge status={stat.status} />
            <p className="mt-2 text-3xl font-bold tabular-nums text-[var(--od-ink)]">{counts[stat.status]}</p>
            <p className="od-muted text-xs">{stat.hint}</p>
          </div>
        ))}
      </section>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={option.value === 'all' ? '/admin/payments' : `/admin/payments?status=${option.value}`}
            aria-current={filter === option.value ? 'page' : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              filter === option.value
                ? 'border-[var(--od-brand-strong)] bg-[var(--od-brand-strong)] text-white'
                : 'border-[var(--od-border)] bg-white text-[var(--od-ink-2)] hover:text-[var(--od-brand-strong)]'
            }`}
          >
            {option.label}
            {option.value !== 'all' && <span className="ml-1 tabular-nums">({counts[option.value]})</span>}
          </Link>
        ))}
      </nav>

      <section className="space-y-3">
        {visible.length === 0 ? (
          <p className="od-card p-6 text-center text-sm text-[var(--od-muted)]">No businesses in this view.</p>
        ) : (
          visible.map(({ listing, config, status }) => (
            <div
              key={listing.id}
              className="od-card flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-[var(--od-ink)]">{listing.name}</p>
                  <SellingStatusBadge status={status} />
                </div>
                <p className="od-muted mt-0.5 text-xs">
                  {listing.category ?? 'Uncategorized'}
                  {listing.subdomain ? ` · ${listing.subdomain}.${siteConfig.domain}` : ''}
                </p>
                <p className="mt-1.5 text-sm text-[var(--od-ink-2)]">{detailFor(listing, config, status, reasons.get(listing.id) ?? null)}</p>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-start gap-2">
                <SellingControls listingId={listing.id} suspended={status === 'suspended'} />
                <Link href={`/admin/products/${listing.id}`} className="od-button-secondary px-3 py-2 text-sm">
                  <Package size={14} aria-hidden />
                  Products
                </Link>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
