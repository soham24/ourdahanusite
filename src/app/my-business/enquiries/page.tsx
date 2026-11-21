import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Inbox, MessageCircle, Phone } from 'lucide-react'

import { getMyBusinessEnquiries } from '@/app/actions/enquiries'
import { createClient } from '@/lib/supabase/server'
import { getAuthIdentity } from '@/lib/supabase/auth-claims'
import { formatWhatsAppPhone } from '@/lib/whatsapp'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}

export default async function EnquiriesPage() {
  const supabase = await createClient()
  const user = await getAuthIdentity(supabase)
  if (!user) redirect('/login?next=' + encodeURIComponent('/my-business/enquiries'))

  const { enquiries, error } = await getMyBusinessEnquiries()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/my-business" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] hover:text-[var(--od-brand)]">
        <ArrowLeft size={14} aria-hidden /> My Business
      </Link>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-soft">
          <Inbox size={20} className="text-brand" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enquiries</h1>
          <p className="text-sm text-gray-500">Private messages customers sent from your listing page</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {!error && enquiries.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center">
          <h2 className="mb-2 font-semibold text-gray-900">No enquiries yet</h2>
          <p className="mx-auto max-w-xs text-sm text-gray-400">
            Customers can message you from your listing page. A complete listing gets more of them.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {enquiries.map((enquiry) => {
            const wa = formatWhatsAppPhone(enquiry.phone)
            return (
              <li key={enquiry.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-gray-900">
                    {enquiry.name} <span className="font-normal text-gray-500">· {enquiry.phone}</span>
                  </p>
                  <p className="text-xs text-gray-400">{formatWhen(enquiry.created_at)}</p>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">To {enquiry.listing_name}</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700">{enquiry.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`tel:${enquiry.phone.replace(/[^\d+]/g, '')}`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-gray-700 hover:border-brand hover:text-brand"
                  >
                    <Phone size={14} aria-hidden /> Call
                  </a>
                  {wa && (
                    <a
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello ${enquiry.name}, thank you for your enquiry to ${enquiry.listing_name}. `)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#1FA855] px-3 text-sm font-bold text-white hover:bg-[#188F47]"
                    >
                      <MessageCircle size={14} aria-hidden /> Reply on WhatsApp
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
