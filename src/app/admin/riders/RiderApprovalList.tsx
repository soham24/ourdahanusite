'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Ban, RotateCcw } from 'lucide-react'

import { setRiderStatus } from '@/app/actions/rider'

export interface AdminRider {
  id: string
  full_name: string
  phone: string
  vehicle_type: string
  status: 'pending' | 'approved' | 'suspended'
  is_online: boolean
  payout_upi: string | null
  created_at: string
}

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  suspended: 'bg-red-50 text-red-700',
}

export function RiderApprovalList({ initialRiders }: { initialRiders: AdminRider[] }) {
  const [riders, setRiders] = useState(initialRiders)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [error, setError] = useState('')

  const act = (id: string, status: 'approved' | 'suspended' | 'pending') => {
    setPendingId(id)
    setError('')
    startTransition(async () => {
      const res = await setRiderStatus(id, status)
      setPendingId(null)
      if (res.error) { setError(res.error); return }
      setRiders((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    })
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {riders.map((r) => {
        const busy = pendingId === r.id
        return (
          <div key={r.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--od-border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-[var(--od-ink)]">{r.full_name}</p>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_CLS[r.status]}`}>{r.status}</span>
              </div>
              <p className="text-xs text-[var(--od-muted)]">
                {r.phone} · {r.vehicle_type}{r.payout_upi ? ` · ${r.payout_upi}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {r.status !== 'approved' && (
                <button onClick={() => act(r.id, 'approved')} disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
                </button>
              )}
              {r.status === 'approved' && (
                <button onClick={() => act(r.id, 'suspended')} disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--od-border)] px-3 py-2 text-xs font-semibold text-[var(--od-ink-2)] hover:border-red-300 hover:text-red-600 disabled:opacity-60">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />} Suspend
                </button>
              )}
              {r.status === 'suspended' && (
                <button onClick={() => act(r.id, 'pending')} disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--od-border)] px-3 py-2 text-xs font-semibold text-[var(--od-ink-2)] hover:border-brand hover:text-brand disabled:opacity-60">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Reset
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
