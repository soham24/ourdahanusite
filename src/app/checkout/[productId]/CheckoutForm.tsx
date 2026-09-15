'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { firstAvailableOptionId, isAvailable, orderLineLabel } from '@/lib/catalog/catalog'
import type { CatalogOption } from '@/lib/catalog/types'
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
    pricePaise: number | null
    quantityInStock: number | null
    type: 'product' | 'service'
    imageUrl: string | null
    /** When present the buyer picks one; its price and stock apply. */
    options: CatalogOption[]
  }
  listing: { id: string; name: string; whatsapp: string | null }
  businessUrl: string
  buyerName: string
  buyerPhone: string
  buyerEmail: string
  /** The business is on Razorpay test keys: this is a practice purchase. */
  testMode: boolean
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

interface DoneInfo { orderId: string; amountPaise?: number }
interface RecoveryInfo { razorpayOrderId: string; paymentId: string; message: string }

const inputCls =
  'w-full rounded-xl border border-[var(--od-border)] px-3.5 py-2.5 text-sm text-[var(--od-ink)] focus:border-[var(--od-brand)] focus:outline-none disabled:bg-[var(--color-surface-soft)]'
const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--od-muted)]'

export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

const GENERIC_RECOVERY_REASON =
  'We could not confirm the exact reason, but your payment is safe and we have your reference.'
const MAX_RECOVERY_MESSAGE_LENGTH = 180

/**
 * Both `placeMarketplaceOrder`'s returned `{ error }` string and a thrown
 * exception's `message` end up shown directly to the buyer on the recovery
 * screen. Neither is validated server-side for length or shape, so trim,
 * cap, and fall back to a generic sentence for anything empty or garbled
 * rather than rendering raw/oversized text in the UI.
 */
