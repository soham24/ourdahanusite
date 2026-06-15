'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'

import { settleRiderCod, settleRiderEarnings, type RiderSettlement } from '@/app/actions/settlement'

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export function SettlementList({ initialRows }: { initialRows: RiderSettlement[] }) {
  const [rows, setRows] = useState(initialRows)
  const [pending, setPending] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [error, setError] = useState('')

  const settle = (riderId: string, kind: 'earnings' | 'cod') => {
    setPending(`${riderId}:${kind}`)
    setError('')
    startTransition(async () => {
      const res = kind === 'earnings' ? await settleRiderEarnings(riderId) : await settleRiderCod(riderId)
      setPending(null)
      if (res.error) { setError(res.error); return }
      setRows((prev) => prev
        .map((r) => r.riderId === riderId ? { ...r, ...(kind === 'earnings' ? { pendingEarningsPaise: 0 } : { unsettledCodPaise: 0 }) } : r)
        .filter((r) => r.pendingEarningsPaise > 0 || r.unsettledCodPaise > 0))
    })
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {rows.map((r) => (
        <div key={r.riderId} className="rounded-2xl border border-[var(--od-border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-[var(--od-ink)]">{r.fullName}</p>
              <p className="text-xs text-[var(--od-muted)]">{r.phone}{r.payoutUpi ? ` · ${r.payoutUpi}` : ''}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {r.pendingEarningsPaise > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-[var(--od-surface-soft)] px-3 py-2.5">
                <span className="text-sm"><span className="text-[var(--od-muted)]">Pay rider </span><span className="font-bold text-[var(--od-ink)]">{rupees(r.pendingEarningsPaise)}</span></span>
                <button onClick={() => settle(r.riderId, 'earnings')} disabled={pending === `${r.riderId}:earnings`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                  {pending === `${r.riderId}:earnings` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Paid
                </button>
              </div>
            )}
            {r.unsettledCodPaise > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-[var(--od-surface-soft)] px-3 py-2.5">
                <span className="text-sm"><span className="text-[var(--od-muted)]">COD to collect </span><span className="font-bold text-[var(--od-ink)]">{rupees(r.unsettledCodPaise)}</span></span>
                <button onClick={() => settle(r.riderId, 'cod')} disabled={pending === `${r.riderId}:cod`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--od-border)] px-3 py-1.5 text-xs font-semibold text-[var(--od-ink-2)] hover:border-brand hover:text-brand disabled:opacity-60">
                  {pending === `${r.riderId}:cod` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Reconciled
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
