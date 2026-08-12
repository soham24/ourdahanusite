'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Tag, CheckCircle, X, BadgePercent,
  Calendar, Store, ArrowLeft, ShieldCheck, ShieldAlert,
} from 'lucide-react'
import { renewListing } from '@/app/actions/listings'
import {
  attemptWithRetry,
  clearRecoveryDraft,
  persistRecoveryDraft,
  readableReason,
  recoveryUrlFor,
  snapshotFormData,
  updateRecoveryDraft,
  type CapturedPaymentRecovery,
} from '@/lib/payment-retry'

interface RazorpayOptions {
  key: string; amount: number; currency: string; name: string
  description: string; order_id: string
  handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void
  modal: { ondismiss: () => void }
  prefill: { email: string; name: string }
  theme: { color: string }
}
declare global {
  interface Window { Razorpay: new (o: RazorpayOptions) => { open: () => void } }
}

interface CouponMeta { code: string; label: string; finalPrice: number }

interface Props {
  listingId:        string
  listingName:      string
  currentExpiresAt: string | null
  userEmail:        string
  userName:         string
  basePrice?:       number
  originalPrice?:   number
  activeCoupons?:   CouponMeta[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function RenewForm({
  listingId,
  listingName,
  currentExpiresAt,
  userEmail,
  userName,
  basePrice     = 210,
  originalPrice = 500,
  activeCoupons = [],
}: Props) {
  const router = useRouter()
  const [scriptReady, setScriptReady] = useState(
    // A `#razorpay-script` tag existing only means *some* component asked for
    // the script — the id is shared across every payment flow. The only proof
    // it is usable is the global it defines once loaded.
    () => typeof window !== 'undefined' && typeof window.Razorpay !== 'undefined',
  )
  const [status, setStatus]   = useState<'idle' | 'ordering' | 'paying' | 'submitting' | 'error' | 'recovery'>('idle')
  const [recovery, setRecovery] = useState<CapturedPaymentRecovery | null>(null)
  // Ref, not state: `ondismiss` must read the current value even when it
  // fires in the same tick as the payment handler.
  const capturedRef = useRef(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [couponInput, setCouponInput]     = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null)
  const [couponError, setCouponError]     = useState('')

  const COUPON_META = Object.fromEntries(
    activeCoupons.map(c => [c.code, { label: c.label, finalPrice: c.finalPrice }])
  )

  const finalPrice = appliedCoupon && COUPON_META[appliedCoupon]
    ? COUPON_META[appliedCoupon].finalPrice
    : basePrice
  const discount = basePrice - finalPrice

  // Compute what the new expiry will be after renewal
  const isExpired     = currentExpiresAt ? new Date(currentExpiresAt) < new Date() : false
  const base          = currentExpiresAt && !isExpired ? new Date(currentExpiresAt) : new Date()
  const newExpiry     = new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000)

  // Load Razorpay SDK
  useEffect(() => {
    if (typeof window.Razorpay !== 'undefined') return

    // A tag injected by a sibling flow may still be in flight — listen on it
    // rather than assuming its outcome, and don't inject a duplicate.
    const existing = document.getElementById('razorpay-script')
    if (existing) {
      const onLoad = () => setScriptReady(true)
      existing.addEventListener('load', onLoad)
      return () => existing.removeEventListener('load', onLoad)
    }

    const s = document.createElement('script')
    s.id = 'razorpay-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => setScriptReady(true)
    document.body.appendChild(s)
  }, [])

  const applyCoupon = () => {
    const code = couponInput.trim().toLowerCase()
    if (!code) return
    if (COUPON_META[code]) {
      setAppliedCoupon(code)
      setCouponError('')
    } else {
      setAppliedCoupon(null)
      setCouponError('Invalid coupon code. Please check and try again.')
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError('')
  }

  const handleRenew = async () => {
    setErrorMsg('')

    if (!scriptReady || !window.Razorpay) {
      setErrorMsg('Payment gateway is loading — please try again in a moment.')
      return
    }

    try {
      capturedRef.current = false
      setStatus('ordering')
      const orderRes = await fetch('/api/razorpay/create-listing-order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ coupon: appliedCoupon }),
      })
      const orderData = await orderRes.json()

      if (!orderRes.ok || orderData.error) {
        setErrorMsg(orderData.error || 'Failed to initiate payment. Please try again.')
        setStatus('error')
        return
      }

      const fd = new FormData()
      fd.set('coupon',      appliedCoupon ?? '')
      fd.set('amount_paid', String(orderData.finalAmountRupees))

      // Free coupon — skip Razorpay
      if (orderData.free) {
        setStatus('submitting')
        fd.set('razorpay_payment_id', 'free')
        fd.set('razorpay_order_id',   'free')
        fd.set('razorpay_signature',  'free')
        const result = await renewListing(listingId, fd)
        if (result?.error) { setErrorMsg(result.error); setStatus('error') }
        else                { router.push('/my-business?renewed=1') }
        return
      }

      setStatus('paying')

      persistRecoveryDraft({
        orderId: orderData.orderId,
        flow: 'renew',
        amountPaise: orderData.amount,
        fields: { ...snapshotFormData(fd), listing_id: listingId },
        returnTo: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })

      const rzp = new window.Razorpay({
        key:         orderData.keyId,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        'OurDahanu',
        description: `Listing Renewal — ${listingName}`,
        order_id:    orderData.orderId,
        handler: async (response) => {
          // First statement, before any state update, so `ondismiss` cannot
          // observe a window where money moved but this flag is unset.
          capturedRef.current = true
          setStatus('submitting')
          fd.set('razorpay_payment_id', response.razorpay_payment_id)
          fd.set('razorpay_order_id',   response.razorpay_order_id)
          fd.set('razorpay_signature',  response.razorpay_signature)

          updateRecoveryDraft(orderData.orderId, {
            fields: { ...snapshotFormData(fd), listing_id: listingId },
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })

          // Money is captured from here on — both failure paths go to the
          // recovery screen, never back to a pay button.
          const failAfterCapture = (reason: unknown) => {
            const message = readableReason(reason)
            updateRecoveryDraft(orderData.orderId, { lastError: message })
            setRecovery({
              razorpayOrderId: orderData.orderId,
              paymentId: response.razorpay_payment_id,
              message,
            })
            setStatus('recovery')
          }

          let result: { error?: string } | undefined
          try {
            result = await attemptWithRetry(() => renewListing(listingId, fd))
          } catch (err) {
            // attemptWithRetry rethrows when every attempt threw; this is an
            // SDK callback, so an escaping rejection would strand the payer.
            console.error('[RenewForm] renewal threw after capture:', err)
            failAfterCapture(err)
            return
          }

          if (result?.error) {
            failAfterCapture(result.error)
          } else {
            clearRecoveryDraft(orderData.orderId)
            router.push('/my-business?renewed=1')
          }
        },
        modal: {
          // Fired on a genuine cancel AND after a successful payment.
          ondismiss: () => {
            if (capturedRef.current) return
            setStatus('idle')
          },
        },
        prefill: { email: userEmail, name: userName },
        theme:   { color: '#C4663A' },
      })

      rzp.open()
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  const busy = ['ordering', 'paying', 'submitting'].includes(status)

  const btnLabel = {
    idle:       finalPrice === 0 ? 'Renew for Free 🎉' : `Pay ₹${finalPrice} & Renew`,
    ordering:   'Processing…',
    paying:     'Waiting for payment…',
    submitting: 'Renewing your listing…',
    error:      finalPrice === 0 ? 'Renew for Free 🎉' : `Pay ₹${finalPrice} & Renew`,
    // Unused — the recovery screen replaces the form once a payment lands.
    recovery:   '',
  }[status]

  // Payment captured but the renewal didn't save. Its own early return, so the
  // pay button cannot render once money has moved.
  if (status === 'recovery' && recovery) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 bg-amber-500 px-5 py-4 text-white">
            <ShieldAlert size={20} />
            <p className="text-base font-bold">Payment received</p>
          </div>
          <div className="space-y-3 px-5 py-5">
            <p className="text-sm leading-relaxed text-[var(--od-ink-2)]">
              Your payment went through, but we couldn&apos;t finish renewing {listingName}.
              Nothing is lost — we have your payment reference.
            </p>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
              {recovery.message}
            </p>
            <span className="block select-all rounded-lg border border-[var(--od-border)] bg-white px-3 py-2 font-mono text-xs text-[var(--od-ink)]">
              {recovery.paymentId}
            </span>
            <Link
              href={recoveryUrlFor(recovery.razorpayOrderId)}
              className="block w-full rounded-xl bg-[var(--od-brand)] py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[var(--od-brand-strong)]"
            >
              Finish my renewal →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/my-business"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand mb-6 transition-colors"
      >
        <ArrowLeft size={15} /> Back to My Business
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Renew Your Listing</h1>
        <p className="text-gray-500 mt-2">
          Extend your visibility on OurDahanu for another year.
        </p>
      </div>

      {/* Listing Info + Expiry Preview */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-surface-soft rounded-xl flex items-center justify-center flex-shrink-0">
            <Store size={20} className="text-brand" />
          </div>
          <div>
            <p className="font-bold text-gray-900">{listingName}</p>
            <p className="text-xs text-gray-500">Listing renewal — 1 year</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
              <Calendar size={11} /> Current Expiry
            </p>
            <p className={`font-semibold text-sm ${isExpired ? 'text-red-600' : 'text-gray-700'}`}>
              {currentExpiresAt ? formatDate(currentExpiresAt) : 'Not set'}
              {isExpired && <span className="ml-1 text-xs font-normal">(expired)</span>}
            </p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
              <Calendar size={11} /> New Expiry After Renewal
            </p>
            <p className="font-semibold text-sm text-green-700">
              {formatDate(newExpiry.toISOString())}
            </p>
          </div>
        </div>

        {isExpired && (
          <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ Your listing is currently offline. Renewing will bring it back online immediately.
          </p>
        )}
      </div>

      {/* Pricing */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-700 font-medium">Renewal price</span>
          <div className="flex items-baseline gap-2">
            {originalPrice !== basePrice && (
              <span className="text-gray-400 line-through text-sm">₹{originalPrice}</span>
            )}
            <span className="text-2xl font-bold text-gray-900">₹{finalPrice}</span>
            <span className="text-gray-500 text-sm">/year</span>
          </div>
        </div>
        {discount > 0 && (
          <p className="text-green-600 text-sm font-medium mb-1">You save ₹{discount}!</p>
        )}

        {/* Coupon */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <BadgePercent size={14} className="text-brand" />
            Have a coupon code?
          </p>

          {appliedCoupon ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-green-700 font-bold text-sm uppercase">{appliedCoupon}</span>
                {COUPON_META[appliedCoupon] && (
                  <span className="text-green-600 text-xs ml-2">— {COUPON_META[appliedCoupon].label}</span>
                )}
              </div>
              <button onClick={removeCoupon} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={e => setCouponInput(e.target.value.toLowerCase())}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyCoupon())}
                placeholder="Enter coupon code"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              <button
                type="button"
                onClick={applyCoupon}
                className="bg-surface-soft hover:bg-border text-brand font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
              >
                Apply
              </button>
            </div>
          )}
          {couponError && (
            <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
              <X size={11} /> {couponError}
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-4 flex items-start gap-2">
          <X size={15} className="mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Pay Button */}
      <button
        onClick={handleRenew}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-strong disabled:opacity-60 text-bg font-bold px-6 py-4 rounded-xl transition-colors text-base"
      >
        {busy && <Loader2 size={18} className="animate-spin" />}
        {btnLabel}
      </button>

      <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-400">
        <ShieldCheck size={13} />
        Secure payment via Razorpay ·{' '}
        {isExpired
          ? '1-year renewal from today'
          : 'Extended from current expiry date'}
      </div>
    </div>
  )
}
