'use client'

import { useEffect, useState } from 'react'
import { Check, MapPin, Navigation, Phone, Star, X } from 'lucide-react'

import { cancelMyDeliveryOrder, getDeliveryTracking, rateDelivery, type DeliveryTracking } from '@/app/actions/delivery'

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

const STEPS: { key: string; label: string }[] = [
  { key: 'placed', label: 'Order placed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready_for_pickup', label: 'Ready' },
  { key: 'rider_assigned', label: 'Rider assigned' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'out_for_delivery', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
]

export function DeliveryTracker({ orderId, initial }: { orderId: string; initial: DeliveryTracking }) {
  const [t, setT] = useState(initial)

  useEffect(() => {
    if (t.status === 'delivered' || t.status === 'cancelled' || t.status === 'delivery_failed') return
    const poll = setInterval(async () => {
      const res = await getDeliveryTracking(orderId)
      if (res.tracking) setT(res.tracking)
    }, 10000)
    return () => clearInterval(poll)
  }, [orderId, t.status])

  const cancelled = t.status === 'cancelled' || t.status === 'delivery_failed'
  const currentIdx = STEPS.findIndex((s) => s.key === t.status)

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [rating, setRating] = useState(0)

  const submitRating = async (stars: number) => {
    setRating(stars); setBusy(true); setMsg('')
    const res = await rateDelivery(t.id, stars)
    setBusy(false)
    if (res.error) setMsg(res.error)
    else setT((p) => ({ ...p, rated: true }))
  }

  const cancel = async () => {
    setBusy(true); setMsg('')
    const res = await cancelMyDeliveryOrder(t.id)
    setBusy(false)
    if (res.error) { setMsg(res.error); return }
    const fresh = await getDeliveryTracking(t.id)
    if (fresh.tracking) setT(fresh.tracking)
  }

  return (
    <div className="mt-4 space-y-5">
      <div>
        <p className="od-eyebrow">{t.listing_name}</p>
        <h1 className="mt-1 font-display text-2xl text-[var(--od-ink)]">
          {cancelled ? 'Order cancelled' : t.status === 'delivered' ? 'Delivered 🎉' : 'Tracking your order'}
        </h1>
      </div>

      {/* Rider card */}
      {t.rider && !cancelled && t.status !== 'delivered' && (
        <div className="rounded-2xl border border-brand/30 bg-[var(--od-surface-soft)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--od-brand)]">Your rider</p>
              <p className="mt-0.5 font-bold text-[var(--od-ink)]">{t.rider.full_name}</p>
              {t.riderToDropKm != null && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--od-muted)]">
                  <Navigation size={11} /> ~{t.riderToDropKm} km away
                </p>
              )}
            </div>
            <a href={`tel:${t.rider.phone}`} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
              <Phone size={15} /> Call
            </a>
          </div>
          {t.rider.lat != null && t.rider.lng != null && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${t.rider.lat},${t.rider.lng}`} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline">
              <MapPin size={12} /> See rider on map ↗
            </a>
          )}
        </div>
      )}

      {/* OTP */}
      {!cancelled && t.status !== 'delivered' && t.handoff_otp && (
        <div className="rounded-2xl bg-[var(--color-surface-dark)] px-5 py-4 text-center text-white">
          <p className="text-[11px] uppercase tracking-wide text-[#F0C87A]">Share this OTP with the rider on delivery</p>
          <p className="mt-1 font-display text-3xl tracking-[0.3em]">{t.handoff_otp}</p>
        </div>
      )}

      {/* Status timeline */}
      {!cancelled ? (
        <ol className="relative border-l border-[var(--od-border)] pl-6">
          {STEPS.map((s, i) => {
            const done = currentIdx >= 0 && i <= currentIdx
            const active = i === currentIdx
            return (
              <li key={s.key} className="pb-5 last:pb-0">
                <span className={`absolute -left-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full ${done ? 'bg-[var(--od-brand)] text-white' : 'bg-[var(--od-border)]'}`}>
                  {done && <Check size={11} />}
                </span>
                <p className={`text-sm ${active ? 'font-bold text-[var(--od-ink)]' : done ? 'font-medium text-[var(--od-ink-2)]' : 'text-[var(--od-muted)]'}`}>{s.label}</p>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">This order was cancelled.</p>
      )}

      {/* Rate the rider after delivery */}
      {t.status === 'delivered' && !t.rated && (
        <div className="rounded-2xl border border-[var(--od-border)] bg-white p-4 text-center">
          <p className="text-sm font-semibold text-[var(--od-ink)]">How was your delivery?</p>
          <div className="mt-2 flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => submitRating(n)} disabled={busy} className="p-1 disabled:opacity-50">
                <Star size={28} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-[var(--od-border)]'} />
              </button>
            ))}
          </div>
        </div>
      )}
      {t.status === 'delivered' && t.rated && (
        <p className="text-center text-sm text-[var(--od-muted)]">Thanks for rating your delivery! ⭐</p>
      )}

      {/* Cancel (COD, not yet accepted) */}
      {t.status === 'placed' && t.payment_mode === 'cod' && (
        <button onClick={cancel} disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--od-border)] py-2.5 text-sm font-semibold text-[var(--od-ink-2)] hover:border-red-300 hover:text-red-600 disabled:opacity-60">
          <X size={15} /> Cancel order
        </button>
      )}

      {msg && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{msg}</p>}

      <div className="rounded-xl bg-[var(--od-surface-soft)] px-4 py-3 text-sm">
        <div className="flex justify-between"><span className="text-[var(--od-muted)]">Deliver to</span><span className="max-w-[60%] text-right font-medium text-[var(--od-ink)]">{t.drop_address}</span></div>
        <div className="mt-1 flex justify-between"><span className="text-[var(--od-muted)]">Total</span><span className="font-bold text-[var(--od-ink)]">{rupees(t.grand_total_paise)} · {t.payment_mode === 'cod' ? 'Cash' : 'Paid'}</span></div>
      </div>
    </div>
  )
}
