'use client'

import { useEffect, useState, useTransition } from 'react'
import { CalendarOff, Loader2, Plus, Trash2 } from 'lucide-react'

import {
  deleteAppointmentDateOverride,
  getMyAppointmentListings,
  getUpcomingOverrides,
  saveAppointmentDateOverride,
  type OverrideConflict,
  type OwnerAppointmentListing,
} from '@/app/actions/appointment-overrides'
import type { AppointmentOverrideRecord } from '@/lib/data/appointment-overrides'

function formatOverrideDate(value: string): string {
  return new Date(`${value}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function ScheduleTab() {
  const [listings, setListings] = useState<OwnerAppointmentListing[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [listingsError, setListingsError] = useState('')
  const [listingId, setListingId] = useState('')

  const [overrides, setOverrides] = useState<AppointmentOverrideRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [closed, setClosed] = useState(true)
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('13:00')
  const [conflicts, setConflicts] = useState<OverrideConflict[] | null>(null)

  const resetConflicts = () => setConflicts(null)

  useEffect(() => {
    getMyAppointmentListings().then((result) => {
      if (result.error) setListingsError(result.error)
      setListings(result.listings)
      if (result.listings.length > 0) setListingId(result.listings[0].id)
      setListingsLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!listingId) return
    getUpcomingOverrides(listingId).then((result) => {
      if (result.error) setError(result.error)
      else setOverrides(result.overrides)
      setLoading(false)
    })
  }, [listingId])

  const reload = async () => {
    if (!listingId) return
    const result = await getUpcomingOverrides(listingId)
    if (!result.error) setOverrides(result.overrides)
  }

  const submit = (resolution?: 'cancel_conflicts' | 'keep_conflicts') => {
    if (!date) {
      setError('Pick a date first.')
      return
    }

    setError('')
    startTransition(async () => {
      const result = await saveAppointmentDateOverride({
        listingId,
        overrideDate: date,
        closed,
        windows: closed ? null : [{ start, end }],
        note: note.trim() || null,
        resolution,
      })

      if (result.error) {
        setError(result.error)
        resetConflicts()
        await reload()
        return
      }

      if (result.conflicts && result.conflicts.length > 0) {
        setConflicts(result.conflicts)
        return
      }

      resetConflicts()
      setDate('')
      setNote('')
      await reload()
    })
  }

  const remove = (overrideId: string) => {
    startTransition(async () => {
      const result = await deleteAppointmentDateOverride(overrideId)
      if (result.error) {
        setError(result.error)
        return
      }
      await reload()
    })
  }

  if (listingsLoading) {
    return <p className="text-xs text-[#9b7c69]">Loading…</p>
  }

  if (listingsError) {
    return <p className="text-xs font-semibold text-red-600">{listingsError}</p>
  }

  if (listings.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[#e5d3c2] p-6 text-center text-xs text-[#9b7c69]">
        Appointments are not enabled for any of your businesses yet.
      </p>
    )
  }

  const selectedListing = listings.find((listing) => listing.id === listingId) ?? listings[0]
  const listingName = selectedListing?.name ?? 'Your business'

  return (
    <div className="space-y-6">
      {listings.length > 1 && (
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Business
          <select
            value={listingId}
            onChange={(event) => {
              setListingId(event.target.value)
              resetConflicts()
            }}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800"
          >
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <section className="rounded-2xl border border-[#eee2d7] bg-white p-5">
        <h2 className="text-base font-bold text-[#2d160b]">Closed days &amp; special hours</h2>
        <p className="mt-1 text-[12px] text-[#7b6254]">
          Overrides your weekly schedule for one date. {listingName} stays open normally on every
          other day.
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                  resetConflicts()
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800"
              />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Reason (optional)
              <input
                type="text"
                value={note}
                maxLength={80}
                placeholder="Diwali"
                onChange={(event) => {
                  setNote(event.target.value)
                  resetConflicts()
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setClosed(true)
                resetConflicts()
              }}
              className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${closed ? 'border-brand bg-surface-soft text-brand' : 'border-gray-200 text-gray-500'}`}
            >
              Closed all day
            </button>
            <button
              type="button"
              onClick={() => {
                setClosed(false)
                resetConflicts()
              }}
              className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${!closed ? 'border-brand bg-surface-soft text-brand' : 'border-gray-200 text-gray-500'}`}
            >
              Different hours
            </button>
          </div>

          {!closed && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                aria-label="Special hours start"
                value={start}
                onChange={(event) => {
                  setStart(event.target.value)
                  resetConflicts()
                }}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm"
              />
              <span className="text-gray-400">–</span>
              <input
                type="time"
                aria-label="Special hours end"
                value={end}
                onChange={(event) => {
                  setEnd(event.target.value)
                  resetConflicts()
                }}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm"
              />
            </div>
          )}

          {conflicts && conflicts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-900">
                {conflicts.length} booking{conflicts.length === 1 ? '' : 's'} on this date fall
                outside the new hours
              </p>
              <ul className="mt-2 space-y-1">
                {conflicts.map((conflict) => (
                  <li key={conflict.id} className="text-[12px] text-amber-900">
                    {conflict.slot_start} · {conflict.user_name}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-amber-800">
                Booking fees are not refunded. Please phone these customers either way.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => submit('cancel_conflicts')}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Cancel these bookings
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => submit('keep_conflicts')}
                  className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-60"
                >
                  Keep them, close the rest
                </button>
                <button
                  type="button"
                  onClick={resetConflicts}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-amber-800"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          {!conflicts && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => submit()}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add to schedule
            </button>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-bold text-[#2d160b]">Upcoming changes</h3>
        {loading ? (
          <p className="text-xs text-[#9b7c69]">Loading…</p>
        ) : overrides.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e5d3c2] p-6 text-center">
            <CalendarOff size={20} className="mx-auto text-[#c9ab97]" aria-hidden />
            <p className="mt-2 text-xs text-[#9b7c69]">
              No closures planned. Your weekly schedule applies to every date.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {overrides.map((override) => (
              <li
                key={override.id}
                className="flex items-center gap-3 rounded-xl border border-[#eee2d7] bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-[#2d160b]">
                    {formatOverrideDate(override.override_date)}
                  </p>
                  <p className="text-[12px] text-[#7b6254]">
                    {override.closed
                      ? 'Closed all day'
                      : (override.windows ?? [])
                          .map((window) => `${window.start}–${window.end}`)
                          .join(', ')}
                    {override.note ? ` · ${override.note}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${formatOverrideDate(override.override_date)}`}
                  disabled={isPending}
                  onClick={() => remove(override.id)}
                  className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-400 hover:border-red-200 hover:text-red-500 disabled:opacity-60"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
