'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'

import { bookAppointment } from '@/app/actions/appointments'
import { submitPaidJob } from '@/app/actions/jobs'
import { renewListing, submitPaidListing } from '@/app/actions/listings'
import { placeMarketplaceOrder } from '@/app/actions/marketplace-orders'
import { placeOrder } from '@/app/actions/orders'
import {
  attemptWithRetry,
  buildFormDataFromSnapshot,
  clearRecoveryDraft,
  getRecoveryDraft,
  type PaymentRecoveryDraft,
  type PaymentRecoveryFlow,
  updateRecoveryDraft,
} from '@/lib/payment-retry'

type RecoverState =
  | { kind: 'loading' }
  | { kind: 'no-draft'; serverPayload: ServerIntent | null }
  | { kind: 'no-payment'; draft: PaymentRecoveryDraft }
  | { kind: 'finalized'; serverPayload: ServerIntent }
  | { kind: 'recovering'; draft: PaymentRecoveryDraft }
  | { kind: 'error'; message: string; draft: PaymentRecoveryDraft | null }
  | { kind: 'success'; flow: PaymentRecoveryFlow; draft: PaymentRecoveryDraft }

interface ServerIntent {
  orderId: string
  paymentId: string | null
  flow: PaymentRecoveryFlow
  status: 'created' | 'captured' | 'finalized' | 'failed' | 'cancelled'
  entityId: string | null
  entityTable: string | null
  listingId: string | null
  payload: Record<string, unknown>
  lastError: string | null
  finalizedAt: string | null
  capturedAt: string | null
  amountPaise: number
  razorpayStatus?: string | null
  isPaid?: boolean
}

const FLOW_LABEL: Record<PaymentRecoveryFlow, string> = {
  listing: 'Business Listing',
  renew: 'Listing Renewal',
  job: 'Job Posting',
  order: 'Service Order',
  marketplace: 'Marketplace Order',
  appointment: 'Appointment Booking',
}

const successHomeFor: Record<PaymentRecoveryFlow, string> = {
  listing: '/listings?submitted=1',
  renew: '/my-business?renewed=1',
  job: '/jobs?submitted=1',
  order: '/account/orders',
  marketplace: '/account/orders',
  appointment: '/dashboard/appointments',
}

