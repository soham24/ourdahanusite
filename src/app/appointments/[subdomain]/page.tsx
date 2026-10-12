import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import BookingWidget from '@/components/appointments/BookingWidget'
import { getBookableListingBySubdomain } from '@/lib/data/appointment-directory'
import { buildAbsoluteUrl } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import { siteConfig } from '@/lib/site'

type Props = { params: Promise<{ subdomain: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params
  const listing = await getBookableListingBySubdomain(subdomain)
  if (!listing) return { title: 'Appointment not available' }

  return {
    title: `Book an appointment with ${listing.name}`,
    description: `Pick a time and book online with ${listing.name} in ${siteConfig.town}.`,
    // This page substantially duplicates the business's own subdomain, which is
    // already indexed. It exists to be shared on WhatsApp, not crawled — five
    // near-identical pages is the exact pattern that triggered the AdSense
    // "low value content" rejection.
    robots: { index: false, follow: true },
    alternates: { canonical: `https://${subdomain}.${siteConfig.domain}` },
  }
}

export default async function AppointmentBookingPage({ params }: Props) {
  const { subdomain } = await params
  const listing = await getBookableListingBySubdomain(subdomain)
  if (!listing) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let viewerName = ''
  let viewerPhone = ''
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle()
    viewerName = (profile?.full_name as string | null) ?? ''
    viewerPhone = (profile?.phone as string | null) ?? ''
  }

  // The proxy prefixes every path on this host with /appointments, so
  // apex-only routes (payment recovery, the appointments list) must be
  // absolute or they 404.
  const apexOrigin = new URL(buildAbsoluteUrl('/')).origin

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-5">
        <h1 className="font-display text-3xl leading-tight">{listing.name}</h1>
        <p className="mt-1 text-sm text-[var(--od-muted)]">
          {listing.category ?? 'Appointments'} ·{' '}
          <a
            href={`https://${subdomain}.${siteConfig.domain}`}
            className="font-semibold text-[var(--od-brand)]"
          >
            View full profile →
          </a>
        </p>
      </header>

      <BookingWidget
        listingId={listing.id}
        listingName={listing.name}
        bookingFee={listing.bookingFee}
        appointmentSettings={listing.settings}
        isLoggedIn={!!user}
        userName={viewerName}
        userPhone={viewerPhone}
        userEmail={user?.email ?? ''}
        signInHref={`https://${siteConfig.domain}/login`}
        apexOrigin={apexOrigin}
      />
    </div>
  )
}
