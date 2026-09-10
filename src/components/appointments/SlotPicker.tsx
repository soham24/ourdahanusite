'use client'

import type { AppointmentSlot } from '@/lib/appointment-slots'

type Props = {
  slots: AppointmentSlot[]
  selectedStart: string | null
  loading: boolean
  onSelect: (slot: AppointmentSlot) => void
}

function periodOf(slot: AppointmentSlot): 'Morning' | 'Afternoon' | 'Evening' {
  const hour = Number.parseInt(slot.start.slice(0, 2), 10)
  if (hour < 12) return 'Morning'
  if (hour < 16) return 'Afternoon'
  return 'Evening'
}

function labelFor(value: string): string {
  const hour = Number.parseInt(value.slice(0, 2), 10)
  const minute = value.slice(3, 5)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${minute} ${suffix}`
}

/**
 * Unbookable slots are rendered greyed with a reason rather than omitted. A
 * clinic that is fully booked and one that barely opens produced identical
 * sparse grids when full slots were simply dropped.
 */
export default function SlotPicker({ slots, selectedStart, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--color-gray-100)]" />
        ))}
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--od-border)] px-4 py-6 text-center text-sm text-[var(--od-muted)]">
        Closed on this date. Try another day.
      </p>
    )
  }

  const groups: Array<{ period: string; items: AppointmentSlot[] }> = []
  for (const slot of slots) {
    const period = periodOf(slot)
    const last = groups[groups.length - 1]
    if (last && last.period === period) last.items.push(slot)
    else groups.push({ period, items: [slot] })
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={`${group.period}-${group.items[0].start}`}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--od-muted)]">
            {group.period}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.items.map((slot) => {
              const isSelected = slot.start === selectedStart
              return (
                <button
                  key={slot.start}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => onSelect(slot)}
                  aria-label={
                    slot.available
                      ? labelFor(slot.start)
                      : `${labelFor(slot.start)} — ${slot.reason === 'full' ? 'full' : 'too soon'}`
                  }
                  className={`rounded-xl border px-2 py-2 text-center transition-colors ${
                    isSelected
                      ? 'border-[var(--od-brand)] bg-[var(--od-brand)] text-white'
                      : slot.available
                        ? 'border-[var(--od-border)] bg-white text-[var(--od-ink)] hover:border-[var(--od-brand)]'
                        : 'cursor-not-allowed border-[var(--od-border)] bg-[var(--color-gray-100)] text-[var(--od-muted)]'
                  }`}
                >
                  <span className="block text-[13px] font-semibold">{labelFor(slot.start)}</span>
                  {!slot.available && (
                    <span className="block text-[10px]">
                      {slot.reason === 'full' ? 'Full' : 'Too soon'}
                    </span>
                  )}
                  {slot.available && slot.remaining > 1 && (
                    <span className="block text-[10px] text-[var(--od-muted)]">
                      {slot.remaining} left
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
