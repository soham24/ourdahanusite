'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, MapPin, Navigation, Package, Phone, Power, Wallet, X } from 'lucide-react'

import { pingRiderLocation, setRiderOnline, type RiderProfile } from '@/app/actions/rider'
import {
  acceptDeliveryOffer, declineDeliveryOffer, getRiderWork,
  riderMarkDelivered, riderMarkOutForDelivery, riderMarkPickedUp,
  type RiderActive, type RiderOffer,
} from '@/app/actions/dispatch'

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export function RiderDashboard({
  rider, earnings,
}: {
  rider: RiderProfile
  earnings: { pendingPaise: number; settledPaise: number }
}) {
  const [online, setOnline] = useState(rider.is_online)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // While online, ping location every 20s so dispatch can find nearby riders.
  useEffect(() => {
    const sendPing = () => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (pos) => { void pingRiderLocation(pos.coords.latitude, pos.coords.longitude) },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      )
    }
    if (online) {
      sendPing()
      pingTimer.current = setInterval(sendPing, 20000)
    }
    return () => { if (pingTimer.current) clearInterval(pingTimer.current) }
  }, [online])

  const toggle = async () => {
    setBusy(true)
    setError('')
    const next = !online
    const res = await setRiderOnline(next)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setOnline(next)
  }

  // ── Offers + active delivery (poll while online) ──
  const [offers, setOffers] = useState<RiderOffer[]>([])
  const [active, setActive] = useState<RiderActive | null>(null)
  const [actId, setActId] = useState<string | null>(null)
  const [otp, setOtp] = useState('')

  const refresh = useCallback(async () => {
    const work = await getRiderWork()
    setOffers(work.offers)
    setActive(work.active)
  }, [])

  useEffect(() => {
    if (!online) { setOffers([]); return }
    refresh()
    const t = setInterval(refresh, 10000)
    return () => clearInterval(t)
  }, [online, refresh])

  const run = async (id: string, fn: () => Promise<{ error?: string; ok?: true }>) => {
    setActId(id); setError('')
    const res = await fn()
    setActId(null)
    if (res.error) { setError(res.error); return false }
    await refresh()
    return true
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border p-5 transition-colors ${online ? 'border-green-200 bg-green-50' : 'border-[var(--od-border)] bg-white'}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[var(--od-ink)]">{rider.full_name}</p>
            <p className="text-sm text-[var(--od-muted)]">
              {online ? "You're online — ready for orders" : "You're offline"}
            </p>
          </div>
          <button
            onClick={toggle}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-60 ${
              online ? 'bg-[var(--od-ink)] text-white' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
            {online ? 'Go offline' : 'Go online'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--od-border)] bg-white p-4">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--od-muted)]"><Wallet size={12} /> Pending</p>
          <p className="mt-1 font-display text-2xl text-[var(--od-ink)]">{rupees(earnings.pendingPaise)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--od-border)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--od-muted)]">Settled</p>
          <p className="mt-1 font-display text-2xl text-[var(--od-ink)]">{rupees(earnings.settledPaise)}</p>
        </div>
      </div>

      {/* Active delivery */}
      {active && (
        <div className="rounded-2xl border border-brand/30 bg-[var(--od-surface-soft)] p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--od-brand)]">Active delivery</p>
          <p className="mt-1 font-bold text-[var(--od-ink)]">{active.listing_name}</p>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--od-ink-2)]"><MapPin size={13} className="mt-0.5 flex-shrink-0" />{active.drop_address}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-[var(--od-muted)]">
            <a href={`tel:${active.customer_phone}`} className="inline-flex items-center gap-1 hover:text-brand"><Phone size={11} /> {active.customer_phone}</a>
            <span>·</span>
            <span>{active.payment_mode === 'cod' ? `Collect ${rupees(active.grand_total_paise)} cash` : 'Paid online'}</span>
          </div>

          <div className="mt-4">
            {active.status === 'rider_assigned' && (
              <button onClick={() => run(active.delivery_order_id, () => riderMarkPickedUp(active.delivery_order_id))} disabled={actId === active.delivery_order_id}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white hover:bg-brand-strong disabled:opacity-60">
                <Package size={15} /> Mark picked up
              </button>
            )}
            {active.status === 'picked_up' && (
              <button onClick={() => run(active.delivery_order_id, () => riderMarkOutForDelivery(active.delivery_order_id))} disabled={actId === active.delivery_order_id}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white hover:bg-brand-strong disabled:opacity-60">
                <Navigation size={15} /> Start delivery
              </button>
            )}
            {active.status === 'out_for_delivery' && (
              <div className="space-y-2">
                <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" placeholder="Enter customer OTP"
                  className="w-full rounded-xl border border-[var(--od-border)] px-3.5 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-brand" />
                <button onClick={async () => { const ok = await run(active.delivery_order_id, () => riderMarkDelivered(active.delivery_order_id, otp)); if (ok) setOtp('') }} disabled={actId === active.delivery_order_id}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60">
                  <Check size={15} /> Confirm delivered
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending offers */}
      {online && !active && offers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--od-border)] bg-[var(--od-surface-soft)] p-5 text-center text-sm text-[var(--od-muted)]">
          Waiting for nearby orders… offers appear here automatically.
        </div>
      )}
      {!active && offers.map((o) => (
        <div key={o.delivery_order_id} className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">New delivery offer</p>
          <p className="mt-1 font-bold text-[var(--od-ink)]">{o.listing_name}</p>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--od-ink-2)]"><MapPin size={13} className="mt-0.5 flex-shrink-0" />{o.drop_address}</p>
          <p className="mt-1 text-xs text-[var(--od-muted)]">
            {o.item_count} item{o.item_count !== 1 ? 's' : ''}{o.distance_km != null ? ` · ${o.distance_km} km` : ''} · you earn {rupees(o.delivery_fee_paise)}
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => run(o.delivery_order_id, () => acceptDeliveryOffer(o.delivery_order_id))} disabled={actId === o.delivery_order_id}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60">
              {actId === o.delivery_order_id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Accept
            </button>
            <button onClick={() => run(o.delivery_order_id, () => declineDeliveryOffer(o.delivery_order_id))} disabled={actId === o.delivery_order_id}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--od-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--od-ink-2)] hover:text-red-600 disabled:opacity-60">
              <X size={15} /> Pass
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
