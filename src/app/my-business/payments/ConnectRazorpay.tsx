'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle, ExternalLink, Eye, EyeOff, Loader2, PauseCircle } from 'lucide-react'

import { deleteRazorpayConfig, saveRazorpayConfig } from '@/app/actions/listing-payments'
import { classifyRazorpayKeyId } from '@/lib/selling/keys'
import { LISTING_NOT_LIVE_MESSAGE, sellingPausedMessage } from '@/lib/selling/shop-mode'

export type PaymentView =
  | { kind: 'not_approved' }
  | { kind: 'suspended'; reason: string | null }
  | { kind: 'not_connected' }
  | { kind: 'rejected' }
  | { kind: 'connected'; mode: 'test' | 'live'; keyLast4: string; connectedAt: string }

type AccountAnswer = 'unknown' | 'no' | 'yes'

const inputCls = 'od-input h-11 w-full px-3.5 text-[15px]'
const labelCls = 'mb-1 block text-[13px] font-bold text-[var(--od-ink-2)]'
const stepCls = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--od-muted)]'
const headingCls = 'mt-1 text-lg font-bold text-[var(--od-ink)]'
const noteCls =
  'rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--od-ink-2)]'
const errorCls =
  'rounded-xl border border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.05)] px-3.5 py-2.5 text-sm font-semibold text-[var(--od-danger)]'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** A drawing, not a screenshot: where the keys live in the Razorpay dashboard. */
function KeysIllustration() {
  return (
    <svg
      viewBox="0 0 320 150"
      role="img"
      aria-label="Razorpay dashboard: Account and Settings, then API Keys, then Generate Key"
      className="w-full max-w-sm text-[var(--od-muted)]"
    >
      <rect x="1" y="1" width="318" height="148" rx="12" className="fill-white stroke-current" strokeOpacity="0.35" />
      <rect x="1" y="1" width="318" height="22" rx="12" className="fill-current" fillOpacity="0.08" />
      <circle cx="16" cy="12" r="3" className="fill-current" fillOpacity="0.4" />
      <circle cx="27" cy="12" r="3" className="fill-current" fillOpacity="0.4" />
      <circle cx="38" cy="12" r="3" className="fill-current" fillOpacity="0.4" />
      <rect x="12" y="34" width="88" height="104" rx="8" className="fill-current" fillOpacity="0.06" />
      <text x="20" y="54" fontSize="9" className="fill-current">Dashboard</text>
      <text x="20" y="72" fontSize="9" className="fill-current">Payments</text>
      <rect x="15" y="82" width="82" height="18" rx="5" className="fill-[var(--od-brand)]" fillOpacity="0.14" />
      <text x="19" y="94" fontSize="8.5" fontWeight="700" className="fill-[var(--od-brand-strong)]">Account &amp; Settings</text>
      <text x="112" y="54" fontSize="11" fontWeight="700" className="fill-current">API Keys</text>
      <rect x="112" y="66" width="192" height="16" rx="4" className="fill-current" fillOpacity="0.07" />
      <text x="118" y="77" fontSize="8" className="fill-current">Key ID · rzp_test_••••••••</text>
      <rect x="112" y="88" width="192" height="16" rx="4" className="fill-current" fillOpacity="0.07" />
      <text x="118" y="99" fontSize="8" className="fill-current">Key Secret · shown once</text>
      <rect x="112" y="114" width="92" height="22" rx="6" className="fill-[var(--od-brand)]" />
      <text x="126" y="129" fontSize="9" fontWeight="700" className="fill-white">Generate Key</text>
    </svg>
  )
}

function KeyIdHint({ keyId }: { keyId: string }) {
  const kind = classifyRazorpayKeyId(keyId)
  if (kind === 'empty') return null
  if (kind === 'invalid') {
    return (
      <p className="mt-1.5 text-xs font-semibold text-[var(--od-danger)]">
        This doesn&apos;t look like a Razorpay Key ID
      </p>
    )
  }
  return (
    <p className="mt-1.5 text-xs font-semibold text-[var(--color-success-strong)]">
      {kind === 'test' ? 'Test key · practice, no real money' : 'Live key · real payments'}
    </p>
  )
}

