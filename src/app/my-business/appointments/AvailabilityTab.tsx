'use client'

import { useState, useTransition } from 'react'
import { Loader2, Save } from 'lucide-react'

import { saveAppointmentSettings } from '@/app/actions/appointment-settings'
import {
  DEFAULT_APPOINTMENT_SETTINGS,
  MAX_WINDOWS_PER_DAY,
  normalizeAppointmentSettings,
  type AppointmentDayWindow,
  type AppointmentSettings,
  type AppointmentWeekday,
} from '@/lib/listing-content'

const APPOINTMENT_DAYS: Array<{ key: AppointmentWeekday; label: string }> = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

function readSettings(raw: unknown): AppointmentSettings {
  let parsed: unknown = null
  try {
    if (raw && typeof raw === 'object') parsed = raw
    else if (typeof raw === 'string') parsed = JSON.parse(raw)
  } catch {
    parsed = null
  }
  return normalizeAppointmentSettings(parsed) ?? DEFAULT_APPOINTMENT_SETTINGS
}

type Props = {
  listingId: string
  listingName: string
  rawSettings: unknown
  /**
   * Called after a successful save so the page can refresh its cached
   * listings. Without it the page still holds the pre-save settings, and
   * switching business away and back re-seeds this editor from stale values.
   */
  onSaved: () => void
}

