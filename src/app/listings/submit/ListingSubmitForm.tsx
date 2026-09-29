'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, CreditCard, ShieldCheck, Tag, CheckCircle,
  X, BadgePercent, ArrowLeft, ShieldAlert,
} from 'lucide-react'
import { submitPaidListing } from '@/app/actions/listings'
import ImageUploadField from '@/components/ImageUploadField'
import SubdomainInput from '@/components/SubdomainInput'
import PhoneInput from '@/components/PhoneInput'
import LocationPicker from '@/components/LocationPicker'
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
import { normalizeOptionalUrl } from '@/lib/url'
import { LISTING_CATEGORY_GROUPS, LISTING_CATEGORY_EMOJIS } from '@/lib/listing-category'
import { siteConfig } from '@/lib/site'

const PLAN_FEATURES = [
  `Your own profile page on ${siteConfig.name}`,
  'Your unique subdomain (yourname.ourdahanu.in)',
  'Phone, address & website display',
  'Customer reviews',
  'Photos',
  'Reach 30,000+ local community members',
]


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
  userEmail: string
  userName: string
  basePrice?: number
  originalPrice?: number
  activeCoupons?: CouponMeta[]
}

export default function ListingSubmitForm({
  userEmail,
  userName,
  basePrice = 210,
  originalPrice = 500,
  activeCoupons = [],
}: Props) {
  const router     = useRouter()
  const formRef    = useRef<HTMLFormElement>(null)
  const [scriptReady, setScriptReady] = useState(
    // A `#razorpay-script` tag existing only means *some* component asked for
    // the script — the id is shared across every payment flow. The only proof
    // it is usable is the global it defines once loaded.
    () => typeof window !== 'undefined' && typeof window.Razorpay !== 'undefined',
  )
  const [status, setStatus]    = useState<'idle' | 'ordering' | 'paying' | 'submitting' | 'error' | 'recovery'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [recovery, setRecovery] = useState<CapturedPaymentRecovery | null>(null)
  // Ref, not state: `ondismiss` must read the current value even when it
  // fires in the same tick as the payment handler.
  const capturedRef = useRef(false)

  // Build coupon lookup from props
  const COUPON_META = Object.fromEntries(activeCoupons.map(c => [c.code, { label: c.label, finalPrice: c.finalPrice }]))

  // Coupon state
  const [couponInput, setCouponInput]   = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null)
  const [couponError, setCouponError]   = useState('')

  const finalPrice = appliedCoupon && COUPON_META[appliedCoupon] ? COUPON_META[appliedCoupon].finalPrice : basePrice
  const discount   = basePrice - finalPrice

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

  const normalizeWebsiteField = () => {
    const form = formRef.current
    if (!form) return
    const websiteInput = form.elements.namedItem('website')
    if (websiteInput instanceof HTMLInputElement) {
      websiteInput.value = normalizeOptionalUrl(websiteInput.value)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg('')
    const form = formRef.current!
    normalizeWebsiteField()
    if (!form.checkValidity()) { form.reportValidity(); return }

    if (!scriptReady || !window.Razorpay) {
      setErrorMsg('Payment gateway is loading — please try again in a moment.')
      return
    }

    try {
      capturedRef.current = false
      setStatus('ordering')
      const orderRes = await fetch('/api/razorpay/create-listing-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon: appliedCoupon }),
      })
      const orderData = await orderRes.json()

      if (!orderRes.ok || orderData.error) {
        setErrorMsg(orderData.error || 'Failed to initiate payment. Please try again.')
        setStatus('error')
        return
      }

      const formSnapshot = new FormData(form)
      formSnapshot.set('coupon',      appliedCoupon ?? '')
      formSnapshot.set('amount_paid', String(orderData.finalAmountRupees))

      // Free coupon — skip Razorpay entirely
      if (orderData.free) {
        setStatus('submitting')
        formSnapshot.set('razorpay_payment_id', 'free')
        formSnapshot.set('razorpay_order_id',   'free')
        formSnapshot.set('razorpay_signature',  'free')
        const result = await submitPaidListing(formSnapshot)
        if (result?.error) {
          setErrorMsg(result.error)
          setStatus('error')
        } else {
          const bizName = encodeURIComponent(formSnapshot.get('name') as string || '')
          router.push(`/listings/submit?submitted=1&name=${bizName}`)
        }
        return
      }

      setStatus('paying')

      // Persist the draft before opening Razorpay. If the page reloads
      // mid-checkout we still know what to recreate.
      persistRecoveryDraft({
        orderId: orderData.orderId,
        flow: 'listing',
        amountPaise: orderData.amount,
        fields: snapshotFormData(formSnapshot),
        returnTo: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })

      const rzp = new window.Razorpay({
        key:         orderData.keyId,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        `${siteConfig.name}`,
        description: `Business Listing — ₹${orderData.finalAmountRupees}/year`,
        order_id:    orderData.orderId,
        handler: async (response) => {
          // First statement, before any state update, so `ondismiss` cannot
          // observe a window where money moved but this flag is unset.
          capturedRef.current = true
          setStatus('submitting')
          formSnapshot.set('razorpay_payment_id', response.razorpay_payment_id)
          formSnapshot.set('razorpay_order_id',   response.razorpay_order_id)
          formSnapshot.set('razorpay_signature',  response.razorpay_signature)

          // Update the draft with the captured payment IDs. Even if
          // the next call fails or this tab dies, the recovery page
          // can still finish the submission.
          updateRecoveryDraft(orderData.orderId, {
            fields: snapshotFormData(formSnapshot),
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })

          // Money is captured from here on. Both failure paths route to the
          // recovery screen, which links to /payments/recover rather than
          // printing the URL as unclickable text.
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
            result = await attemptWithRetry(() => submitPaidListing(formSnapshot))
          } catch (err) {
            // attemptWithRetry rethrows when every attempt threw. This is an
            // SDK callback, so an escaping rejection would strand the payer.
            console.error('[ListingSubmitForm] submit threw after capture:', err)
            failAfterCapture(err)
            return
          }

          if (result?.error) {
            failAfterCapture(result.error)
          } else {
            clearRecoveryDraft(orderData.orderId)
            const bizName = encodeURIComponent(formSnapshot.get('name') as string || '')
            router.push(`/listings/submit?submitted=1&name=${bizName}`)
          }
        },
        modal: {
          // Fired on a genuine cancel AND after a successful payment — only
          // unlock the form for the former.
          ondismiss: () => {
            if (capturedRef.current) return
            setStatus('idle')
          },
        },
        prefill:  { email: userEmail, name: userName },
        theme:    { color: '#C4663A' },
      })

      rzp.open()
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  const busy = ['ordering', 'paying', 'submitting'].includes(status)
  const btnLabel = {
    idle:       finalPrice === 0 ? 'Submit Listing for Free 🎉' : `Pay ₹${finalPrice} & Submit Listing`,
    ordering:   'Processing…',
    paying:     'Waiting for payment…',
    submitting: 'Submitting your listing…',
    error:      finalPrice === 0 ? 'Submit Listing for Free 🎉' : `Pay ₹${finalPrice} & Submit Listing`,
    // Unused — the recovery screen replaces the form entirely, so this button
    // is never rendered once a payment has been captured.
    recovery:   '',
  }[status]

  // Payment captured but the listing didn't save. Its own early return, so the
  // form — and its pay button — cannot render once money has moved.
  if (status === 'recovery' && recovery) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 bg-amber-500 px-5 py-4 text-white">
            <ShieldAlert size={20} />
            <p className="text-base font-bold">Payment received</p>
          </div>
          <div className="space-y-3 px-5 py-5">
            <p className="text-sm leading-relaxed text-[var(--od-ink-2)]">
              Your payment went through, but we couldn&apos;t finish saving the listing. Nothing
              is lost — we have your payment reference and the details you entered.
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
              Finish my listing →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/listings" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to Listings
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">List Your Business</h1>
        <p className="text-gray-500 mt-2">Reach 30,000+ potential customers in {siteConfig.town} and surrounding areas.</p>
      </div>

      {/* Pricing card */}
      <div className="mb-8 bg-gradient-to-br from-surface-soft to-border/30 border-2 border-brand rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tag size={15} className="text-brand" />
              <span className="text-xs font-bold text-brand uppercase tracking-wide">Launch Offer</span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-bold text-gray-900">₹{finalPrice}</span>
              <span className="text-sm text-gray-400">/ year</span>
              {discount > 0 && (
                <>
                  <span className="text-sm text-gray-400 line-through">₹{basePrice}</span>
                  <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    −₹{discount} off
                  </span>
                </>
              )}
              {discount === 0 && (
                <span className="text-sm text-gray-400 line-through">₹{originalPrice}</span>
              )}
            </div>
            <ul className="space-y-1.5">
              {PLAN_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-0 mb-6">
        {[
          { n: 1, label: 'Business Info' },
          { n: 2, label: 'Coupon' },
          { n: 3, label: 'Payment' },
        ].map((step, i) => (
          <div key={step.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i === 0 ? 'bg-brand text-bg' : 'bg-gray-100 text-gray-400'
              }`}>
                {step.n}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${i === 0 ? 'text-brand' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < 2 && (
              <div className="flex-1 h-0.5 bg-gray-200 mx-2 mb-4" />
            )}
          </div>
        ))}
      </div>

      <form ref={formRef} id="listing-form" onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="plan" value="standard" />

        {/* Error banner */}
        {status === 'error' && errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-6">
          {/* Business Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input type="text" id="name" name="name" required
              placeholder={`e.g. ${siteConfig.town} Beach Resort`}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea id="description" name="description" rows={4}
              placeholder="Describe your business, services offered, specialities..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm resize-none" />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            <select id="category" name="category" required defaultValue=""
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm bg-white">
              <option value="" disabled>Select a category</option>
              {LISTING_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={`${group.icon}  ${group.label}`}>
                  {group.categories.map((c) => (
                    <option key={c} value={c}>
                      {(LISTING_CATEGORY_EMOJIS[c] ?? '🏪') + '  ' + c}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Phone + WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
              <PhoneInput name="phone" placeholder="98765 43210" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp Number
                </span>
              </label>
              <PhoneInput name="whatsapp" placeholder="98765 43210" />
            </div>
          </div>

          {/* Website */}
          <div>
            <label htmlFor="website" className="block text-sm font-semibold text-gray-700 mb-1.5">Website</label>
            <input type="url" id="website" name="website"
              onBlur={e => { e.target.value = normalizeOptionalUrl(e.target.value) }}
              placeholder="https://yourbusiness.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
          </div>

          {/* Address + Map Pin */}
          <div>
            <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
            <input type="text" id="address" name="address"
              placeholder={`e.g. Main Market, ${siteConfig.town} Road, Palghar - 401602`}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm mb-3" />
            <LocationPicker />
          </div>

          <SubdomainInput />

          {/* UPI ID — required for receiving payments */}
          <div>
            <label htmlFor="upi_id" className="block text-sm font-semibold text-gray-700 mb-1.5">
              UPI ID <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-gray-400 text-xs">(customers pay you directly)</span>
            </label>
            <input type="text" id="upi_id" name="upi_id" required
              placeholder="yourname@upi  or  9876543210@paytm"
              pattern="[a-zA-Z0-9._\-]+@[a-zA-Z0-9]+"
              title="Enter a valid UPI ID (e.g. name@bank or number@paytm)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
            <p className="mt-1 text-xs text-gray-400">
              Orders from customers will be paid to this UPI ID.
            </p>
          </div>

          <ImageUploadField name="image_url" label="Business Photo (optional)" bucket="uploads" />
        </div>

        {/* ── Coupon Code ────────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <BadgePercent size={17} className="text-brand" />
            <span className="font-semibold text-gray-800 text-sm">Have a coupon code?</span>
          </div>

          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                <CheckCircle size={15} className="text-green-500" />
                {COUPON_META[appliedCoupon].label}
              </div>
              <button type="button" onClick={removeCoupon}
                className="text-gray-400 hover:text-red-500 transition-colors ml-3">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={e => { setCouponInput(e.target.value); setCouponError('') }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyCoupon())}
                placeholder="Enter coupon code"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm"
              />
              <button type="button" onClick={applyCoupon}
                className="px-5 py-2.5 bg-brand text-bg text-sm font-semibold rounded-xl hover:bg-brand-strong transition-colors">
                Apply
              </button>
            </div>
          )}

          {couponError && (
            <p className="mt-2 text-red-600 text-xs flex items-center gap-1">
              <X size={12} /> {couponError}
            </p>
          )}
        </div>

        {/* ── Order Summary ──────────────────────────────────────────────────── */}
        <div className="bg-surface-soft border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-ink text-sm mb-3">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Business Listing (1 year)</span>
              <span>₹{basePrice}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Coupon discount</span>
                <span>−₹{discount}</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between font-bold text-ink text-base">
              <span>Total</span>
              <span>₹{finalPrice}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-2 mt-3">
            <ShieldCheck size={13} className="text-brand flex-shrink-0" />
            Secure payment via Razorpay · UPI, Cards, Net Banking accepted
          </div>
        </div>

        {/* Submit button */}
        <button type="submit" disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-strong text-bg font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60 text-base">
          {busy
            ? <><Loader2 size={16} className="animate-spin" />{btnLabel}</>
            : <><CreditCard size={16} />{btnLabel}</>
          }
        </button>

        <p className="text-xs text-gray-400 text-center">
          By paying, you confirm this is a genuine business in or around {siteConfig.town}.
          Your listing goes live after review — usually within 48 hours.
        </p>
      </form>
    </div>
  )
}
