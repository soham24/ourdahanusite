import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, MessageCircle, Printer, QrCode } from 'lucide-react'
import QRCode from 'qrcode'

import { getCanonicalListingUrl } from '@/lib/listing-url'
import { siteConfig } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import CopyLinkButton from './CopyLinkButton'
import PrintButton from './PrintButton'

/**
 * Everything an owner needs to ask customers for a review: the link, a
 * ready-made WhatsApp message, and a QR card to print for the counter.
 */
export default async function ReviewKitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, subdomain, approved, review_count')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!listing) notFound()

  // The production address on purpose: a printed card outlives any preview.
  const reviewUrl = `${getCanonicalListingUrl(listing.id, listing.subdomain)}#reviews`
  const qrSvg = await QRCode.toString(reviewUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  const message = `Thank you for choosing ${listing.name}! If you were happy with us, a quick review would mean a lot: ${reviewUrl}`
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`
  const qrDownload = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {/* Print only the card: the rest of the page is instructions. */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #review-card, #review-card * { visibility: visible !important; }
        #review-card { position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none; }
      }`}</style>

      <Link href="/my-business" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] hover:text-[var(--od-brand)]">
        <ArrowLeft size={14} aria-hidden /> My Business
      </Link>

      <h1 className="font-display text-3xl text-[var(--od-ink)]">Get more reviews</h1>
      <p className="mt-2 text-sm text-[var(--od-muted)]">
        Reviews help people in {siteConfig.town} choose you. The easiest time to ask is right after a happy customer
        is served. {listing.review_count ? `${listing.name} has ${listing.review_count} so far.` : ''}
      </p>

      {!listing.approved && (
        <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your listing is not live yet, so this link will work once it is approved.
        </p>
      )}

      <section className="od-card mt-6 p-5">
        <h2 className="font-bold text-[var(--od-ink)]">1. Send the link</h2>
        <p className="mt-1 text-sm text-[var(--od-muted)]">It opens your page at the reviews.</p>
        <p className="mt-3 break-all rounded-lg bg-[var(--od-surface-soft)] px-3 py-2 font-mono text-xs text-[var(--od-ink-2)]">
          {reviewUrl}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyLinkButton url={reviewUrl} />
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#1FA855] px-4 text-sm font-bold text-white hover:bg-[#188F47]"
          >
            <MessageCircle size={15} aria-hidden /> Share on WhatsApp
          </a>
        </div>
      </section>

      <section className="od-card mt-4 p-5">
        <h2 className="font-bold text-[var(--od-ink)]">2. Put a QR code on your counter</h2>
        <p className="mt-1 text-sm text-[var(--od-muted)]">Customers scan it with their phone camera.</p>

        <div
          id="review-card"
          className="mx-auto mt-4 max-w-xs rounded-2xl border-2 border-[var(--od-ink)] bg-white p-6 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--od-brand)]">Enjoyed it?</p>
          <p className="mt-1 font-display text-2xl leading-tight text-[var(--od-ink)]">Review {listing.name}</p>
          <div
            className="mx-auto mt-4 w-48 [&>svg]:h-auto [&>svg]:w-full"
            role="img"
            aria-label={`QR code linking to ${reviewUrl}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-3 text-xs text-[var(--od-muted)]">Scan with your camera · on {siteConfig.name}</p>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <PrintButton />
          <a
            href={qrDownload}
            download={`${listing.subdomain || 'business'}-review-qr.svg`}
            className="od-button-secondary inline-flex min-h-10 items-center gap-1.5 px-4 text-sm"
          >
            <QrCode size={15} aria-hidden /> Download QR
          </a>
        </div>
      </section>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-[var(--od-muted)]">
        <Printer size={12} aria-hidden /> Printing shows only the card.
      </p>
    </div>
  )
}
