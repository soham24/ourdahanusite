'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle, Loader2, LocateFixed, Minus, Plus, ShoppingBag, X } from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import { getServiceabilityQuote, placeDeliveryOrder } from '@/app/actions/delivery'
import type { DeliveryConfig, FeeQuote } from '@/lib/delivery'

export interface StoreProduct {
  id: string
  name: string
  description: string | null
  price_paise: number
  quantity_in_stock: number | null
  image_thumb_url: string | null
  image_url: string | null
  is_active: boolean
}

type RazorpayCtor = new (o: Record<string, unknown>) => { open: () => void }
const getRazorpay = () => (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export function DeliveryStore({
  listingId, listingName, config, products,
}: {
  listingId: string; listingName: string; config: DeliveryConfig; products: StoreProduct[]
}) {
  const { user } = useAuth()
  const [cart, setCart] = useState<Record<string, number>>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const itemsTotal = useMemo(
    () => products.reduce((sum, p) => sum + p.price_paise * (cart[p.id] ?? 0), 0),
    [cart, products],
  )
  const count = Object.values(cart).reduce((a, b) => a + b, 0)

  const setQty = (id: string, delta: number, max: number | null) =>
    setCart((c) => {
      const next = Math.max(0, (c[id] ?? 0) + delta)
      const capped = max != null ? Math.min(next, max) : next
      const copy = { ...c }
      if (capped === 0) delete copy[id]
      else copy[id] = capped
      return copy
    })

  return (
    <>
      <div className="grid grid-cols-1 gap-3 pb-28">
        {products.map((p) => {
          const qty = cart[p.id] ?? 0
          const out = p.quantity_in_stock != null && p.quantity_in_stock <= 0
          const img = p.image_thumb_url || p.image_url
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-[var(--od-border)] bg-white p-3">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-[var(--od-surface-soft)]">
                {img && <Image src={img} alt={p.name} fill sizes="64px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--od-ink)]">{p.name}</p>
                {p.description && <p className="line-clamp-1 text-xs text-[var(--od-muted)]">{p.description}</p>}
                <p className="mt-0.5 font-display text-lg text-[var(--od-brand-strong)]">{rupees(p.price_paise)}</p>
              </div>
              {out ? (
                <span className="rounded-lg bg-[var(--od-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--od-muted)]">Out of stock</span>
              ) : qty === 0 ? (
                <button onClick={() => setQty(p.id, 1, p.quantity_in_stock)} className="rounded-xl border border-[var(--od-brand)] px-4 py-2 text-sm font-bold text-[var(--od-brand)] transition-colors hover:bg-[var(--od-brand)] hover:text-white">Add</button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(p.id, -1, p.quantity_in_stock)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--od-border)] text-[var(--od-ink-2)]"><Minus size={14} /></button>
                  <span className="w-5 text-center font-bold text-[var(--od-ink)]">{qty}</span>
                  <button onClick={() => setQty(p.id, 1, p.quantity_in_stock)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--od-border)] text-[var(--od-ink-2)]"><Plus size={14} /></button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sticky cart bar */}
      {count > 0 && (
        <div className="fixed inset-x-0 z-40 px-3" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <button
            onClick={() => setCheckoutOpen(true)}
            className="mx-auto flex max-w-md w-full items-center justify-between gap-3 rounded-2xl bg-[var(--od-brand)] px-5 py-3.5 text-white shadow-lg active:scale-[0.99]"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold"><ShoppingBag size={16} /> {count} item{count > 1 ? 's' : ''}</span>
            <span className="font-bold">{rupees(itemsTotal)} · Checkout</span>
          </button>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutSheet
          listingId={listingId}
          listingName={listingName}
          config={config}
          cart={cart}
          itemsTotal={itemsTotal}
          defaultName={(user?.user_metadata?.full_name as string) || ''}
          isLoggedIn={Boolean(user)}
          onClose={() => setCheckoutOpen(false)}
        />
      )}
    </>
  )
}

function CheckoutSheet({
  listingId, listingName, config, cart, itemsTotal, defaultName, isLoggedIn, onClose,
}: {
  listingId: string; listingName: string; config: DeliveryConfig
  cart: Record<string, number>; itemsTotal: number; defaultName: string; isLoggedIn: boolean; onClose: () => void
}) {
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [drop, setDrop] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [quote, setQuote] = useState<FeeQuote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [mode, setMode] = useState<'cod' | 'online'>('cod')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ orderId?: string; otp?: string } | null>(null)

  const items = useMemo(
    () => Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })),
    [cart],
  )

  // Re-quote whenever a drop pin is available.
  useEffect(() => {
    if (!drop) { setQuote(null); return }
    let active = true
    setQuoting(true)
    getServiceabilityQuote(listingId, drop, itemsTotal).then((res) => {
      if (!active) return
      setQuoting(false)
      if (res.error) { setError(res.error); setQuote(null) }
      else { setError(''); setQuote(res.quote ?? null) }
    })
    return () => { active = false }
  }, [drop, listingId, itemsTotal])

  const locate = () => {
    setError('')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); setDrop({ lat: pos.coords.latitude, lng: pos.coords.longitude }) },
      () => { setLocating(false); setError('Could not get your location. Please allow location access.') },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if (getRazorpay()) return resolve(true)
      const s = document.createElement('script')
      s.src = 'https://checkout.razorpay.com/v1/checkout.js'
      s.onload = () => resolve(true)
      s.onerror = () => resolve(false)
      document.body.appendChild(s)
    })

  const buildForm = (extra?: Record<string, string>) => {
    const fd = new FormData()
    fd.set('listing_id', listingId)
    fd.set('customer_name', name.trim())
    fd.set('customer_phone', phone.trim())
    fd.set('drop_address', address.trim())
    fd.set('drop_lat', String(drop?.lat ?? ''))
    fd.set('drop_lng', String(drop?.lng ?? ''))
    fd.set('items', JSON.stringify(items))
    fd.set('payment_mode', mode)
    for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v)
    return fd
  }

  const placeCod = async () => {
    const res = await placeDeliveryOrder(buildForm())
    if (res.error) { setError(res.error); return }
    setDone({ orderId: res.orderId, otp: res.otp })
  }

  const placeOnline = async () => {
    const ok = await loadRazorpay()
    if (!ok) { setError('Payment gateway failed to load.'); return }
    const res = await fetch('/api/razorpay/create-delivery-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, items, drop, customerName: name.trim(), customerPhone: phone.trim(), notes: '' }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { setError(data.error || 'Could not start payment.'); return }

    const Razorpay = getRazorpay()
    if (!Razorpay) { setError('Payment gateway failed to load.'); return }
    await new Promise<void>((resolve) => {
      const rzp = new Razorpay({
        key: data.keyId, amount: data.amount, currency: data.currency, order_id: data.orderId,
        name: listingName, description: 'Delivery order',
        handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const fin = await placeDeliveryOrder(buildForm({
            razorpay_order_id: r.razorpay_order_id,
            razorpay_payment_id: r.razorpay_payment_id,
            razorpay_signature: r.razorpay_signature,
          }))
          if (fin.error) setError(fin.error)
          else setDone({ orderId: fin.orderId, otp: fin.otp })
          resolve()
        },
        modal: { ondismiss: () => resolve() },
        prefill: { name: name.trim(), contact: phone.trim() },
        theme: { color: '#C0582E' },
      })
      rzp.open()
    })
  }

  const submit = async () => {
    setError('')
    if (!isLoggedIn) { window.location.href = `/login?next=${encodeURIComponent(`/delivery/${listingId}`)}`; return }
    if (!name.trim() || !phone.trim() || !address.trim()) { setError('Please fill name, phone, and address.'); return }
    if (!drop) { setError('Please set your delivery location.'); return }
    if (quote && !quote.serviceable) { setError('This address is not serviceable.'); return }
    setBusy(true)
    try { mode === 'online' ? await placeOnline() : await placeCod() }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-[var(--od-border)] px-5 py-4">
          <span className="font-bold text-[var(--od-ink)]">{done ? 'Order placed' : 'Checkout'}</span>
          <button onClick={onClose} className="text-[var(--od-muted)] hover:text-[var(--od-ink)]"><X size={20} /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100"><CheckCircle size={36} className="text-green-600" /></div>
            <h3 className="text-lg font-bold text-[var(--od-ink)]">Order placed!</h3>
            <p className="text-sm text-[var(--od-muted)]">{listingName} will accept and prepare your order. Track it in your orders.</p>
            {done.otp && (
              <div className="rounded-xl bg-[var(--od-surface-soft)] px-5 py-3">
                <p className="text-xs text-[var(--od-muted)]">Delivery OTP (share with rider)</p>
                <p className="font-display text-2xl tracking-[0.2em] text-[var(--od-ink)]">{done.otp}</p>
              </div>
            )}
            {done.orderId
              ? <Link href={`/delivery/order/${done.orderId}`} className="rounded-xl bg-[var(--od-brand)] px-5 py-2.5 text-sm font-semibold text-white">Track order</Link>
              : <Link href="/account/orders" className="text-sm font-semibold text-[var(--od-brand)]">View my orders</Link>}
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-xl bg-[var(--od-surface-soft)] px-4 py-3 text-sm">
              <div className="flex justify-between"><span className="text-[var(--od-muted)]">Items</span><span className="font-semibold text-[var(--od-ink)]">{rupees(itemsTotal)}</span></div>
              {quote?.serviceable && (
                <>
                  <div className="mt-1 flex justify-between"><span className="text-[var(--od-muted)]">Delivery ({quote.distanceKm} km)</span><span className="font-semibold text-[var(--od-ink)]">{quote.deliveryFeePaise === 0 ? 'Free' : rupees(quote.deliveryFeePaise)}</span></div>
                  <div className="mt-1 flex justify-between border-t border-[var(--od-border)] pt-1 font-bold text-[var(--od-ink)]"><span>Total</span><span>{rupees(quote.grandTotalPaise)}</span></div>
                </>
              )}
            </div>

            <button onClick={locate} disabled={locating} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--od-border)] py-3 text-sm font-semibold text-[var(--od-ink-2)] hover:border-[var(--od-brand)] hover:text-[var(--od-brand)]">
              {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
              {drop ? 'Location set ✓ — update' : 'Use my current location'}
            </button>
            {quoting && <p className="text-xs text-[var(--od-muted)]">Checking serviceability…</p>}

            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Flat / house, landmark, area" className="w-full rounded-xl border border-[var(--od-border)] px-3.5 py-2.5 text-sm outline-none focus:border-brand" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-[var(--od-border)] px-3.5 py-2.5 text-sm outline-none focus:border-brand" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Phone number" className="w-full rounded-xl border border-[var(--od-border)] px-3.5 py-2.5 text-sm outline-none focus:border-brand" />

            <div className="grid grid-cols-2 gap-2">
              {(['cod', 'online'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${mode === m ? 'border-brand bg-[var(--od-surface-soft)] text-[var(--od-brand)]' : 'border-[var(--od-border)] text-[var(--od-ink-2)]'}`}>
                  {m === 'cod' ? 'Cash on delivery' : 'Pay online'}
                </button>
              ))}
            </div>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <button onClick={submit} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--od-brand)] py-3.5 text-sm font-bold text-white hover:bg-[var(--od-brand-strong)] disabled:opacity-60">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Placing…</> : isLoggedIn ? `Place order${quote?.serviceable ? ` · ${rupees(quote.grandTotalPaise)}` : ''}` : 'Sign in to order'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
