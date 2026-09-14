'use client'

import { useState } from 'react'
import { MessageCircle, Phone } from 'lucide-react'

import { revealJobContact } from '@/app/actions/jobs'
import { formatIndianPhone, telHrefIndia, waHrefIndia } from '@/lib/jobs/phone'

/**
 * The number is fetched on tap, never rendered into the cached page. Logged-out
 * visitors are sent to login and brought back to this post.
 */
export default function ShowContactButton({ postId }: { postId: string }) {
  const [contact, setContact] = useState<{ phone: string; whatsapp: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function reveal() {
    setPending(true)
    setError(null)
    try {
      const result = await revealJobContact(postId)
      if ('loginUrl' in result) {
        window.location.href = result.loginUrl
        return
      }
      if ('error' in result) {
        setError(result.error)
        return
      }
      setContact({ phone: result.phone, whatsapp: result.whatsapp })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (contact) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <a href={telHrefIndia(contact.phone)} className="od-button-primary h-11 flex-1 text-[15px] active:scale-[0.98]">
          <Phone size={16} aria-hidden /> Call <span className="tabular-nums">{formatIndianPhone(contact.phone)}</span>
        </a>
        {contact.whatsapp && (
          <a
            href={waHrefIndia(contact.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[rgba(19,138,75,0.3)] bg-[rgba(19,138,75,0.06)] text-[15px] font-bold text-[var(--color-success-strong)] transition-colors duration-150 hover:bg-[rgba(19,138,75,0.12)] active:scale-[0.98]"
          >
            <MessageCircle size={16} className="text-[var(--od-success)]" aria-hidden /> WhatsApp
          </a>
        )}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={reveal}
        disabled={pending}
        className="od-button-primary h-11 w-full text-[15px] active:scale-[0.99] disabled:opacity-60"
      >
        <Phone size={16} aria-hidden /> {pending ? 'Checking…' : 'Show phone number'}
      </button>
      <p className="mt-2 text-center text-xs text-[var(--od-muted)]">
        Log in with Google to see the number. It is never shown publicly.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm font-semibold text-[var(--od-danger)]">
          {error}
        </p>
      )}
    </div>
  )
}