export default function ConnectRazorpay({
  listingId,
  view,
}: {
  listingId: string
  view: PaymentView
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(view.kind === 'not_connected' || view.kind === 'rejected')
  const [account, setAccount] = useState<AccountAnswer>(view.kind === 'not_connected' ? 'unknown' : 'yes')
  const [keyId, setKeyId] = useState('')
  const [keySecret, setKeySecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData()
    formData.set('listing_id', listingId)
    formData.set('razorpay_key_id', keyId.trim())
    formData.set('razorpay_key_secret', keySecret.trim())
    startTransition(async () => {
      const result = await saveRazorpayConfig(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setKeyId('')
      setKeySecret('')
      setShowSecret(false)
      setEditing(false)
      router.refresh()
    })
  }

  function disconnect() {
    setError(null)
    startTransition(async () => {
      const result = await deleteRazorpayConfig(listingId)
      if (result.error) {
        setError(result.error)
        return
      }
      setConfirmingDisconnect(false)
      setAccount('yes')
      setEditing(true)
      router.refresh()
    })
  }

  if (view.kind === 'not_approved') {
    return (
      <section className="od-card p-5 text-center sm:p-6">
        <p className="text-base font-bold text-[var(--od-ink)]">{LISTING_NOT_LIVE_MESSAGE}</p>
        <Link href="/my-business" className="od-button-secondary mt-4 px-4 py-2.5 text-sm">
          Back to My Business
        </Link>
      </section>
    )
  }

  if (view.kind === 'suspended') {
    return (
      <section className="od-card flex items-start gap-3 p-5 sm:p-6">
        <PauseCircle size={22} className="mt-0.5 shrink-0 text-[var(--od-danger)]" aria-hidden />
        <p className="text-sm leading-relaxed text-[var(--od-ink-2)]">{sellingPausedMessage(view.reason)}</p>
      </section>
    )
  }

  if (view.kind === 'connected' && !editing) {
    return (
      <section className="od-card space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(19,138,75,0.12)]">
            <CheckCircle size={20} className="text-[var(--od-success)]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold text-[var(--od-ink)]">
              {view.mode === 'live' ? 'Live · real payments on' : 'Test · only you can see your shop'}
            </p>
            <p className="mt-0.5 text-[13px] text-[var(--od-muted)]">
              Key ending …{view.keyLast4} · connected {formatDate(view.connectedAt)}
            </p>
          </div>
        </div>

        {view.mode === 'test' && (
          <div className={noteCls}>
            <p className="font-bold">Ready for real payments?</p>
            <p className="mt-1">
              Once Razorpay has activated your account, switch the Razorpay dashboard to Live Mode,
              generate Live keys, and paste them here with Replace keys.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className={errorCls}>
            {error}
          </p>
        )}

        {confirmingDisconnect ? (
          <div className="rounded-xl border border-[var(--od-border)] p-4">
            <p className="text-sm font-bold text-[var(--od-ink)]">Disconnect Razorpay?</p>
            <p className="mt-1 text-sm text-[var(--od-muted)]">
              Customers won&apos;t be able to pay until you reconnect.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={disconnect}
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--od-danger)] px-4 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-60"
              >
                {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
                Disconnect
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDisconnect(false)}
                disabled={pending}
                className="od-button-secondary px-4 py-2.5 text-sm"
              >
                Keep connected
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setError(null)
                setEditing(true)
              }}
              className="od-button-secondary px-4 py-2.5 text-sm"
            >
              Replace keys
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDisconnect(true)}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--od-muted)] transition-colors hover:text-[var(--od-danger)]"
            >
              Disconnect
            </button>
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {view.kind === 'rejected' && (
        <p role="alert" className={errorCls}>
          Razorpay stopped accepting your keys. Reconnect to keep selling.
        </p>
      )}

      {account !== 'yes' && (
        <section className="od-card p-5 sm:p-6">
          <p className={stepCls}>Step 1 of 3</p>
          <h2 className={headingCls}>Have a Razorpay account?</h2>
          {account === 'unknown' ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setAccount('yes')} className="od-button-primary px-4 py-2.5 text-sm">
                Yes, I have one
              </button>
              <button type="button" onClick={() => setAccount('no')} className="od-button-secondary px-4 py-2.5 text-sm">
                Not yet
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm leading-relaxed text-[var(--od-ink-2)]">
                Free to open. You can connect and test right away. Razorpay checks your business
                documents before you can take real money, usually within a few days.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <a
                  href="https://dashboard.razorpay.com/signup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="od-button-primary px-4 py-2.5 text-sm"
                >
                  Open a Razorpay account
                  <ExternalLink size={14} aria-hidden />
                </a>
                <button type="button" onClick={() => setAccount('yes')} className="od-button-secondary px-4 py-2.5 text-sm">
                  I&apos;ve opened my account
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {account === 'yes' && (
        <>
          <section className="od-card p-5 sm:p-6">
            <p className={stepCls}>Step 2 of 3</p>
            <h2 className={headingCls}>Copy your keys</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--od-ink-2)]">
              <li>
                Sign in at{' '}
                <a
                  href="https://dashboard.razorpay.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--od-brand-strong)] underline underline-offset-2"
                >
                  dashboard.razorpay.com
                </a>
                .
              </li>
              <li>
                Open <strong>Account &amp; Settings</strong> → <strong>API Keys</strong>.
              </li>
              <li>
                Tap <strong>Generate Key</strong>. Start in <strong>Test Mode</strong> to practise.
              </li>
            </ol>
            <p className={`${noteCls} mt-3`}>Razorpay shows the Key Secret only once. Copy it straight away.</p>
            <div className="mt-4">
              <KeysIllustration />
            </div>
          </section>

          <form onSubmit={connect} className="od-card space-y-4 p-5 sm:p-6">
            <div>
              <p className={stepCls}>Step 3 of 3</p>
              <h2 className={headingCls}>Paste them here</h2>
            </div>

            <label className="block">
              <span className={labelCls}>Key ID</span>
              <input
                value={keyId}
                onChange={(event) => setKeyId(event.target.value)}
                placeholder="rzp_test_…"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={pending}
                className={inputCls}
              />
              <KeyIdHint keyId={keyId} />
            </label>

            <div>
              <label htmlFor={`razorpay-secret-${listingId}`} className={labelCls}>
                Key Secret
              </label>
              <div className="relative">
                <input
                  id={`razorpay-secret-${listingId}`}
                  type={showSecret ? 'text' : 'password'}
                  value={keySecret}
                  onChange={(event) => setKeySecret(event.target.value)}
                  placeholder="Paste the Key Secret"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={pending}
                  className={`${inputCls} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((value) => !value)}
                  aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                  aria-pressed={showSecret}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--od-muted)] transition-colors hover:text-[var(--od-brand)]"
                >
                  {showSecret ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-[var(--od-muted)]">Stored encrypted. It is never shown again.</p>
            </div>

            {error && (
              <p role="alert" className={errorCls}>
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={pending} className="od-button-primary px-5 py-2.5 text-sm disabled:opacity-60">
                {pending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" aria-hidden />
                    Checking with Razorpay…
                  </>
                ) : (
                  'Connect'
                )}
              </button>
              {view.kind === 'connected' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setError(null)
                  }}
                  disabled={pending}
                  className="od-button-secondary px-5 py-2.5 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  )
}
