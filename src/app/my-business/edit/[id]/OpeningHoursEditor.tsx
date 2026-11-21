'use client'

import { useState } from 'react'
import { Copy, Plus, X } from 'lucide-react'

import { MAX_WINDOWS_PER_DAY, normalizeOpeningHours, WEEKDAY_LABELS, WEEKDAYS, type OpeningHours } from '@/lib/opening-hours'
import type { AppointmentWeekday } from '@/lib/listing-content'

const EMPTY: OpeningHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }

/**
 * Weekly opening hours, submitted with the listing form as one hidden JSON
 * field. Powers "Open now" on the listing and the directory's filter.
 */
export default function OpeningHoursEditor({ initial }: { initial: unknown }) {
  const [hours, setHours] = useState<OpeningHours>(() => normalizeOpeningHours(initial) ?? EMPTY)

  const setDay = (day: AppointmentWeekday, windows: OpeningHours[AppointmentWeekday]) =>
    setHours((current) => ({ ...current, [day]: windows }))

  const update = (day: AppointmentWeekday, index: number, field: 'start' | 'end', value: string) =>
    setDay(day, hours[day].map((w, i) => (i === index ? { ...w, [field]: value } : w)))

  const copyToAll = (from: AppointmentWeekday) =>
    setHours((current) => Object.fromEntries(WEEKDAYS.map((d) => [d, current[from].map((w) => ({ ...w }))])) as OpeningHours)

  const firstOpen = WEEKDAYS.find((d) => hours[d].length > 0)
  const timeClass = 'rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none'

  return (
    <div className="space-y-2">
      <input type="hidden" name="opening_hours" value={JSON.stringify(hours)} />
      {WEEKDAYS.map((day) => {
        const windows = hours[day]
        const open = windows.length > 0
        return (
          <div key={day} className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-gray-100 px-3 py-2">
            <label className="flex w-32 shrink-0 items-center gap-2 pt-1.5 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={open}
                onChange={(e) => setDay(day, e.target.checked ? [{ start: '09:00', end: '18:00' }] : [])}
                className="h-4 w-4 accent-[var(--od-brand)]"
              />
              {WEEKDAY_LABELS[day]}
            </label>
            {open ? (
              <div className="flex flex-1 flex-col gap-1.5">
                {windows.map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="time" value={w.start} onChange={(e) => update(day, i, 'start', e.target.value)} aria-label={`${WEEKDAY_LABELS[day]} opens`} className={timeClass} />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="time" value={w.end} onChange={(e) => update(day, i, 'end', e.target.value)} aria-label={`${WEEKDAY_LABELS[day]} closes`} className={timeClass} />
                    {windows.length > 1 && (
                      <button type="button" onClick={() => setDay(day, windows.filter((_, j) => j !== i))} aria-label="Remove these hours" className="rounded-lg p-1 text-gray-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {windows.length < MAX_WINDOWS_PER_DAY && (
                  <button
                    type="button"
                    onClick={() => setDay(day, [...windows, { start: windows[windows.length - 1].end, end: '21:00' }])}
                    className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-brand hover:text-brand-strong"
                  >
                    <Plus size={12} aria-hidden /> Add a break / second shift
                  </button>
                )}
              </div>
            ) : (
              <span className="pt-1.5 text-sm text-gray-400">Closed</span>
            )}
          </div>
        )
      })}
      {firstOpen && (
        <button
          type="button"
          onClick={() => copyToAll(firstOpen)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-strong"
        >
          <Copy size={12} aria-hidden /> Use {WEEKDAY_LABELS[firstOpen]}&apos;s hours for every day
        </button>
      )}
      <p className="text-xs text-gray-400">
        Closing after midnight? Set the closing time earlier than the opening time, e.g. 6:00 PM to 2:00 AM.
      </p>
    </div>
  )
}
