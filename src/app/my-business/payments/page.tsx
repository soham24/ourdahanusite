import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { classifyRazorpayKeyId } from '@/lib/selling/keys'
import { createClient } from '@/lib/supabase/server'

import ConnectRazorpay, { type PaymentView } from './ConnectRazorpay'

type OwnerListing = {
  id: string
  name: string
  category: string | null
  approved: boolean | null
  payments_suspended_at: string | null
  payments_suspended_reason: string | null
}

type OwnerConfig = {
  listing_id: string
  razorpay_key_id: string
  razorpay_key_last4: string
  verified_at: string | null
  updated_at: string
}

function paymentViewFor(listing: OwnerListing, config: OwnerConfig | null): PaymentView {
  if (listing.payments_suspended_at) return { kind: 'suspended', reason: listing.payments_suspended_reason }
  if (!listing.approved) return { kind: 'not_approved' }
  if (!config) return { kind: 'not_connected' }
  if (!config.verified_at) return { kind: 'rejected' }
  return {
    kind: 'connected',
    mode: classifyRazorpayKeyId(config.razorpay_key_id) === 'live' ? 'live' : 'test',
    keyLast4: config.razorpay_key_last4,
    connectedAt: config.updated_at,
  }
}

function statusText(view: PaymentView): string {
  switch (view.kind) {
    case 'connected':
      return view.mode === 'live' ? 'Live' : 'Test'
    case 'rejected':
      return 'Reconnect needed'
    case 'suspended':
      return 'Paused'
    case 'not_approved':
      return 'Listing not live yet'
    case 'not_connected':
      return 'Not connected'
  }
}

export default async function MyBusinessPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent('/my-business/payments')}`)

  const { listing: requestedId } = await searchParams

  const { data: listingsData } = await supabase
    .from('listings')
    .select('id, name, category, approved, payments_suspended_at, payments_suspended_reason')
    .eq('owner_id', user.id)
    .order('name', { ascending: true })
  const listings = (listingsData ?? []) as OwnerListing[]

  if (requestedId && !listings.some((listing) => listing.id === requestedId)) notFound()

  let configs: OwnerConfig[] = []
  if (listings.length > 0) {
    const { data } = await supabase
      .from('listing_payment_configs')
      .select('listing_id, razorpay_key_id, razorpay_key_last4, verified_at, updated_at')
      .in('listing_id', listings.map((listing) => listing.id))
    configs = (data ?? []) as OwnerConfig[]
  }
  const configByListing = new Map(configs.map((config) => [config.listing_id, config]))

  const selected = requestedId
    ? listings.find((listing) => listing.id === requestedId) ?? null
    : listings.length === 1
      ? listings[0]
      : null
  const backToList = selected !== null && listings.length > 1

  return (
    <div className="od-page min-h-screen py-8 md:py-10">
      <div className="od-shell max-w-2xl space-y-5">
        <Link
          href={backToList ? '/my-business/payments' : '/my-business'}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
        >
          <ArrowLeft size={14} aria-hidden />
          {backToList ? 'All businesses' : 'My Business'}
        </Link>

        <header>
          <p className="od-eyebrow">Sell online</p>
          <h1 className="od-section-title mt-1 text-3xl md:text-4xl">
            {selected ? selected.name : 'Online payments'}
          </h1>
          <p className="od-muted mt-2 text-sm leading-relaxed">
            Connect your own Razorpay account. Customers pay you directly — OurDahanu never holds your money.
          </p>
        </header>

        {listings.length === 0 ? (
          <section className="od-card p-6 text-center">
            <p className="text-base font-bold text-[var(--od-ink)]">Add your business first</p>
            <p className="od-muted mt-1 text-sm">Once your listing is live, you can start selling online.</p>
            <Link href="/listings/submit" className="od-button-primary mt-4 px-4 py-2.5 text-sm">
              Add your business
            </Link>
          </section>
        ) : selected ? (
          <ConnectRazorpay
            key={selected.id}
            listingId={selected.id}
            view={paymentViewFor(selected, configByListing.get(selected.id) ?? null)}
          />
        ) : (
          <ul className="space-y-3">
            {listings.map((listing) => {
              const view = paymentViewFor(listing, configByListing.get(listing.id) ?? null)
              return (
                <li key={listing.id}>
                  <Link
                    href={`/my-business/payments?listing=${listing.id}`}
                    className="od-card od-card-hover flex items-center justify-between gap-3 p-4"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-[var(--od-ink)]">{listing.name}</span>
                      <span className="od-muted block text-xs">{listing.category ?? 'Business'}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[var(--od-brand-strong)]">
                      {statusText(view)}
                      <ArrowRight size={14} aria-hidden />
                    </span>
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
