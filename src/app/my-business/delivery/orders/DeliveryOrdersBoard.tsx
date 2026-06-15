'use client'

import { useState, useTransition } from 'react'
import { Check, Clock, Loader2, MapPin, Package, Phone, X } from 'lucide-react'

import { updateDeliveryOrderStatus, type DeliveryStatus, type OwnerDeliveryOrder } from '@/app/actions/delivery'

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

const STATUS_META: Record<string, { label: string; cls: string }> = {
  placed: { label: 'New', cls: 'bg-amber-100 text-amber-800' },
  accepted: { label: 'Accepted', cls: 'bg-[rgba(192,88,46,0.12)] text-[var(--od-brand-strong)]' },
  preparing: { label: 'Preparing', cls: 'bg-[rgba(200,136,30,0.16)] text-[#8A5A12]' },
  ready_for_pickup: { label: 'Ready', cls: 'bg-green-100 text-green-700' },
  rider_assigned: { label: 'Rider assigned', cls: 'bg-green-100 text-green-700' },
  picked_up: { label: 'Picked up', cls: 'bg-green-100 text-green-700' },
  out_for_delivery: { label: 'Out for delivery', cls: 'bg-green-100 text-green-700' },
  delivered: { label: 'Delivered', cls: 'bg-[var(--od-surface-soft)] text-[var(--od-muted)]' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-700' },
  delivery_failed: { label: 'Failed', cls: 'bg-red-50 text-red-700' },
}

// Primary action per current status (the happy path).
const NEXT_ACTION: Partial<Record<string, { next: DeliveryStatus; label: string }>> = {
  placed: { next: 'accepted', label: 'Accept order' },
  accepted: { next: 'preparing', label: 'Start preparing' },
  preparing: { next: 'ready_for_pickup', label: 'Mark ready' },
}

export function DeliveryOrdersBoard({ initialOrders }: { initialOrders: OwnerDeliveryOrder[] }) {
  const [orders, setOrders] = useState(initialOrders)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [error, setError] = useState('')

  const act = (id: string, next: DeliveryStatus, reason?: string) => {
    setPendingId(id)
    setError('')
    startTransition(async () => {
      const res = await updateDeliveryOrderStatus(id, next, reason)
      setPendingId(null)
      if (res.error) { setError(res.error); return }
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)))
    })
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {orders.map((o) => {
        const meta = STATUS_META[o.status] ?? STATUS_META.placed
        const action = NEXT_ACTION[o.status]
        const canCancel = ['placed', 'accepted', 'preparing'].includes(o.status)
        const busy = pendingId === o.id
        return (
          <div key={o.id} className="rounded-2xl border border-[var(--od-border)] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                <p className="mt-2 font-bold text-[var(--od-ink)]">{o.customer_name}</p>
                <a href={`tel:${o.customer_phone}`} className="inline-flex items-center gap-1 text-xs text-[var(--od-muted)] hover:text-brand">
                  <Phone size={11} /> {o.customer_phone}
                </a>
              </div>
              <div className="text-right">
                <p className="font-display text-lg text-[var(--od-brand-strong)]">{rupees(o.grand_total_paise)}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--od-muted)]">
                  {o.payment_mode === 'cod' ? 'Cash' : 'Paid online'}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-[var(--od-surface-soft)] px-3 py-2.5 text-sm">
              {o.items.map((it, i) => (
                <div key={i} className="flex justify-between text-[var(--od-ink-2)]">
                  <span><Package size={11} className="mr-1 inline text-[var(--od-muted)]" />{it.quantity}× {it.name}</span>
                  <span>{rupees(it.line_total_paise)}</span>
                </div>
              ))}
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--od-muted)]">
              <MapPin size={12} className="mt-0.5 flex-shrink-0" />
              {o.drop_address}{o.distance_km != null ? ` · ${o.distance_km} km` : ''}
            </p>
            {o.notes && <p className="mt-1 text-xs italic text-[var(--od-muted)]">“{o.notes}”</p>}
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--od-muted)]">
              <Clock size={10} /> {new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </p>

            {(action || canCancel) && (
              <div className="mt-4 flex gap-2">
                {action && (
                  <button onClick={() => act(o.id, action.next)} disabled={busy}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60">
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {action.label}
                  </button>
                )}
                {canCancel && (
                  <button onClick={() => act(o.id, 'cancelled')} disabled={busy}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--od-border)] px-4 py-2.5 text-sm font-semibold text-[var(--od-ink-2)] hover:border-red-300 hover:text-red-600 disabled:opacity-60">
                    <X size={15} /> Reject
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