export default function RecoverClient({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [state, setState] = useState<RecoverState>({ kind: 'loading' })
  const startedRef = useRef(false)

  const runRecovery = useCallback(
    async (draft: PaymentRecoveryDraft) => {
      if (!draft.paymentId || !draft.signature) {
        setState({ kind: 'no-payment', draft })
        return
      }

      setState({ kind: 'recovering', draft })

      try {
        const fd = buildFormDataFromSnapshot(draft.fields)
        fd.set('razorpay_order_id', draft.orderId)
        fd.set('razorpay_payment_id', draft.paymentId)
        fd.set('razorpay_signature', draft.signature)

        const result = await attemptWithRetry(async () => {
          switch (draft.flow) {
            case 'listing':
              return submitPaidListing(fd)
            case 'renew': {
              const listingId = draft.fields.listing_id
              if (!listingId) {
                return { error: 'Missing listing id for renewal recovery.' }
              }
              return renewListing(listingId, fd)
            }
            case 'job':
              return submitPaidJob(fd)
            case 'order':
              return placeOrder(fd)
            case 'marketplace':
              return placeMarketplaceOrder(fd)
            case 'appointment':
              return bookAppointment(fd)
            default:
              return { error: 'Unknown flow.' }
          }
        })

        if (result?.error) {
          updateRecoveryDraft(draft.orderId, { lastError: result.error })
          setState({ kind: 'error', message: result.error, draft })
          return
        }

        clearRecoveryDraft(draft.orderId)
        setState({ kind: 'success', flow: draft.flow, draft })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not finish the recovery.'
        updateRecoveryDraft(draft.orderId, { lastError: message })
        setState({ kind: 'error', message, draft })
      }
    },
    [],
  )

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function init() {
      // Try the in-browser draft first (richest payload).
      const draft = getRecoveryDraft(orderId)
      if (draft && draft.paymentId && draft.signature) {
        await runRecovery(draft)
        return
      }

      // Fall back to the server intent so the user gets a sensible message
      // even if they cleared cookies / switched browsers / used incognito.
      try {
        const res = await fetch(`/api/razorpay/recover?orderId=${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
        })
        if (res.ok) {
          const serverPayload = (await res.json()) as ServerIntent
          if (serverPayload.status === 'finalized') {
            setState({ kind: 'finalized', serverPayload })
            return
          }
          setState({ kind: 'no-draft', serverPayload })
          return
        }
      } catch {
        // ignore — fall through
      }

      if (draft) {
        setState({ kind: 'no-payment', draft })
      } else {
        setState({ kind: 'no-draft', serverPayload: null })
      }
    }

    void init()
  }, [orderId, runRecovery])

  useEffect(() => {
    if (state.kind !== 'success') return
    const timer = window.setTimeout(() => {
      router.push(successHomeFor[state.flow])
    }, 2200)
    return () => window.clearTimeout(timer)
  }, [router, state])

  return (
    <main className="min-h-screen bg-surface-soft px-4 py-12">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Finishing your payment</h1>
          <p className="mt-1 text-sm text-ink-2">
            Order ID: <span className="font-mono">{orderId}</span>
          </p>
        </div>

        {state.kind === 'loading' && (
          <Card icon={<Loader2 className="animate-spin" size={24} />} title="Checking payment status…">
            We&apos;re looking up your payment with Razorpay and our database. This usually takes
            just a couple of seconds.
          </Card>
        )}

        {state.kind === 'recovering' && (
          <Card icon={<Loader2 className="animate-spin" size={24} />} title="Recovering your submission…">
            Your payment was captured. We&apos;re creating your{' '}
            <strong>{FLOW_LABEL[state.draft.flow].toLowerCase()}</strong> now. Please don&apos;t close this page.
          </Card>
        )}

        {state.kind === 'finalized' && (
          <Card
            icon={<CheckCircle size={24} className="text-green-600" />}
            title="All done — your payment was already recorded."
            tone="success"
          >
            We finished this submission earlier. Nothing more to do.
            <ActionRow>
              <Link
                href={successHomeFor[state.serverPayload.flow]}
                className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-bg hover:bg-brand-strong"
              >
                Go to my {FLOW_LABEL[state.serverPayload.flow].toLowerCase()}
              </Link>
            </ActionRow>
          </Card>
        )}

        {state.kind === 'success' && (
          <Card
            icon={<CheckCircle size={24} className="text-green-600" />}
            title={`${FLOW_LABEL[state.flow]} created!`}
            tone="success"
          >
            We finished it without charging you again. Redirecting…
          </Card>
        )}

        {state.kind === 'error' && (
          <Card
            icon={<ShieldAlert size={24} className="text-red-600" />}
            title="We couldn't finish automatically"
            tone="error"
          >
            {state.message}
            <p className="mt-3 text-sm text-ink-2">
              Don&apos;t worry — your payment is recorded on our end. You can retry now or contact
              support with this Order ID.
            </p>
            <ActionRow>
              {state.draft && (
                <button
                  onClick={() => void runRecovery(state.draft!)}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-bg hover:bg-brand-strong"
                >
                  <RefreshCw size={14} /> Try again
                </button>
              )}
              <Link
                href="/"
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-ink-2 hover:border-brand hover:text-brand"
              >
                Back home
              </Link>
            </ActionRow>
          </Card>
        )}

        {state.kind === 'no-payment' && (
          <Card
            icon={<ShieldAlert size={24} className="text-amber-600" />}
            title="Payment was not completed"
            tone="warning"
          >
            We have your draft saved, but no payment was captured for this order. You can return
            to the form and try again.
            <ActionRow>
              {state.draft.returnTo ? (
                <Link
                  href={state.draft.returnTo}
                  className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-bg hover:bg-brand-strong"
                >
                  Return to the form
                </Link>
              ) : null}
              <button
                onClick={() => {
                  clearRecoveryDraft(orderId)
                  router.push('/')
                }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-ink-2 hover:border-brand hover:text-brand"
              >
                Discard
              </button>
            </ActionRow>
          </Card>
        )}

        {state.kind === 'no-draft' && (
          <Card
            icon={<ShieldCheck size={24} className="text-brand" />}
            title="We need to verify this on the server"
            tone={state.serverPayload?.status === 'captured' ? 'warning' : 'neutral'}
          >
            {state.serverPayload ? (
              <>
                Status: <strong className="capitalize">{state.serverPayload.status}</strong>.{' '}
                {state.serverPayload.status === 'captured' ? (
                  <>
                    Your payment was captured but the entity wasn&apos;t finalized in this browser.
                    Please contact support with this Order ID — we have all the details we need.
                  </>
                ) : state.serverPayload.status === 'created' ? (
                  <>The order was created but Razorpay hasn&apos;t confirmed payment yet.</>
                ) : (
                  <>Status was {state.serverPayload.status}; nothing more to do.</>
                )}
              </>
            ) : (
              <>We couldn&apos;t find this order on our server. If you were charged, please contact
                support with the Order ID above.</>
            )}
            <ActionRow>
              <Link
                href="/"
                className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-bg hover:bg-brand-strong"
              >
                Back home
              </Link>
            </ActionRow>
          </Card>
        )}
      </div>
    </main>
  )
}

function Card({
  icon,
  title,
  children,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'error'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-green-200 bg-green-50'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'error'
          ? 'border-red-200 bg-red-50'
          : 'border-border bg-white'

  return (
    <div className={`rounded-2xl border ${toneClass} p-6 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
          {icon}
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-ink">{title}</h2>
          <div className="mt-2 text-sm text-ink-2">{children}</div>
        </div>
      </div>
    </div>
  )
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex flex-wrap gap-2">{children}</div>
}
