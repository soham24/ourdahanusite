'use client'

type Props = {
  name: string
  phone: string
  notes: string
  fieldErrors: { name?: string; phone?: string }
  disabled: boolean
  onChange: (patch: { name?: string; phone?: string; notes?: string }) => void
}

export default function BookingDetailsForm({
  name,
  phone,
  notes,
  fieldErrors,
  disabled,
  onChange,
}: Props) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--od-muted)]">
          Your name
        </span>
        <input
          type="text"
          value={name}
          disabled={disabled}
          maxLength={80}
          onChange={(event) => onChange({ name: event.target.value })}
          className="mt-1 w-full rounded-xl border border-[var(--od-border)] px-3 py-2.5 text-sm"
        />
        {fieldErrors.name && (
          <span className="mt-1 block text-xs font-semibold text-red-600">{fieldErrors.name}</span>
        )}
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--od-muted)]">
          Phone
        </span>
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          disabled={disabled}
          maxLength={15}
          onChange={(event) => onChange({ phone: event.target.value })}
          className="mt-1 w-full rounded-xl border border-[var(--od-border)] px-3 py-2.5 text-sm"
        />
        {fieldErrors.phone && (
          <span className="mt-1 block text-xs font-semibold text-red-600">{fieldErrors.phone}</span>
        )}
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--od-muted)]">
          Anything they should know? (optional)
        </span>
        <textarea
          value={notes}
          disabled={disabled}
          maxLength={500}
          rows={2}
          onChange={(event) => onChange({ notes: event.target.value })}
          className="mt-1 w-full resize-none rounded-xl border border-[var(--od-border)] px-3 py-2.5 text-sm"
        />
      </label>
    </div>
  )
}
