'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2, Mail, Send } from 'lucide-react'

import Card from '@/components/ui/Card'
import { sendEnquiry } from '@/app/actions/enquiries'
import { ENQUIRY_LIMITS } from '@/lib/enquiry'
import { loginHref } from '@/lib/login-redirect'
import { buildAbsoluteUrl } from '@/lib/site'
import { useListingViewer } from '../ListingViewerContext'

/**
 * A private message to the business. Unlike a question it is not shown on the
 * page; the owner gets it as a notification and replies by phone or WhatsApp.
 */
export default function EnquiryCard({ listingId, listingName }: { listingId: string; listingName: string }) {
  const viewer = useListingViewer()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  if (viewer.isOwner) return null

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setStatus('sending')
    setError('')
    try {
      const result = await sendEnquiry(listingId, {
        name: String(form.get('name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        message: String(form.get('message') ?? ''),
      })
      if (result.error) {
        setError(result.error)
        setStatus('idle')
        return
      }
      setStatus('sent')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setStatus('idle')
    }
  }

  const inputClass =
    'w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none'

  return (
    <Card id="enquiry" className="scroll-mt-32">
      <h2 className="text-base font-bold text-ink mb-1 flex items-center gap-2">
        <span className="w-1 h-4 bg-brand rounded-full inline-block" />
        Leave a message
      </h2>
      <p className="mb-4 text-sm text-muted">
        Can’t call right now? Leave a message and {listingName} will call or WhatsApp you back. Only they see it.
      </p>

      {status === 'sent' ? (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
          Sent. {listingName} has been notified and will get back to you.
        </p>
      ) : !viewer.isLoggedIn ? (
        <div className="rounded-2xl border border-border/60 bg-surface-soft/60 px-4 py-5 text-center">
          <p className="mb-3 text-sm text-gray-600">Sign in to leave a message. It keeps spam out.</p>
          <Link
            href={buildAbsoluteUrl(loginHref(`/listings/${listingId}#enquiry`))}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong"
          >
            <Mail size={15} aria-hidden /> Sign in to leave a message
          </Link>
        </div>
      ) : (
        // Keyed on the viewer so the defaults fill in once they load.
        <form key={viewer.email} onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-gray-600">
              Your name
              <input name="name" required maxLength={ENQUIRY_LIMITS.name} defaultValue={viewer.name} autoComplete="name" className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-xs font-semibold text-gray-600">
              Phone for the reply
              <input name="phone" required type="tel" inputMode="tel" defaultValue={viewer.phone} autoComplete="tel" className={`${inputClass} mt-1`} />
            </label>
          </div>
          <label className="block text-xs font-semibold text-gray-600">
            Message
            <textarea
              name="message"
              required
              rows={3}
              maxLength={ENQUIRY_LIMITS.message}
              placeholder="What would you like to ask or order? When is a good time to call?"
              className={`${inputClass} mt-1 resize-y`}
            />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong disabled:opacity-60"
          >
            <Send size={15} aria-hidden /> {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>
        </form>
      )}
    </Card>
  )
}