export default function AvailabilityTab({
  listingId,
  listingName,
  rawSettings,
  onSaved,
}: Props) {
  const [settings, setSettings] = useState<AppointmentSettings>(() => readSettings(rawSettings))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(0)

  // No re-seed effect: the parent passes key={listingId}, so switching
  // business unmounts and remounts this component and every piece of state
  // below is rebuilt from the new listing's settings. Resetting state in an
  // effect instead trips react-hooks/set-state-in-effect and causes a
  // cascading render.
  const setDayWindows = (day: AppointmentWeekday, windows: AppointmentDayWindow[]) => {
    setSettings((current) => ({
      ...current,
      availability: { ...current.availability, [day]: windows },
    }))
  }

  const toggleDay = (day: AppointmentWeekday, isOpen: boolean) => {
    setDayWindows(day, isOpen ? [{ start: '09:00', end: '18:00' }] : [])
  }

  const updateWindow = (
    day: AppointmentWeekday,
    index: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setSettings((current) => {
      const windows = current.availability[day].map((window, i) =>
        i === index ? { ...window, [field]: value } : window,
      )
      return { ...current, availability: { ...current.availability, [day]: windows } }
    })
  }

  const addWindow = (day: AppointmentWeekday) => {
    setSettings((current) => {
      const windows = current.availability[day]
      if (windows.length >= MAX_WINDOWS_PER_DAY) return current
      const last = windows[windows.length - 1]
      const nextStart = last ? last.end : '09:00'
      return {
        ...current,
        availability: {
          ...current.availability,
          [day]: [...windows, { start: nextStart, end: '21:00' }],
        },
      }
    })
  }

  const removeWindow = (day: AppointmentWeekday, index: number) => {
    setSettings((current) => ({
      ...current,
      availability: {
        ...current.availability,
        [day]: current.availability[day].filter((_, i) => i !== index),
      },
    }))
  }

  const save = () => {
    setError('')
    startTransition(async () => {
      const result = await saveAppointmentSettings(listingId, settings)
      if (result.error) {
        setError(result.error)
        return
      }
      setSavedAt(Date.now())
      onSaved()
    })
  }

  return (
    <div className="space-y-5 rounded-2xl border border-[#eee2d7] bg-white p-5">
      <div>
        <h2 className="text-base font-bold text-[#2d160b]">When can people book?</h2>
        <p className="mt-1 text-[12px] text-[#7b6254]">
          These are {listingName}&apos;s regular hours. Use the Schedule tab to close a
          specific date.
        </p>
      </div>

      {/* Slot duration */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-3">Slot duration</p>
        <div className="grid grid-cols-3 gap-2.5">
          {[15, 30, 60].map((duration) => (
            <button
              key={duration}
              type="button"
              onClick={() => setSettings((c) => ({ ...c, slot_duration: duration }))}
              className={`rounded-xl border-2 py-4 text-center transition-all ${
                settings.slot_duration === duration
                  ? 'border-brand bg-surface-soft'
                  : 'border-gray-100 bg-gray-50 hover:border-brand/30'
              }`}
            >
              <div className={`text-2xl font-bold leading-none ${settings.slot_duration === duration ? 'text-brand' : 'text-gray-800'}`}>
                {duration}
              </div>
              <div className={`text-[11px] mt-1 ${settings.slot_duration === duration ? 'text-brand' : 'text-gray-400'}`}>
                min
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Capacity + Buffer */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-4">Capacity / slot</p>
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label="Decrease capacity"
              onClick={() => setSettings((c) => ({ ...c, capacity: Math.max(1, c.capacity - 1) }))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 transition-colors hover:border-brand hover:text-brand"
            >
              −
            </button>
            <span className="text-3xl font-bold text-gray-900">{settings.capacity}</span>
            <button
              type="button"
              aria-label="Increase capacity"
              onClick={() => setSettings((c) => ({ ...c, capacity: Math.min(20, c.capacity + 1) }))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 transition-colors hover:border-brand hover:text-brand"
            >
              +
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-gray-400">max 20 people</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-3">Buffer time</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[0, 5, 10, 15].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSettings((c) => ({ ...c, buffer_minutes: m }))}
                className={`rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                  settings.buffer_minutes === m
                    ? 'border-brand bg-surface-soft text-brand'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-brand/40'
                }`}
              >
                {m === 0 ? 'None' : `${m} min`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advance booking window */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Advance booking window</p>
          <span className="text-base font-bold text-gray-900">{settings.advance_days} days</span>
        </div>
        <input
          type="range"
          min="1"
          max="90"
          step="1"
          aria-label="Advance booking window in days"
          value={settings.advance_days}
          onChange={(event) =>
            setSettings((c) => ({
              ...c,
              advance_days: Math.max(1, Math.min(90, Number(event.target.value))),
            }))
          }
          className="w-full accent-brand"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>1 day</span>
          <span>30 days</span>
          <span>90 days</span>
        </div>
      </div>

      {/* Minimum notice */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Minimum notice</p>
        <p className="text-[11px] text-gray-400 mb-3">
          How soon before a slot someone can still book it.
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 60, 120, 240].map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setSettings((c) => ({ ...c, min_notice_minutes: minutes }))}
              className={`rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                settings.min_notice_minutes === minutes
                  ? 'border-brand bg-surface-soft text-brand'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-brand/40'
              }`}
            >
              {minutes === 0 ? 'None' : minutes === 60 ? '1 hour' : `${minutes / 60} hours`}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly schedule */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Weekly schedule</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Add a second slot for a lunch break — e.g. 9–1 and 4–7.
            </p>
          </div>
          <span className="text-[11px] text-gray-400">
            {APPOINTMENT_DAYS.filter(({ key }) => settings.availability[key].length > 0).length} days open
          </span>
        </div>
        <div className="space-y-2">
          {APPOINTMENT_DAYS.map(({ key, label }) => {
            const windows = settings.availability[key]
            const isOpen = windows.length > 0

            return (
              <div key={key} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-xs font-semibold text-gray-700">{label.slice(0, 3)}</span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => toggleDay(key, !isOpen)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isOpen ? 'Open' : 'Closed'}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-2 space-y-1.5">
                    {windows.map((window, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <input
                          type="time"
                          aria-label={`${label} window ${index + 1} start`}
                          value={window.start}
                          onChange={(event) => updateWindow(key, index, 'start', event.target.value)}
                          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand text-xs text-center bg-white"
                        />
                        <span className="shrink-0 text-gray-400 text-xs">–</span>
                        <input
                          type="time"
                          aria-label={`${label} window ${index + 1} end`}
                          value={window.end}
                          onChange={(event) => updateWindow(key, index, 'end', event.target.value)}
                          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand text-xs text-center bg-white"
                        />
                        {windows.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remove ${label} window ${index + 1}`}
                            onClick={() => removeWindow(key, index)}
                            className="shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-400 hover:border-red-200 hover:text-red-500"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {windows.length < MAX_WINDOWS_PER_DAY && (
                      <button
                        type="button"
                        onClick={() => addWindow(key)}
                        className="text-[11px] font-semibold text-brand hover:underline"
                      >
                        + Add another time range
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save availability
        </button>
        {savedAt > 0 && !isPending && (
          <span className="text-xs font-semibold text-green-700">Saved</span>
        )}
      </div>
    </div>
  )
}
