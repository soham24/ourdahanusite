'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'

import { applyAsRider } from '@/app/actions/rider'

const VEHICLES = [
  { value: 'bike', label: '🏍️ Bike' },
  { value: 'scooter', label: '🛵 Scooter' },
  { value: 'cycle', label: '🚲 Cycle' },
  { value: 'car', label: '🚗 Car' },
  { value: 'foot', label: '🚶 On foot' },
]

export function RiderOnboarding() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; ok?: true } | null, fd: FormData) => applyAsRider(fd),
    null,
  )

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <h2 className="text-lg font-bold text-green-800">Application submitted!</h2>
        <p className="mt-1 text-sm text-green-700">We&apos;ll review and approve your rider account soon. Refresh this page later to check status.</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-[var(--od-border)] bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--od-ink)]">Become a rider</h2>
        <p className="text-sm text-[var(--od-muted)]">Earn by delivering orders near you. Fill in your details to apply.</p>
      </div>

      <input name="full_name" placeholder="Full name" className="w-full rounded-xl border border-[var(--od-border)] px-3.5 py-2.5 text-sm outline-none focus:border-brand" />
      <input name="phone" type="tel" placeholder="Phone number" className="w-full rounded-xl border border-[var(--od-border)] px-3.5 py-2.5 text-sm outline-none focus:border-brand" />

      <div>
        <label className="mb-1.5 block text-xs font-bold text-[var(--od-ink-2)]">Vehicle</label>
        <select name="vehicle_type" defaultValue="bike" className="w-full rounded-xl border border-[var(--od-border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand">
          {VEHICLES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
      </div>

      <input name="payout_upi" placeholder="UPI ID for payouts (optional)" className="w-full rounded-xl border border-[var(--od-border)] px-3.5 py-2.5 text-sm outline-none focus:border-brand" />

      {state?.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}

      <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white hover:bg-brand-strong disabled:opacity-60">
        {pending ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : 'Apply to be a rider'}
      </button>
    </form>
  )
}
