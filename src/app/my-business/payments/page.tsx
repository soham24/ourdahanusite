import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Info,
  ShieldCheck,
  Store,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'

import { RazorpaySetupForm } from './RazorpaySetupForm'

type Listing = {
  id: string
  name: string
  category: string | null
  payments_enabled: boolean | null
}

type PaymentConfig = {
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

export default async function MyBusinessPaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listingsData } = await supabase
    .from('listings')
    .select('id, name, category, payments_enabled')
    .eq('owner_id', user.id)
    .order('name', { ascending: true })

  const listings = (listingsData ?? []) as Listing[]

  let configs: PaymentConfig[] = []
  if (listings.length > 0) {
    const { data } = await supabase
      .from('listing_payment_configs')
      .select('listing_id, razorpay_key_id, razorpay_key_last4, test_mode, verified_at, updated_at')
      .in('listing_id', listings.map((l) => l.id))
    configs = (data ?? []) as PaymentConfig[]
  }
  const configByListing = new Map(configs.map((c) => [c.listing_id, c]))

  const enabledListings = listings.filter((l) => l.payments_enabled)
  const lockedListings = listings.filter((l) => !l.payments_enabled)

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <Link
          href="/my-business"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand transition-colors"
        >
          <ArrowLeft size={14} />
          Back to My Business
        </Link>
      </div>

      <header className="rounded-[30px] border border-[#ecd8c5] bg-gradient-to-br from-[#fff7ef] via-white to-[#f4ede4] px-6 py-7 shadow-sm sm:px-8">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <CreditCard size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-[#2d160b]">Accept Payments</h1>
            <p className="mt-2 text-sm leading-6 text-[#6f584a]">
              Connect your own Razorpay account to sell products and services directly from your
              business page. Money goes straight to your Razorpay account &mdash; OurDahanu never
              holds or touches it.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="font-semibold">How to get your Razorpay keys</p>
            <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-6">
              <li>
                Sign in to your Razorpay dashboard at{' '}
                <a
                  href="https://dashboard.razorpay.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                >
                  dashboard.razorpay.com <ExternalLink size={11} />
                </a>
                .
              </li>
              <li>
                Go to <span className="font-semibold">Account &amp; Settings &rarr; API Keys</span> and click{' '}
                <span className="font-semibold">Generate Key</span> (use <span className="font-semibold">Test Mode</span> first).
              </li>
              <li>
                Copy the <span className="font-semibold">Key ID</span> (starts with <code className="rounded bg-white px-1 py-0.5 text-xs">rzp_test_</code> or <code className="rounded bg-white px-1 py-0.5 text-xs">rzp_live_</code>) and the <span className="font-semibold">Key Secret</span> and paste them below. We encrypt the secret at rest.
              </li>
              <li>
                When you&apos;re ready to accept real money, generate <span className="font-semibold">Live Keys</span> in Razorpay and update them here.
              </li>
            </ol>
          </div>
        </div>
      </section>

      {lockedListings.length > 0 && (
        <section className="rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-4">
          <div className="flex items-start gap-2">
            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Pending admin approval ({lockedListings.length})
              </p>
              <p className="mt-1 text-[13px] text-amber-800">
                These listings haven&apos;t been enabled for payments yet. An admin has to flip
                the feature on before you can configure Razorpay.
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {lockedListings.map((l) => (
                  <li
                    key={l.id}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200"
                  >
                    <Store size={11} />
                    {l.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {enabledListings.length === 0 ? (
        <section className="rounded-[28px] border border-[#eee2d7] bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-lg font-semibold text-[#2d160b]">No listings ready for payments yet.</p>
          <p className="mt-2 text-sm text-[#7c6253]">
            {listings.length === 0
              ? 'Submit a listing first, then an admin can enable payments for it.'
              : 'Ask an admin to enable payments on one of your listings to begin.'}
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {enabledListings.map((listing) => {
            const config = configByListing.get(listing.id) ?? null
            const verified = !!config?.verified_at

            return (
              <section
                key={listing.id}
                className="rounded-[28px] border border-[#eee2d7] bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-[#2d160b]">{listing.name}</h2>
                      {verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle size={11} />
                          Verified
                        </span>
                      )}
                      {config && !verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          Pending verification
                        </span>
                      )}
                      {config?.test_mode && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          Test mode
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[#8b7264]">{listing.category ?? 'Uncategorized'}</p>
                  </div>

                  {config?.razorpay_key_last4 && (
                    <p className="text-xs text-[#7c6253]">
                      Key ending <span className="font-semibold text-[#2d160b]">…{config.razorpay_key_last4}</span>
                      {' '}· updated {formatDate(config.updated_at) ?? '—'}
                    </p>
                  )}
                </div>

                <div className="mt-5">
                  <RazorpaySetupForm
                    listingId={listing.id}
                    existing={config ? {
                      keyId: config.razorpay_key_id,
                      keyLast4: config.razorpay_key_last4,
                      testMode: config.test_mode,
                      verifiedAt: config.verified_at,
                    } : null}
                  />
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
