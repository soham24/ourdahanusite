'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ShieldAlert, X } from 'lucide-react'

import {
  clearRecoveryDraft,
  listCapturedRecoveryDrafts,
  recoveryUrlFor,
  RECOVERY_DRAFTS_CHANGED_EVENT,
  type PaymentRecoveryDraft,
} from '@/lib/payment-retry'
import { paymentRecoveryBottom } from '@/lib/mobile-layout'

const FLOW_LABEL = {
  listing: 'business listing',
  renew: 'listing renewal',
  order: 'service order',
  marketplace: 'marketplace order',
  appointment: 'appointment booking',
} as const

const DISMISS_KEY = 'ourdahanu:payment-recovery-dismissed/v1'

function isDismissed(orderId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const map = JSON.parse(raw) as Record<string, number>
    const expiry = map?.[orderId]
    return typeof expiry === 'number' && Date.now() < expiry
  } catch {
    return false
  }
}

function dismiss(orderId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    // Re-show after 30 minutes if the user keeps opening the app.
    map[orderId] = Date.now() + 30 * 60 * 1000
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

/**
 * Global watcher: scans localStorage on mount + every 30 seconds for
 * captured-but-not-finalized payments and surfaces a recovery banner.
 *
 * If the user closed the tab right after Razorpay charged them, this
 * banner is the first thing they see on the next page load and offers
 * a one-click finish.
 *
 * Suppresses itself on the recovery page (where the user is already
 * dealing with the issue) and on /login (where it would be confusing).
 */
export default function PaymentRecoveryWatcher() {
  const pathname = usePathname() ?? ''
  const [draft, setDraft] = useState<PaymentRecoveryDraft | null>(null)

  useEffect(() => {
    const tick = () => {
      const drafts = listCapturedRecoveryDrafts()
      const next = drafts.find((d) => !isDismissed(d.orderId)) ?? null
      setDraft(next)
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    const onFocus = () => tick()
    window.addEventListener('focus', onFocus)
    // Re-scan the instant a draft is added/cleared (e.g. right after a payment
    // succeeds and clearRecoveryDraft runs) so the banner never lingers.
    window.addEventListener(RECOVERY_DRAFTS_CHANGED_EVENT, tick)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(RECOVERY_DRAFTS_CHANGED_EVENT, tick)
    }
  }, [])

  if (!draft) return null

  // Don't shadow the user when they're already handling this exact intent.
  if (pathname.startsWith('/payments/recover/')) return null
  if (pathname === '/login' || pathname.startsWith('/auth/')) return null

  const flowLabel = FLOW_LABEL[draft.flow] ?? 'submission'
  const amountRupees = Math.round(draft.amountPaise / 100)
  const hasBottomChrome = typeof document !== 'undefined'
    && !window.matchMedia('(min-width: 1024px)').matches
    && Boolean(document.querySelector('[data-mobile-bottom-chrome]'))

  return (
    <div
      className="fixed inset-x-3 z-[60] sm:left-auto sm:right-4 sm:max-w-sm"
      style={{ bottom: paymentRecoveryBottom(hasBottomChrome) }}
    >
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <ShieldAlert size={20} className="mt-0.5 flex-shrink-0 text-amber-700" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">
              Finish your payment
            </p>
            <p className="mt-1 text-xs text-amber-800">
              We saved your {flowLabel} after a ₹{amountRupees} payment but never confirmed it.
              Click below to complete it without paying again.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={recoveryUrlFor(draft.orderId)}
                className="inline-flex items-center rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
              >
                Finish now
              </Link>
              <button
                type="button"
                onClick={() => {
                  dismiss(draft.orderId)
                  setDraft(null)
                }}
                className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:border-amber-400"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Discard this saved submission? Only do this if you do NOT want to recover the payment.',
                    )
                  ) {
                    clearRecoveryDraft(draft.orderId)
                    setDraft(null)
                  }
                }}
                className="ml-auto inline-flex items-center rounded-lg p-1.5 text-amber-700 hover:bg-amber-100"
                aria-label="Discard"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
