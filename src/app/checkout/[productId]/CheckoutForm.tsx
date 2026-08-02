'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle,
  Copy,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Package,
  ShieldCheck,
  Wrench,
} from 'lucide-react'

import { placeMarketplaceOrder } from '@/app/actions/marketplace-orders'
import {
  attemptWithRetry,
  clearRecoveryDraft,
  persistRecoveryDraft,
  recoveryUrlFor,
  snapshotFormData,
  updateRecoveryDraft,
} from '@/lib/payment-retry'

export interface CheckoutFormProps {
  product: {
    id: string
    name: string
    pricePaise: number
    quantityInStock: number | null
    type: 'product' | 'service'
    imageUrl: string | null
  }
  listing: { id: string; name: string; whatsapp: string | null }
  businessUrl: string
  buyerName: string
  buyerPhone: string
  buyerEmail: string
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (r: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal: { ondismiss: () => void }
  prefill: { name: string; contact: string; email?: string }
  theme: { color: string }
}

type Status = 'idle' | 'ordering' | 'paying' | 'submitting' | 'done' | 'recovery' | 'error'

interface DoneInfo { orderId: string }
interface RecoveryInfo { razorpayOrderId: string; paymentId: string; message: string }

const inputCls =
  'w-full rounded-xl border border-[var(--od-border)] px-3.5 py-2.5 text-sm text-[var(--od-ink)] focus:border-[var(--od-brand)] focus:outline-none disabled:bg-[var(--color-surface-soft)]'
const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--od-muted)]'

export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

/** Ten digits after stripping separators — matches the previous BuyButton rule. */
export function isValidPhone(raw: string): boolean {
  return /^\d{10}$/.test(raw.replace(/\D/g, '').slice(-10))
}

