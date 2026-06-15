'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Power, Wallet } from 'lucide-react'

import { pingRiderLocation, setRiderOnline, type RiderProfile } from '@/app/actions/rider'

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

      <div className="rounded-2xl border border-dashed border-[var(--od-border)] bg-[var(--od-surface-soft)] p-5 text-center text-sm text-[var(--od-muted)]">
        Delivery offers will appear here when you&apos;re online and an order near you is ready.
      </div>
    </div>
  )
}
