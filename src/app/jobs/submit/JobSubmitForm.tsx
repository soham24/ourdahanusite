'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CreditCard, ShieldCheck, Tag, CheckCircle, X, BadgePercent, Phone, MessageCircle } from 'lucide-react'
import { submitPaidJob, submitFreeJob } from '@/app/actions/jobs'
import PhoneInput from '@/components/PhoneInput'
import {
  attemptWithRetry,
  clearRecoveryDraft,
  persistRecoveryDraft,
  recoveryUrlFor,
  snapshotFormData,
  updateRecoveryDraft,
} from '@/lib/payment-retry'

const CATEGORIES = [
  'Agriculture', 'Healthcare', 'Education', 'Hospitality', 'Construction',
  'Retail', 'Transport', 'IT', 'Government', 'Manufacturing', 'Fishing & Seafood',
  'Domestic Help', 'Other',
]
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Daily Wage', 'Internship', 'Volunteer', 'Remote']

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
  basePrice: number
  currentPrice: number
  activeCoupons: CouponMeta[]
}

export default function JobSubmitForm({ userEmail, userName, basePrice, currentPrice, activeCoupons }: Props) {
  const router  = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ordering' | 'paying' | 'submitting' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const COUPON_META = Object.fromEntries(activeCoupons.map(c => [c.code, { label: c.label, finalPrice: c.finalPrice }]))

  const [couponInput, setCouponInput]     = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null)
  const [couponError, setCouponError]     = useState('')
  const [contactType, setContactType]     = useState<'both' | 'call' | 'whatsapp'>('both')

  const finalPrice = appliedCoupon && COUPON_META[appliedCoupon] != null
    ? COUPON_META[appliedCoupon].finalPrice
    : currentPrice
  const discount = currentPrice - finalPrice

  useEffect(() => {
    if (document.getElementById('razorpay-script')) { setScriptReady(true); return }
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
    if (COUPON_META[code] != null) {
      setAppliedCoupon(code)
      setCouponError('')
    } else {
      setAppliedCoupon(null)
      setCouponError('Invalid coupon code.')
    }
  }

  const removeCoupon = () => { setAppliedCoupon(null); setCouponInput(''); setCouponError('') }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg('')
    const form = formRef.current!
    if (!form.checkValidity()) { form.reportValidity(); return }

    const formSnapshot = new FormData(form)
    if (appliedCoupon) formSnapshot.set('coupon_used', appliedCoupon)

    // Free path (coupon = ₹0 or price is 0)
    if (finalPrice === 0) {
      setStatus('submitting')
      const result = await submitFreeJob(formSnapshot)
      if (result?.error) { setErrorMsg(result.error); setStatus('error') }
      else router.push('/jobs?submitted=1')
      return
    }

    if (!scriptReady || !window.Razorpay) {
      setErrorMsg('Payment gateway is loading — please try again in a moment.')
      return
    }

    try {
      setStatus('ordering')
      const orderRes = await fetch('/api/razorpay/create-job-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon: appliedCoupon || undefined }),
      })
      const orderData = await orderRes.json()

      if (!orderRes.ok || orderData.error) {
        setErrorMsg(orderData.error || 'Failed to initiate payment.')
        setStatus('error')
        return
      }

      setStatus('paying')
      formSnapshot.set('amount_paid', String(finalPrice))

      persistRecoveryDraft({
        orderId: orderData.orderId,
        flow: 'job',
        amountPaise: orderData.amount,
        fields: snapshotFormData(formSnapshot),
        returnTo: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })

      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'OurDahanu',
        description: `Job Posting — ₹${finalPrice}`,
        order_id: orderData.orderId,
        handler: async (response) => {
          setStatus('submitting')
          formSnapshot.set('razorpay_payment_id', response.razorpay_payment_id)
          formSnapshot.set('razorpay_order_id',   response.razorpay_order_id)
          formSnapshot.set('razorpay_signature',  response.razorpay_signature)

          updateRecoveryDraft(orderData.orderId, {
            fields: snapshotFormData(formSnapshot),
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })

          const result = await attemptWithRetry(() => submitPaidJob(formSnapshot))
          if (result?.error) {
            updateRecoveryDraft(orderData.orderId, { lastError: result.error })
            setErrorMsg(
              result.error +
              ` (Payment ID: ${response.razorpay_payment_id}). ` +
              `If the amount was debited, click here to recover: ${recoveryUrlFor(orderData.orderId)}`,
            )
            setStatus('error')
          } else {
            clearRecoveryDraft(orderData.orderId)
            router.push('/jobs?submitted=1')
          }
        },
        modal: { ondismiss: () => setStatus('idle') },
        prefill: { email: userEmail, name: userName },
        theme: { color: '#C4663A' },
      })
      rzp.open()
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  const busy = status === 'ordering' || status === 'paying' || status === 'submitting'
  const btnLabel = {
    idle:       finalPrice === 0 ? 'Post Job (Free)' : `Pay ₹${finalPrice} & Post Job`,
    ordering:   'Creating payment order…',
    paying:     'Waiting for payment…',
    submitting: 'Submitting…',
    error:      finalPrice === 0 ? 'Post Job (Free)' : `Pay ₹${finalPrice} & Post Job`,
  }[status]

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">

      {status === 'error' && errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{errorMsg}</div>
      )}

      {/* Job Title */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Job Title <span className="text-red-500">*</span>
        </label>
        <input type="text" name="title" required
          placeholder="e.g. Farm Supervisor, Staff Nurse, Shop Assistant"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
      </div>

      {/* Company */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Company / Employer Name <span className="text-red-500">*</span>
        </label>
        <input type="text" name="company" required
          placeholder="e.g. Dahanu Farms, XYZ Hospital"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
      </div>

      {/* Category + Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Category <span className="text-red-500">*</span>
          </label>
          <select name="category" required defaultValue=""
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm bg-white">
            <option value="" disabled>Select category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Job Type</label>
          <select name="type" defaultValue="Full-time"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm bg-white">
            {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Location + Salary + Positions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location</label>
          <input type="text" name="location"
            placeholder="e.g. Dahanu, Bordi"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Salary <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <input type="text" name="salary"
            placeholder="e.g. ₹15,000/mo"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            No. of Positions <span className="text-red-500">*</span>
          </label>
          <input type="number" name="positions" min="1" max="99" defaultValue="1" required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Job Description <span className="text-red-500">*</span>
        </label>
        <textarea name="description" required rows={5}
          placeholder="Describe the role, responsibilities, and what you're looking for..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm resize-none" />
      </div>

      {/* Requirements */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Requirements <span className="text-gray-400 font-normal text-xs">(optional)</span>
        </label>
        <textarea name="requirements" rows={3}
          placeholder="Qualifications, experience, skills needed..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm resize-none" />
      </div>

      {/* Contact */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">How to Apply</label>

        {/* Email */}
        <input type="email" name="contact_email"
          placeholder="Contact email (optional)"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />

        {/* Phone with +91 */}
        <PhoneInput name="contact_phone" placeholder="98765 43210" />

        {/* Contact type */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Candidates can contact via</p>
          <div className="flex gap-2 flex-wrap">
            {([
              { value: 'both',      label: 'Call & WhatsApp', icon: null },
              { value: 'call',      label: 'Call only',       icon: <Phone size={13} /> },
              { value: 'whatsapp',  label: 'WhatsApp only',   icon: <MessageCircle size={13} /> },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setContactType(opt.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                  contactType === opt.value
                    ? 'bg-brand text-bg border-brand'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
                }`}
              >
                {opt.icon}{opt.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="contact_phone_type" value={contactType} />
        </div>
      </div>

      {/* Coupon Section */}
      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Tag size={12} /> Have a coupon?
        </p>
        {appliedCoupon ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800 uppercase">{appliedCoupon}</p>
              <p className="text-xs text-green-600">{COUPON_META[appliedCoupon]?.label}</p>
            </div>
            <button type="button" onClick={removeCoupon} className="text-green-500 hover:text-green-700">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text" value={couponInput}
              onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyCoupon())}
              placeholder="Enter coupon code"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm font-mono uppercase"
            />
            <button type="button" onClick={applyCoupon}
              className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
              <BadgePercent size={14} /> Apply
            </button>
          </div>
        )}
        {couponError && <p className="text-red-500 text-xs mt-1.5">{couponError}</p>}
      </div>

      {/* Pricing Summary */}
      <div className="bg-surface-soft border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-ink text-sm">Job Posting Fee</span>
          <div className="text-right">
            {discount > 0 && (
              <span className="text-xs text-gray-400 line-through block">₹{currentPrice}</span>
            )}
            <span className="text-xl font-bold text-brand">
              {finalPrice === 0 ? 'FREE' : `₹${finalPrice}`}
            </span>
          </div>
        </div>
        {discount > 0 && (
          <p className="text-xs text-green-600 font-medium mb-1">You save ₹{discount}!</p>
        )}
        <div className="flex items-center gap-1.5 text-xs text-ink-2 mt-1">
          <ShieldCheck size={13} className="text-brand flex-shrink-0" />
          {finalPrice === 0
            ? 'Free with coupon · listing goes live after review'
            : 'Secure payment via Razorpay · UPI, Cards, Net Banking accepted'}
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">
          Original price ₹{basePrice} / job posting
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand-strong text-bg font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
          {busy
            ? <><Loader2 size={16} className="animate-spin" /> {btnLabel}</>
            : <><CreditCard size={16} /> {btnLabel}</>
          }
        </button>
        <Link href="/jobs"
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-semibold transition-colors text-center text-sm">
          Cancel
        </Link>
      </div>

      <p className="text-xs text-gray-400 text-center">
        By submitting, you confirm this is a genuine job opportunity in or around Dahanu.
        Your listing goes live after a quick review — usually within a few hours.
      </p>
    </form>
  )
}