export default function CheckoutForm({
  product,
  listing,
  businessUrl,
  buyerName: initialName,
  buyerPhone: initialPhone,
  buyerEmail,
}: CheckoutFormProps) {
  const [quantity, setQuantity] = useState(1)
  const [buyerName, setBuyerName] = useState(initialName)
  const [buyerPhone, setBuyerPhone] = useState(initialPhone)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(!initialName || !isValidPhone(initialPhone))
  const [notesOpen, setNotesOpen] = useState(false)
  const [fieldError, setFieldError] = useState<{ field: 'name' | 'phone'; message: string } | null>(null)

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [done, setDone] = useState<DoneInfo | null>(null)
  const [recovery, setRecovery] = useState<RecoveryInfo | null>(null)
  const [scriptReady, setScriptReady] = useState(
    () => typeof document !== 'undefined' && document.getElementById('razorpay-script') !== null,
  )
  const [copied, setCopied] = useState(false)

  const busy = status === 'ordering' || status === 'paying' || status === 'submitting'

  const isService = product.type === 'service'
  const maxQuantity = product.quantityInStock ?? 99
  const totalPaise = product.pricePaise * quantity

  useEffect(() => {
    if (document.getElementById('razorpay-script')) return
    const s = document.createElement('script')
    s.id = 'razorpay-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => setScriptReady(true)
    document.body.appendChild(s)
  }, [])

  const handlePay = async () => {
    if (!buyerName.trim()) {
      setFieldError({ field: 'name', message: 'Please enter your name.' })
      setDetailsOpen(true)
      return
    }
    if (!isValidPhone(buyerPhone)) {
      setFieldError({ field: 'phone', message: 'Enter a valid 10-digit phone number.' })
      setDetailsOpen(true)
      return
    }
    setFieldError(null)
    setError('')

    try {
      setStatus('ordering')
      const orderRes = await fetch('/api/razorpay/create-marketplace-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity }),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok || orderData.error) {
        setError(orderData.error || 'Could not start the payment. Please try again.')
        setStatus('error')
        return
      }

      setStatus('paying')

      const baseFields: Record<string, string> = {
        product_id: product.id,
        quantity: String(quantity),
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone.trim(),
        delivery_address: deliveryAddress.trim(),
        notes: notes.trim(),
      }

      persistRecoveryDraft({
        orderId: orderData.orderId,
        flow: 'marketplace',
        amountPaise: orderData.amount,
        fields: baseFields,
        returnTo: window.location.pathname,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Razorpay = (window as any).Razorpay as new (o: RazorpayOptions) => { open: () => void }

      new Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: orderData.listingName || listing.name,
        description: `${product.name} ×${quantity}`,
        order_id: orderData.orderId,
        handler: async (response) => {
          setStatus('submitting')
          const fd = new FormData()
          for (const [key, value] of Object.entries(baseFields)) fd.set(key, value)
          fd.set('razorpay_order_id', response.razorpay_order_id)
          fd.set('razorpay_payment_id', response.razorpay_payment_id)
          fd.set('razorpay_signature', response.razorpay_signature)

          updateRecoveryDraft(orderData.orderId, {
            fields: snapshotFormData(fd),
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })

          const result = await attemptWithRetry(() => placeMarketplaceOrder(fd))
          if (result.error) {
            // Money has been captured. Never show a Pay button from here on.
            updateRecoveryDraft(orderData.orderId, { lastError: result.error })
            setRecovery({
              razorpayOrderId: orderData.orderId,
              paymentId: response.razorpay_payment_id,
              message: result.error,
            })
            setStatus('recovery')
          } else {
            clearRecoveryDraft(orderData.orderId)
            setDone({ orderId: result.orderId ?? orderData.orderId })
            setStatus('done')
          }
        },
        modal: {
          // Buyer closed Razorpay without paying — unlock the form.
          ondismiss: () => setStatus('idle'),
        },
        prefill: { name: buyerName, contact: buyerPhone, email: buyerEmail },
        theme: { color: '#C4663A' },
      }).open()
    } catch (e) {
      console.error('[CheckoutForm] payment error:', e)
      setError('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'done' && done) {
    const reference = done.orderId.replace(/-/g, '').slice(0, 8).toUpperCase()
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center gap-4 pt-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(19,138,75,0.12)]">
          <CheckCircle size={34} className="text-[var(--od-success)]" aria-hidden />
        </span>
        <h1 className="font-display text-2xl">Order placed</h1>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--od-muted)]">
          {listing.name} has been notified and will contact you to confirm.
        </p>

        <div className="w-full space-y-2 rounded-[14px] border border-[var(--od-border)] bg-white p-4 text-left">
          <div className="flex justify-between text-[13px]">
            <span className="text-[var(--od-muted)]">Reference</span>
            <span className="font-mono font-bold text-[var(--od-ink)]">{reference}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[var(--od-muted)]">
              {product.name} ×{quantity}
            </span>
            <span className="font-bold text-[var(--od-ink)]">{formatInr(totalPaise)}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[var(--od-muted)]">Paid to</span>
            <span className="font-bold text-[var(--od-ink)]">{listing.name}</span>
          </div>
        </div>

        <div className="mt-auto w-full space-y-2 pb-4">
          <Link
            href={`/account/orders/${done.orderId}`}
            className="od-button-primary w-full py-3 text-sm"
          >
            View my order
          </Link>
          <Link href={businessUrl} className="od-button-secondary w-full py-3 text-sm">
            Back to {listing.name}
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'recovery' && recovery) {
    const waHref = listing.whatsapp
      ? `https://wa.me/${listing.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
          `Hi ${listing.name}, I paid for ${product.name} ×${quantity} (${formatInr(totalPaise)}) but the order did not save. My payment reference is ${recovery.paymentId}.`,
        )}`
      : null

    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center gap-4 pt-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(200,136,30,0.14)] text-2xl font-black text-[var(--od-gold)]">
          !
        </span>
        <h1 className="font-display text-2xl">Payment received</h1>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--od-muted)]">
          Your money reached {listing.name} safely, but we couldn’t finish saving the order.
        </p>

        <div className="w-full rounded-[14px] border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] p-4 text-left">
          <p className="text-[13px] leading-relaxed text-[var(--od-ink-2)]">
            Nothing is lost — we’ve kept your payment reference. Tap below and we’ll finish it.
          </p>
          <code className="mt-2 block select-all rounded-lg border border-[var(--od-border)] bg-white px-3 py-2 font-mono text-[13px] font-bold text-[var(--od-ink)]">
            {recovery.paymentId}
          </code>
        </div>

        <div className="mt-auto w-full space-y-2 pb-4">
          <Link
            href={recoveryUrlFor(recovery.razorpayOrderId)}
            className="od-button-primary w-full py-3 text-sm"
          >
            Finish my order →
          </Link>
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                navigator.clipboard?.writeText(recovery.paymentId).then(
                  () => setCopied(true),
                  () => undefined,
                )
              }}
              className="od-button-secondary flex w-full items-center justify-center gap-1.5 py-3 text-sm"
            >
              <Copy size={14} aria-hidden />
              {copied ? 'Reference copied' : 'Copy reference & WhatsApp seller'}
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-3">
      {/* Product strip */}
      <div className="flex items-center gap-3 rounded-[14px] border border-[var(--od-border)] bg-[var(--color-surface-soft)] p-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            aria-hidden
            className="h-12 w-12 shrink-0 rounded-[10px] object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[#fdf7f0] text-[#c4a990]">
            {isService ? <Wrench size={20} aria-hidden /> : <Package size={20} aria-hidden />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-[var(--od-ink)]">{product.name}</p>
          <p className="truncate text-[11px] text-[var(--od-muted)]">{listing.name}</p>
        </div>
        <p className="shrink-0 text-base font-extrabold text-[var(--od-brand)]">
          {formatInr(product.pricePaise)}
        </p>
      </div>

      {/* Quantity */}
      <div>
        <span className={labelCls}>Quantity</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || busy}
            aria-label="Decrease quantity"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--od-border)] text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)] disabled:opacity-40"
          >
            <Minus size={14} aria-hidden />
          </button>
          <span className="w-6 text-center text-base font-bold tabular-nums text-[var(--od-ink)]">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            disabled={quantity >= maxQuantity || busy}
            aria-label="Increase quantity"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--od-border)] text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)] disabled:opacity-40"
          >
            <Plus size={14} aria-hidden />
          </button>
          {product.quantityInStock !== null && (
            <span className="ml-auto text-xs text-[var(--od-muted)]">
              {product.quantityInStock} available
            </span>
          )}
        </div>
      </div>

      {/* Your details — collapsed, because a signed-in buyer's are already known */}
      <div>
        <span className={labelCls}>Your details</span>
        {detailsOpen ? (
          <div className="space-y-2.5">
            <div>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                disabled={busy}
                autoComplete="name"
                placeholder="Full name"
                aria-label="Your name"
                aria-invalid={fieldError?.field === 'name'}
                aria-describedby={fieldError?.field === 'name' ? 'name-error' : undefined}
                className={inputCls}
              />
              {fieldError?.field === 'name' && (
                <p
                  id="name-error"
                  role="alert"
                  className="mt-1 text-xs font-semibold text-[var(--color-danger-strong,#a33)]"
                >
                  {fieldError.message}
                </p>
              )}
            </div>
            <div>
              <input
                type="tel"
                inputMode="numeric"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                disabled={busy}
                autoComplete="tel"
                placeholder="10-digit mobile number"
                aria-label="Phone number"
                aria-invalid={fieldError?.field === 'phone'}
                aria-describedby={fieldError?.field === 'phone' ? 'phone-error' : undefined}
                className={inputCls}
              />
              {fieldError?.field === 'phone' && (
                <p
                  id="phone-error"
                  role="alert"
                  className="mt-1 text-xs font-semibold text-[var(--color-danger-strong,#a33)]"
                >
                  {fieldError.message}
                </p>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--od-border)] bg-white px-3.5 py-2.5 text-left transition-colors hover:border-[var(--od-brand)]"
          >
            <span className="min-w-0 truncate text-sm text-[var(--od-ink-2)]">
              {buyerName} · {buyerPhone}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--od-brand)]">
              <Pencil size={11} aria-hidden /> Edit
            </span>
          </button>
        )}
      </div>

      {/* Delivery — products only */}
      {!isService && (
        <div>
          <span className={labelCls}>Deliver to</span>
          <input
            type="text"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            disabled={busy}
            autoComplete="street-address"
            placeholder="Street, Village, Pincode"
            aria-label="Delivery address"
            className={inputCls}
          />
        </div>
      )}

      {/* Optional note */}
      {notesOpen ? (
        <div>
          <span className={labelCls}>Note for the seller</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
            rows={2}
            placeholder="Preferred time, size, colour…"
            aria-label="Note for the seller"
            className={`${inputCls} resize-none`}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--od-border)] px-3.5 py-2.5 text-left text-sm text-[var(--od-muted)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)]"
        >
          <span>Add a note for the seller</span>
          <span className="text-[11px] font-bold text-[var(--od-brand)]">Add</span>
        </button>
      )}

      <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[var(--color-success-strong)]">
        <ShieldCheck size={12} className="text-[var(--od-success)]" aria-hidden />
        Payment goes straight to {listing.name}
      </p>

      {status === 'error' && error && (
        <div className="rounded-xl border border-[rgba(200,60,40,0.25)] bg-[rgba(200,60,40,0.06)] px-4 py-3 text-sm text-[var(--od-ink-2)]">
          {error}
        </div>
      )}

      {/* Sticky footer */}
      <div className="sticky bottom-0 mt-auto -mx-4 flex items-center gap-3 border-t border-[var(--od-border)] bg-white px-4 py-3">
        <span>
          <span className="block text-[10px] font-semibold text-[var(--od-muted)]">Total</span>
          <span className="block text-lg font-extrabold tabular-nums text-[var(--od-ink)]">
            {formatInr(totalPaise)}
          </span>
        </span>
        <button
          type="button"
          onClick={handlePay}
          disabled={busy || !scriptReady}
          className="od-button-primary flex flex-1 items-center justify-center gap-2 py-3 text-sm disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden />
              {status === 'ordering' && 'Opening payment…'}
              {status === 'paying' && 'Waiting for payment…'}
              {status === 'submitting' && 'Finalising order…'}
            </>
          ) : scriptReady ? (
            <>Pay {formatInr(totalPaise)}</>
          ) : (
            <>Loading payment…</>
          )}
        </button>
      </div>
    </div>
  )
}
