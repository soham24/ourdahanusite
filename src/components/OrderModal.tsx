'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { X, ShoppingCart, Loader2, CheckCircle, Minus, Plus, ShieldCheck, ShieldAlert } from 'lucide-react'
import { placeOrder } from '@/app/actions/orders'
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
  prefill: { name: string; contact: string }
  theme: { color: string }
}

export interface OrderService {
  name: string
  price: number   // numeric rupees
  type?: 'service' | 'product'
}

interface Props {
  listing: { id: string; name: string; upi_id: string; whatsapp?: string | null }
  service: OrderService
  serviceIndex: number
  userEmail?: string
  userName?: string
  onClose: () => void
}

type Status = 'form' | 'ordering' | 'paying' | 'submitting' | 'done' | 'error' | 'recovery'


export default function OrderModal({ listing, service, serviceIndex, userEmail = '', userName = '', onClose }: Props) {
  const [status, setStatus] = useState<Status>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [scriptReady, setScriptReady] = useState(
    // A `#razorpay-script` tag existing only means *some* component asked for
    // the script — the id is shared with CheckoutForm, AppointmentBooking,
    // ListingSubmitForm and RenewForm. The only proof it is usable is the
    // global it defines once loaded.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => typeof window !== 'undefined' && typeof (window as any).Razorpay !== 'undefined',
  )
  const [quantity, setQuantity] = useState(1)
  const [buyerName, setBuyerName] = useState(userName)
  const [buyerPhone, setBuyerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [recovery, setRecovery] = useState<CapturedPaymentRecovery | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Whether Razorpay's `handler` has started for the in-flight attempt. A ref,
  // not state: `ondismiss` closes over the render scope it was created in and
  // must read the current value even when it fires in the same tick.
  const capturedRef = useRef(false)

  const total = service.price * quantity

  // Load Razorpay SDK
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).Razorpay !== 'undefined') return

    // A tag inherited from a sibling component may still be in flight, so
    // listen on the element that's already there instead of assuming its
    // outcome — and don't inject a second one.
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

  // Close on overlay click
  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handlePay = async () => {
    if (!buyerName.trim()) { setErrorMsg('Please enter your name.'); return }
    if (!buyerPhone.trim()) { setErrorMsg('Please enter your phone number.'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!scriptReady || !(window as any).Razorpay) {
      setErrorMsg('Payment gateway is loading — please try again.')
      return
    }
    setErrorMsg('')
    capturedRef.current = false

    try {
      setStatus('ordering')
      const orderRes = await fetch('/api/razorpay/create-product-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          serviceIndex,
          serviceName: service.name,
          quantity,
        }),
      })
      const orderData = await orderRes.json()

      if (!orderRes.ok || orderData.error) {
        setErrorMsg(orderData.error || 'Failed to initiate payment. Please try again.')
        setStatus('error')
        return
      }

      setStatus('paying')

      const baseFields: Record<string, string> = {
        listing_id: listing.id,
        service_name: orderData.serviceName || service.name,
        service_index: String(orderData.serviceIndex ?? serviceIndex),
        quantity: String(quantity),
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone.trim(),
        delivery_address: deliveryAddress.trim(),
        notes: notes.trim(),
      }

      persistRecoveryDraft({
        orderId: orderData.orderId,
        flow: 'order',
        amountPaise: orderData.amount,
        fields: baseFields,
        returnTo: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const RazorpayClass = (window as any).Razorpay as new (o: RazorpayOptions) => { open(): void }
      const rzp = new RazorpayClass({
        key:         orderData.keyId,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        listing.name,
        description: `${service.name} ×${quantity}`,
        order_id:    orderData.orderId,
        handler: async (response) => {
          // Before anything else, including the state update below, so
          // `ondismiss` can never observe a window where money has moved but
          // this flag hasn't been set.
          capturedRef.current = true
          setStatus('submitting')
          const fd = new FormData()
          for (const [key, value] of Object.entries(baseFields)) fd.set(key, value)
          fd.set('razorpay_payment_id',  response.razorpay_payment_id)
          fd.set('razorpay_order_id',    response.razorpay_order_id)
          fd.set('razorpay_signature',   response.razorpay_signature)

          updateRecoveryDraft(orderData.orderId, {
            fields: snapshotFormData(fd),
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })

          try {
            const result = await attemptWithRetry(() => placeOrder(fd))
            if (result.error) {
              // Money is captured. Never show a Pay button from here on.
              updateRecoveryDraft(orderData.orderId, { lastError: result.error })
              setRecovery({
                razorpayOrderId: orderData.orderId,
                paymentId: response.razorpay_payment_id,
                message: readableReason(result.error),
              })
              setStatus('recovery')
            } else {
              clearRecoveryDraft(orderData.orderId)
              setStatus('done')
            }
          } catch (err) {
            // Every retry threw, so attemptWithRetry rethrows instead of
            // returning {error}. This runs in an SDK callback, outside the
            // try/catch around handlePay, so without this the rejection
            // escapes and the buyer is stuck on "submitting" forever with
            // their money gone.
            console.error('[OrderModal] order save threw after capture:', err)
            const message = readableReason(err)
            updateRecoveryDraft(orderData.orderId, { lastError: message })
            setRecovery({
              razorpayOrderId: orderData.orderId,
              paymentId: response.razorpay_payment_id,
              message,
            })
            setStatus('recovery')
          }
        },
        modal: {
          // Razorpay fires this both when the buyer closes the sheet without
          // paying AND after a successful payment. Only unlock the form for a
          // genuine cancel — otherwise leave `status` where `handler` put it.
          ondismiss: () => {
            if (capturedRef.current) return
            setStatus('form')
          },
        },
        prefill: { name: buyerName, contact: buyerPhone },
        theme: { color: '#C4663A' },
      })

      rzp.open()
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  const busy = ['ordering', 'paying', 'submitting'].includes(status)

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-brand" />
            <span className="font-semibold text-gray-900 text-sm">
              {service.type === 'product' ? 'Order Product' : 'Book Service'}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Payment captured but the order didn't save. Deliberately a branch
            of its own: this state must never render the Pay button. */}
        {status === 'recovery' && recovery ? (
          <div className="px-5 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <ShieldAlert size={32} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Payment received</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Your money reached {listing.name} safely, but we couldn&apos;t finish saving the
              order. Nothing is lost — we have your payment reference.
            </p>
            <p className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs leading-relaxed text-amber-900">
              {recovery.message}
            </p>
            <span className="w-full select-all rounded-lg border border-border bg-white px-3 py-2 font-mono text-xs text-ink">
              {recovery.paymentId}
            </span>
            <Link
              href={recoveryUrlFor(recovery.razorpayOrderId)}
              className="mt-1 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong"
            >
              Finish my order →
            </Link>
            {listing.whatsapp && (
              <a
                href={`https://wa.me/${listing.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Hi! I paid for "${service.name}" on OurDahanu but the order didn't save. Payment ID: ${recovery.paymentId}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:border-brand/40 hover:text-brand"
              >
                Message {listing.name} on WhatsApp
              </a>
            )}
          </div>
        ) : status === 'done' ? (
          <div className="px-5 py-10 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle size={36} className="text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Order Placed!</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Your payment was successful. The seller will contact you on WhatsApp or phone to confirm.
            </p>
            {listing.whatsapp && (
              <a
                href={`https://wa.me/${listing.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I just placed an order for "${service.name}" on OurDahanu.`)}`}
                target="_blank" rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-600 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Chat on WhatsApp
              </a>
            )}
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600 mt-1">
              Close
            </button>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Service summary */}
            <div className="bg-surface-soft border border-border rounded-xl p-4">
              <p className="font-semibold text-ink text-sm">{service.name}</p>
              <p className="text-brand font-bold text-lg mt-0.5">₹{service.price.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-400 mt-0.5">from {listing.name}</p>
            </div>

            {/* Error */}
            {(status === 'error') && errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                {errorMsg}
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-brand hover:text-brand transition-colors disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <span className="text-base font-bold text-gray-900 w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(99, q + 1))}
                  className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-brand hover:text-brand transition-colors"
                >
                  <Plus size={14} />
                </button>
                <span className="ml-2 text-sm text-gray-500">= ₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Buyer name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={e => setBuyerName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={buyerPhone}
                onChange={e => setBuyerPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand"
              />
            </div>

            {/* Delivery address */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Delivery Address
                <span className="ml-1 font-normal text-gray-400">(if needed)</span>
              </label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="Street, Village, Pincode"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Special Instructions
                <span className="ml-1 font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any specific requirements, preferred time, etc."
                rows={2}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand resize-none"
              />
            </div>

            {/* Order total */}
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-lg font-bold text-ink">₹{total.toLocaleString('en-IN')}</span>
            </div>

            {/* Pay button */}
            <button
              type="button"
              onClick={handlePay}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-strong text-bg font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm"
            >
              {busy
                ? <><Loader2 size={15} className="animate-spin" />{
                    status === 'ordering' ? 'Preparing payment…' :
                    status === 'paying'   ? 'Waiting for payment…' :
                    'Placing order…'
                  }</>
                : <><ShoppingCart size={15} />Pay ₹{total.toLocaleString('en-IN')} & Place Order</>
              }
            </button>

            <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck size={11} className="text-brand" />
              Secure payment via Razorpay · UPI, Cards, Net Banking
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

