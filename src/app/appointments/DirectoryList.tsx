'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

import type { AppointmentDirectoryEntry } from '@/lib/data/appointment-directory'

function formatSlotDate(value: string): string {
  return new Date(`${value}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatTime(value: string): string {
  const hour = Number.parseInt(value.slice(0, 2), 10)
  const minute = value.slice(3, 5)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minute} ${suffix}`
}

export default function DirectoryList({ entries }: { entries: AppointmentDirectoryEntry[] }) {
  const [category, setCategory] = useState<string | null>(null)

  const categories = useMemo(() => {
    const seen = new Map<string, number>()
    for (const entry of entries) {
      if (!entry.category) continue
      seen.set(entry.category, (seen.get(entry.category) ?? 0) + 1)
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [entries])

  const visible = category ? entries.filter((entry) => entry.category === category) : entries

  return (
    <>
      {categories.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              category === null
                ? 'border-[var(--od-brand)] bg-[var(--od-brand)] text-white'
                : 'border-[var(--od-border)] bg-white text-[var(--od-ink-2)]'
            }`}
          >
            All ({entries.length})
          </button>
          {categories.map(([label, count]) => (
            <button
              key={label}
              type="button"
              onClick={() => setCategory(label)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                category === label
                  ? 'border-[var(--od-brand)] bg-[var(--od-brand)] text-white'
                  : 'border-[var(--od-border)] bg-white text-[var(--od-ink-2)]'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {visible.map((entry) => (
          <li key={entry.listingId} className="od-card p-5">
            <div className="flex items-start gap-3">
              {entry.imageUrl ? (
                <Image
                  src={entry.imageUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 rounded-[14px] object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-gray-100)]">
                  <CalendarClock size={18} className="text-[var(--od-muted)]" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold">{entry.name}</h2>
                <p className="mt-0.5 text-xs text-[var(--od-muted)]">
                  {entry.category ?? 'Appointments'}{' '}
                  {entry.bookingFee > 0 ? `· ₹${entry.bookingFee} to book` : '· Free to book'}
                </p>
              </div>
            </div>

            <div className="mt-4">
              {entry.hasAvailability ? (
                <div className="flex flex-wrap gap-1.5">
                  {entry.nextSlots.map((slot) => (
                    <span
                      key={`${slot.date}-${slot.start}`}
                      className="rounded-lg border border-[var(--od-border)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                    >
                      {formatSlotDate(slot.date)} · {formatTime(slot.start)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--od-muted)]">
                  No slots available in the next two weeks.
                </p>
              )}
            </div>

            {entry.subdomain && (
              <Link
                href={`/appointments/${entry.subdomain}`}
                className="od-button-primary mt-4 flex w-full items-center justify-center py-2.5 text-sm"
              >
                {entry.hasAvailability ? 'Book a slot' : 'See schedule'}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
