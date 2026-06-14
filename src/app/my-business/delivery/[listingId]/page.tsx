import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Bike, MapPin } from 'lucide-react'

import { getDeliveryConfig } from '@/app/actions/delivery'
import { createClient } from '@/lib/supabase/server'

import { DeliveryConfigForm } from './DeliveryConfigForm'

export default async function ListingDeliveryPage({
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
    .select('id, name, category, owner_id, lat, lng')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) notFound()
  if (listing.owner_id !== user.id) redirect('/my-business')

  const config = await getDeliveryConfig(listingId)
  const hasLocation = listing.lat != null && listing.lng != null

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <Link
        href="/my-business"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] hover:text-brand transition-colors"
      >
        <ArrowLeft size={14} />
        All listings
      </Link>

      <header className="rounded-[30px] border border-[var(--od-border)] bg-gradient-to-br from-[#fff7ef] via-white to-[#f4ede4] px-6 py-7 shadow-sm sm:px-8">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Bike size={24} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--od-muted)]">
              {listing.category ?? 'Listing'}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--od-ink)]">{listing.name}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--od-ink-2)]">
              Turn on delivery so customers can order for doorstep delivery. Set how far you
              deliver and your delivery fee. Manage what you sell under{' '}
              <Link href={`/my-business/products/${listingId}`} className="font-semibold text-brand hover:underline">
                Products
              </Link>.
            </p>
          </div>
        </div>
      </header>

      {!hasLocation && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <MapPin size={16} className="mt-0.5 flex-shrink-0" />
          <p>
            Set your business location (map pin) in{' '}
            <Link href={`/my-business/edit/${listingId}`} className="font-semibold underline">
              Edit listing
            </Link>{' '}
            first — delivery distance and fees are calculated from it.
          </p>
        </div>
      )}

      <DeliveryConfigForm listingId={listingId} initialConfig={config} />
    </div>
  )
}