export function sanitizeRecoveryMessage(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return GENERIC_RECOVERY_REASON
  return trimmed.length > MAX_RECOVERY_MESSAGE_LENGTH
    ? `${trimmed.slice(0, MAX_RECOVERY_MESSAGE_LENGTH).trim()}…`
    : trimmed
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
  testMode,
}: CheckoutFormProps) {
  const [quantity, setQuantity] = useState(1)
  const [chosenOptionId, setChosenOptionId] = useState<string | null>(null)
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
    // A `#razorpay-script` tag existing in the DOM only means *some*
    // component asked for the script — possibly one still loading, or one
    // that already failed. The only signal that Razorpay is actually usable
    // is the global it sets once its own script finishes executing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => typeof window !== 'undefined' && typeof (window as any).Razorpay !== 'undefined',
  )
  const [scriptError, setScriptError] = useState(false)
  const [copied, setCopied] = useState(false)

  // Tracks whether Razorpay's `handler` has started for the in-flight
  // attempt. A ref (not state) because `ondismiss` closes over the render
  // scope it was created in — it needs to read the *current* value even if
  // it fires in the same tick as `handler`, before React would ever commit
  // a state update.
  const capturedRef = useRef(false)

  const busy = status === 'ordering' || status === 'paying' || status === 'submitting'

  const router = useRouter()
  const isService = product.type === 'service'
  // A choice that has since sold out (after a reload) falls back to the first option still available.
  const selectedOption =
    product.options.find((option) => option.id === chosenOptionId && isAvailable(option.quantity_in_stock)) ??
    product.options.find((option) => option.id === firstAvailableOptionId(product.options)) ??
    null
  const optionLabel = selectedOption?.label ?? null
  const unitPricePaise = selectedOption?.price_paise ?? product.pricePaise ?? 0
  const stockLimit = selectedOption ? selectedOption.quantity_in_stock : product.quantityInStock
  const maxQuantity = Math.max(1, stockLimit ?? 99)
  const orderQuantity = Math.min(quantity, maxQuantity)
  const totalPaise = unitPricePaise * orderQuantity

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).Razorpay !== 'undefined') {
      // The inherited tag (or our own from a previous mount) already
      // finished loading successfully before this effect ran. `scriptReady`'s
      // initial state is computed with this exact check, so it's already
      // `true` — no `load` event will ever fire again for us to catch, and
      // there's nothing left to subscribe to.
      return
    }

    const existing = document.getElementById('razorpay-script')
    if (existing) {
      // `#razorpay-script` is a shared id: AppointmentBooking,
      // ListingSubmitForm and RenewForm all inject the same tag onto
      // `document.body`, which survives client-side navigation into this
      // route. It may still be mid-flight, so listen on the element that's
      // actually there instead of assuming its outcome — and don't create a
      // second tag.
      const onLoad = () => setScriptReady(true)
      const onError = () => setScriptError(true)
      existing.addEventListener('load', onLoad)
      existing.addEventListener('error', onError)
      return () => {
        existing.removeEventListener('load', onLoad)
        existing.removeEventListener('error', onError)
      }
    }

    const s = document.createElement('script')
    s.id = 'razorpay-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => setScriptReady(true)
    s.onerror = () => setScriptError(true)
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
    capturedRef.current = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).Razorpay === 'undefined') {
      // The script tag may exist (another component on this page injected
      // it) without having finished loading yet — `scriptReady` can be
      // initialised `true` from that tag's mere presence. Re-check the
      // real global right before we'd create a server-side order so we
      // never spend a payment_intents row / order on an attempt that can't
      // possibly open the checkout modal.
      setError('Payment is still loading. Please try again in a moment.')
      setStatus('error')
      return
    }

    try {
      setStatus('ordering')
      const orderRes = await fetch('/api/razorpay/create-marketplace-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, optionId: selectedOption?.id, quantity: orderQuantity }),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok || orderData.error) {
        setError(orderData.error || 'Could not start the payment. Please try again.')
        setStatus('error')
        // Stock or options changed since the page loaded: fetch them again.
        if (orderData.code === 'option_sold_out' || orderData.code === 'option_unavailable') {
          router.refresh()
        }
        return
      }

      setStatus('paying')

      const baseFields: Record<string, string> = {
        product_id: product.id,
        quantity: String(orderQuantity),
        option_id: selectedOption?.id ?? '',
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
        description: orderLineLabel(product.name, optionLabel, orderQuantity),
        order_id: orderData.orderId,
        handler: async (response) => {
          // Set before anything else — including before the state update on
          // the next line — so `ondismiss` (which Razorpay also fires once
          // it closes its own modal after a successful payment) can never
          // observe a window where capture happened but this flag doesn't
          // reflect it yet.
          capturedRef.current = true
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

          try {
            const result = await attemptWithRetry(() => placeMarketplaceOrder(fd))
            if (result.error) {
              // Money has been captured. Never show a Pay button from here on.
              updateRecoveryDraft(orderData.orderId, { lastError: result.error })
              setRecovery({
                razorpayOrderId: orderData.orderId,
                paymentId: response.razorpay_payment_id,
                message: sanitizeRecoveryMessage(result.error),
              })
              setStatus('recovery')
            } else {
              clearRecoveryDraft(orderData.orderId)
              // orderData.amount is the authoritative paise figure the
              // server actually created the Razorpay order for (computed
              // from the live DB price). totalPaise is a client-side
              // number derived from a price that may have been cached
              // before a seller edit — never let the receipt show that
              // instead of what was actually charged.
              setDone({ orderId: result.orderId ?? orderData.orderId, amountPaise: orderData.amount })
              setStatus('done')
            }
          } catch (err) {
            // Every retry attempt threw (a real server exception or a
            // rejected server action) — attemptWithRetry rethrows in that
            // case instead of returning {error}. Money is already captured,
            // so route through the exact same recovery path a returned
            // {error} would use rather than leaving `status` stuck at
            // 'submitting' forever.
            console.error('[CheckoutForm] order save threw after capture:', err)
            const message =
              err instanceof Error && err.message
                ? err.message
                : 'We could not confirm your order after payment. Please use the link below.'
            updateRecoveryDraft(orderData.orderId, { lastError: message })
            setRecovery({
              razorpayOrderId: orderData.orderId,
              paymentId: response.razorpay_payment_id,
              message: sanitizeRecoveryMessage(message),
            })
            setStatus('recovery')
          }
        },
        modal: {
          // Razorpay fires this both when the buyer closes the modal
          // without paying AND after a successful payment (it closes its
          // own modal once `handler` starts running). Only unlock the form
          // for a genuine cancel — if capture already started, leave
          // `status` exactly where `handler` put it (submitting/recovery/done).
          ondismiss: () => {
            if (capturedRef.current) return
            setStatus('idle')
          },
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
              {orderLineLabel(product.name, optionLabel, orderQuantity)}
            </span>
            <span className="font-bold text-[var(--od-ink)]">
              {formatInr(done.amountPaise ?? totalPaise)}
            </span>
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
          `Hi ${listing.name}, I paid for ${orderLineLabel(product.name, optionLabel, orderQuantity)} (${formatInr(totalPaise)}) but the order did not save. My payment reference is ${recovery.paymentId}.`,
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
        <p className="max-w-xs text-xs leading-relaxed text-[var(--od-muted)]">
          {recovery.message}
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
          {formatInr(unitPricePaise)}
        </p>
      </div>

      {product.options.length > 0 && (
        <fieldset>
          <legend className={labelCls}>Choose an option</legend>
          <div className="space-y-2">
            {product.options.map((option) => {
              const available = isAvailable(option.quantity_in_stock)
              const checked = selectedOption?.id === option.id
              return (
                <label
                  key={option.id}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                    checked
                      ? 'border-[var(--od-brand)] bg-[rgba(192,88,46,0.06)]'
                      : 'border-[var(--od-border)] bg-white'
                  } ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="option"
                      value={option.id}
                      checked={checked}
                      disabled={!available || busy}
                      onChange={() => {
                        setChosenOptionId(option.id)
                        setQuantity(1)
                      }}
                      className="h-4 w-4 accent-[var(--od-brand)]"
                    />
                    <span className="font-semibold text-[var(--od-ink)]">{option.label}</span>
                  </span>
                  <span
                    className={available ? 'font-bold text-[var(--od-ink)]' : 'text-xs font-semibold text-[var(--od-muted)]'}
                  >
                    {available ? formatInr(option.price_paise) : 'Sold out'}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      {/* Quantity */}
      <div>
        <span className={labelCls}>Quantity</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, orderQuantity - 1))}
            disabled={orderQuantity <= 1 || busy}
            aria-label="Decrease quantity"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--od-border)] text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)] disabled:opacity-40"
          >
            <Minus size={14} aria-hidden />
          </button>
          <span className="w-6 text-center text-base font-bold tabular-nums text-[var(--od-ink)]">
            {orderQuantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(Math.min(maxQuantity, orderQuantity + 1))}
            disabled={orderQuantity >= maxQuantity || busy}
            aria-label="Increase quantity"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--od-border)] text-[var(--od-ink-2)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)] disabled:opacity-40"
          >
            <Plus size={14} aria-hidden />
          </button>
          {stockLimit !== null && (
            <span className="ml-auto text-xs text-[var(--od-muted)]">{stockLimit} available</span>
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

      {testMode && (
        <p
          role="note"
          className="rounded-xl border border-[rgba(200,136,30,0.35)] bg-[rgba(200,136,30,0.07)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--od-ink-2)]"
        >
          Practice purchase · use test UPI success@razorpay or card 4111 1111 1111 1111 with any future date and CVV.
        </p>
      )}

      {status === 'error' && error && (
        <div className="rounded-xl border border-[rgba(200,60,40,0.25)] bg-[rgba(200,60,40,0.06)] px-4 py-3 text-sm text-[var(--od-ink-2)]">
          {error}
        </div>
      )}

      {scriptError && (
        <div className="rounded-xl border border-[rgba(200,60,40,0.25)] bg-[rgba(200,60,40,0.06)] px-4 py-3 text-sm text-[var(--od-ink-2)]">
          We couldn’t load the payment gateway. This is usually caused by an ad
          blocker or privacy extension blocking checkout.razorpay.com — please
          disable it for this site and refresh the page to pay.
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
          ) : scriptError ? (
            <>Payment unavailable</>
          ) : (
            <>Loading payment…</>
          )}
        </button>
      </div>
    </div>
  )
}
