'use client'

import { useState } from 'react'
import { Minus, Pencil, Plus, Package, ShieldCheck, Wrench } from 'lucide-react'

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
  buyerName: initialName,
  buyerPhone: initialPhone,
}: CheckoutFormProps) {
  const [quantity, setQuantity] = useState(1)
  const [buyerName, setBuyerName] = useState(initialName)
  const [buyerPhone, setBuyerPhone] = useState(initialPhone)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(!initialName || !isValidPhone(initialPhone))
  const [notesOpen, setNotesOpen] = useState(false)
  const [fieldError, setFieldError] = useState<{ field: 'name' | 'phone'; message: string } | null>(null)

  const isService = product.type === 'service'
  const maxQuantity = product.quantityInStock ?? 99
  const totalPaise = product.pricePaise * quantity
  const busy = false // Task 4 replaces this with real payment state

  const handlePay = () => {
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
    // Task 4: start the Razorpay flow here.
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
                className={inputCls}
              />
              {fieldError?.field === 'name' && (
                <p className="mt-1 text-xs font-semibold text-[var(--color-danger-strong,#a33)]">
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
                className={inputCls}
              />
              {fieldError?.field === 'phone' && (
                <p className="mt-1 text-xs font-semibold text-[var(--color-danger-strong,#a33)]">
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
          disabled={busy}
          className="od-button-primary flex-1 py-3 text-sm disabled:opacity-60"
        >
          Pay {formatInr(totalPaise)}
        </button>
      </div>
    </div>
  )
}
