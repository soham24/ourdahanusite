'use client'

import { useActionState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'

import { saveDeliveryConfig } from '@/app/actions/delivery'
import type { DeliveryConfig } from '@/lib/delivery'

const rupees = (paise: number | null | undefined) =>
  paise == null ? '' : String(Math.round(paise / 100))

function Field({
  label, name, defaultValue, suffix, placeholder, hint, step,
}: {
  label: string; name: string; defaultValue: string | number
  suffix?: string; placeholder?: string; hint?: string; step?: string
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-[var(--od-ink-2)] mb-1.5">{label}</span>
      <div className="relative">
        <input
          name={name}
          type="number"
          step={step ?? '1'}
          min="0"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full h-11 rounded-xl border border-[var(--od-border)] bg-white px-3.5 text-sm text-[var(--od-ink)] outline-none transition-all focus:border-brand focus:ring-4 focus:ring-[rgba(192,88,46,0.11)]"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--od-muted)]">
            {suffix}
          </span>
        )}
      </div>
      {hint && <span className="mt-1 block text-[11px] text-[var(--od-muted)]">{hint}</span>}
    </label>
  )
}

export function DeliveryConfigForm({
  listingId,
  initialConfig,
}: {
  listingId: string
  initialConfig: DeliveryConfig
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; ok?: true } | null, formData: FormData) =>
      saveDeliveryConfig(formData),
    null,
  )

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-[var(--od-border)] bg-white p-5 sm:p-6">
      <input type="hidden" name="listing_id" value={listingId} />

      {/* Enable toggle */}
      <label className="flex items-center justify-between gap-4 rounded-xl bg-[var(--od-surface-soft)] px-4 py-3.5">
        <span>
          <span className="block text-sm font-bold text-[var(--od-ink)]">Enable delivery</span>
          <span className="block text-xs text-[var(--od-muted)]">Let customers order for doorstep delivery.</span>
        </span>
        <input
          type="checkbox"
          name="delivery_enabled"
          defaultChecked={initialConfig.delivery_enabled}
          className="h-5 w-5 accent-[var(--od-brand)]"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Delivery radius" name="radius_km" defaultValue={initialConfig.radius_km} suffix="km" step="0.5" hint="How far you deliver from your shop." />
        <Field label="Prep time" name="prep_time_min" defaultValue={initialConfig.prep_time_min} suffix="min" hint="Time to pack before pickup." />
        <Field label="Base delivery fee" name="base_fee_rupees" defaultValue={rupees(initialConfig.base_fee_paise)} suffix="₹" hint="Flat part of the fee." />
        <Field label="Per-km fee" name="per_km_fee_rupees" defaultValue={rupees(initialConfig.per_km_fee_paise)} suffix="₹/km" hint="Added per km of distance." />
        <Field label="Free delivery above" name="free_above_rupees" defaultValue={rupees(initialConfig.free_above_paise)} suffix="₹" placeholder="optional" hint="Order value for free delivery." />
        <Field label="Minimum order" name="min_order_rupees" defaultValue={rupees(initialConfig.min_order_paise)} suffix="₹" placeholder="0" hint="Smallest order you accept." />
      </div>

      {state?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      {state?.ok && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <CheckCircle size={16} /> Delivery settings saved.
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save delivery settings'}
      </button>
    </form>
  )
}
