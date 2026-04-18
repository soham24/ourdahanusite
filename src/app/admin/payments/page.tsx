import {
  CheckCircle,
  CreditCard,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
import { updateListingPaymentsFromForm } from '@/app/actions/listing-payments'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

type AdminListingRow = {
  id: string
  name: string
  category: string | null
  payments_enabled: boolean | null
}

type PaymentConfigRow = {
  listing_id: string
  razorpay_key_id: string
  razorpay_key_last4: string
  test_mode: boolean
  verified_at: string | null
  updated_at: string
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function AdminPaymentsPage() {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const adminClient = createAdminClient()
  if (!adminClient) {
    throw new Error('Admin client not configured.')
  }

  const [{ data: listingsData }, { data: configsData }] = await Promise.all([
    adminClient
      .from('listings')
      .select('id, name, category, payments_enabled')
      .order('name', { ascending: true }),
    adminClient
      .from('listing_payment_configs')
      .select('listing_id, razorpay_key_id, razorpay_key_last4, test_mode, verified_at, updated_at'),
  ])

  const listings = (listingsData ?? []) as AdminListingRow[]
  const configs = (configsData ?? []) as PaymentConfigRow[]
  const configByListing = new Map(configs.map((c) => [c.listing_id, c]))

  const rows = listings
    .map((listing) => {
      const config = configByListing.get(listing.id) ?? null
      return {
        ...listing,
        isEnabled: listing.payments_enabled === true,
        hasConfig: !!config,
        isVerified: !!config?.verified_at,
        testMode: config?.test_mode ?? null,
        keyLast4: config?.razorpay_key_last4 ?? null,
        verifiedAt: config?.verified_at ?? null,
      }
    })
    .sort(
      (a, b) =>
        Number(b.isEnabled) - Number(a.isEnabled) ||
        Number(b.isVerified) - Number(a.isVerified) ||
        a.name.localeCompare(b.name),
    )

  const totalListings = rows.length
  const enabledCount = rows.filter((r) => r.isEnabled).length
  const configuredCount = rows.filter((r) => r.hasConfig).length
  const liveCount = rows.filter((r) => r.isEnabled && r.isVerified).length
  const testModeCount = rows.filter((r) => r.testMode === true).length
  const enableRate = totalListings > 0 ? Math.round((enabledCount / totalListings) * 100) : 0

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[30px] border border-[#ecd8c5] bg-gradient-to-br from-[#34160a] via-[#4b2210] to-[#8a4b26] px-6 py-7 text-warli-cream shadow-[0_24px_60px_rgba(61,26,8,0.22)] lg:px-8">
        <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute left-0 top-16 h-40 w-40 rounded-full bg-[#d28b5f]/30 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#f6dfca]">
              <Sparkles size={13} />
              Listing Payments Control
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Listing Payments</h1>
            <p className="mt-3 text-sm leading-6 text-[#f2d6c0] sm:text-[15px]">
              Enable a listing to accept direct payments through its owner&apos;s Razorpay account.
              Once enabled, the owner will see a setup page under My Business to submit their
              Key ID and Key Secret (encrypted at rest) and list products or services for sale.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8c8af]">Coverage</p>
              <p className="mt-1 text-2xl font-bold">{enableRate}%</p>
              <p className="mt-1 text-sm text-[#f2d6c0]">{enabledCount} of {totalListings} listings enabled</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8c8af]">Live</p>
              <p className="mt-1 text-2xl font-bold">{liveCount}</p>
              <p className="mt-1 text-sm text-[#f2d6c0]">enabled + owner keys verified</p>
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
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Enabled</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{enabledCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Listings admin has allowed to collect payments.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef8f0] text-green-700">
              <KeyRound size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Configured</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{configuredCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Owners who have submitted Razorpay credentials.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-blue-700">
              <ShieldCheck size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Live</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{liveCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Enabled listings with verified owner keys.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff6e8] text-amber-700">
              <CreditCard size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Test Mode</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{testModeCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Listings still on Razorpay test keys.</p>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#eee2d7] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-warli-terra" />
          <h2 className="text-lg font-bold text-[#2d160b]">Per-Listing Controls</h2>
        </div>
        <p className="mt-2 text-sm text-[#7c6253]">
          Toggle the feature for each listing. The owner must still submit their Razorpay keys
          separately before checkout is actually usable on their page.
        </p>

        <div className="mt-5 space-y-4">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#ead8c8] bg-[#fcf7f2] px-4 py-8 text-center text-sm text-[#8c7364]">
              No listings yet.
            </div>
          ) : (
            rows.map((row) => {
              const action = async (formData: FormData) => {
                'use server'
                await updateListingPaymentsFromForm(row.id, formData)
              }

              const configStatusLabel = !row.hasConfig
                ? 'Owner has not submitted keys yet.'
                : row.isVerified
                  ? `Keys verified ${formatDate(row.verifiedAt) ?? 'recently'} · ${row.testMode ? 'Test mode' : 'Live mode'} · ${row.keyLast4 ? `…${row.keyLast4}` : ''}`
                  : 'Keys submitted but not verified.'

              return (
                <form
                  key={row.id}
                  action={action}
                  className="rounded-[24px] border border-[#efe2d6] bg-[#fffdfb] p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-[#2d160b]">{row.name}</p>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            row.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {row.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        {row.hasConfig && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                              row.isVerified ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            <CheckCircle size={11} />
                            {row.isVerified ? 'Verified' : 'Pending'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[#8b7264]">{row.category ?? 'Uncategorized'}</p>
                      <p className="mt-3 text-sm text-[#6f584a]">{configStatusLabel}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 rounded-xl border border-[#e9d7c8] bg-white px-3 py-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          name="payments_enabled"
                          defaultChecked={row.isEnabled}
                          className="rounded border-gray-300 text-warli-terra focus:ring-warli-terra"
                        />
                        Enable payments
                      </label>

                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-xl bg-warli-terra px-4 py-2.5 text-sm font-semibold text-warli-cream transition-colors hover:bg-warli-deep"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </form>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
