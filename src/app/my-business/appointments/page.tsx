'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  Calendar,
  CheckCircle,
  Clock3,
  IndianRupee,
  Loader2,
  Store,
  XCircle,
} from 'lucide-react'

import {
  cancelAppointment,
  getMyBusinessAppointments,
  updateAppointmentStatus,
  type AppointmentRecord,
} from '@/app/actions/appointments'
import {
  getMyAppointmentListings,
  type OwnerAppointmentListing,
} from '@/app/actions/appointment-overrides'

import AvailabilityTab from './AvailabilityTab'
import ScheduleTab from './ScheduleTab'

function getIndiaToday(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

/** Normalise Postgres time (HH:MM or HH:MM:SS) to HH:MM:SS for Date parsing */
function normaliseTime(t: string): string {
  const parts = t.split(':')
  if (parts.length === 2) return `${t}:00`
  return t
}

function getAppointmentInstant(appointment: AppointmentRecord): Date {
  return new Date(`${appointment.booking_date}T${normaliseTime(appointment.slot_start)}+05:30`)
}

function isFutureAppointment(appointment: AppointmentRecord): boolean {
  return getAppointmentInstant(appointment).getTime() > Date.now()
}

function formatDate(dateString: string) {
  return new Date(`${dateString}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTimeRange(start: string, end: string) {
  const startLabel = new Date(`1970-01-01T${normaliseTime(start)}+05:30`).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
  const endLabel = new Date(`1970-01-01T${normaliseTime(end)}+05:30`).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
  return `${startLabel} - ${endLabel}`
}

function formatFee(value: number) {
  return value > 0 ? `Rs ${value.toLocaleString('en-IN')}` : 'Free'
}

function statusBadge(status: AppointmentRecord['status']) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
        <CheckCircle size={11} />
        Completed
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
        <XCircle size={11} />
        Cancelled
      </span>
    )
  }
  if (status === 'no_show') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
        <XCircle size={11} />
        No Show
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
      <Clock3 size={11} />
      Confirmed
    </span>
  )
}

function AppointmentRow({
  appointment,
  onUpdated,
  onError,
}: {
  appointment: AppointmentRecord
  onUpdated: (id: string, patch: Partial<AppointmentRecord>) => void
  onError: (message: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const isFuture = isFutureAppointment(appointment)
  const canMarkAttendance = appointment.status === 'confirmed' && !isFuture
  const canCancel = appointment.status === 'confirmed'

  const runStatusUpdate = (status: 'completed' | 'no_show') => {
    startTransition(async () => {
      const result = await updateAppointmentStatus(appointment.id, status)
      if (result.error) {
        onError(result.error)
        return
      }

      onUpdated(appointment.id, { status })
    })
  }

  const runCancel = () => {
    const reason = window.prompt('Cancellation reason (optional):') ?? undefined
    startTransition(async () => {
      const result = await cancelAppointment(appointment.id, reason)
      if (result.error) {
        onError(result.error)
        return
      }

      onUpdated(appointment.id, {
        status: 'cancelled',
        cancellation_reason: reason ?? null,
      })
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#eee2d7] bg-white shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {statusBadge(appointment.status)}
            {appointment.booking_fee > 0 && (
              <span className="text-xs font-semibold text-brand">{formatFee(appointment.booking_fee)}</span>
            )}
          </div>
          <p className="text-[13px] font-bold text-[#2d160b] leading-snug">{appointment.user_name}</p>
          <p className="text-[12px] text-[#7b6254] mt-0.5">{appointment.user_phone}</p>
          <p className="text-[12px] text-[#9b7c69] mt-1.5 flex items-center gap-1">
            <Clock3 size={11} className="shrink-0" />
            {formatDate(appointment.booking_date)} · {formatTimeRange(appointment.slot_start, appointment.slot_end)}
          </p>
          {appointment.listing?.name && (
            <p className="text-[11px] text-[#b0917e] mt-1">{appointment.listing.name}</p>
          )}
          {appointment.notes && (
            <p className="mt-2 rounded-xl bg-[#faf3eb] px-3 py-2 text-[12px] text-[#6b5547] line-clamp-2">{appointment.notes}</p>
          )}
          {appointment.cancellation_reason && (
            <p className="mt-1.5 text-[11px] text-[#9a7060]">Cancelled: {appointment.cancellation_reason}</p>
          )}
        </div>
      </div>

      {(canMarkAttendance || canCancel) && (
        <div className="flex items-center gap-2 border-t border-[#f5ece4] bg-[#fdfaf7] px-4 py-3">
          {canMarkAttendance && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => runStatusUpdate('completed')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
              >
                {isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Done
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => runStatusUpdate('no_show')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                <XCircle size={12} />
                No-show
              </button>
            </>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={isPending}
              onClick={runCancel}
              className="flex items-center gap-1 rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-red-200 hover:text-red-500 disabled:opacity-60"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function MyBusinessAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [tab, setTab] = useState<'bookings' | 'availability' | 'schedule'>('bookings')
  const [listings, setListings] = useState<OwnerAppointmentListing[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [listingId, setListingId] = useState('')

  useEffect(() => {
    getMyAppointmentListings().then((result) => {
      setListings(result.listings)
      if (result.listings.length > 0) setListingId(result.listings[0].id)
      setListingsLoading(false)
    })
  }, [])

  const selectedListing = listings.find((listing) => listing.id === listingId) ?? null

  // Re-read after a save so the cached settings this page hands to the editor
  // do not go stale. Without it, switching business away and back would show
  // the owner their pre-save hours.
  const refreshListings = async () => {
    const result = await getMyAppointmentListings()
    setListings(result.listings)
  }

  const today = useMemo(() => getIndiaToday(), [])

  useEffect(() => {
    getMyBusinessAppointments().then((data) => {
      setAppointments(data)
      setLoading(false)
    })
  }, [])

  const applyPatch = (id: string, patch: Partial<AppointmentRecord>) => {
    setAppointments((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  // Scope every booking view to the selected business. When the owner has no
  // appointment-enabled listing there is nothing to scope by, so historical
  // bookings still show rather than silently vanishing.
  const scopedAppointments = useMemo(
    () => (listingId ? appointments.filter((a) => a.listing_id === listingId) : appointments),
    [appointments, listingId],
  )

  const todayAppointments = useMemo(
    () => scopedAppointments.filter((appointment) => appointment.booking_date === today),
    [scopedAppointments, today],
  )

  const upcomingAppointments = useMemo(
    () =>
      scopedAppointments.filter(
        (appointment) => appointment.status === 'confirmed' && appointment.booking_date > today,
      ),
    [scopedAppointments, today],
  )

  const nextAppointment = useMemo(
    () =>
      scopedAppointments.find(
        (appointment) => appointment.status === 'confirmed' && isFutureAppointment(appointment),
      ) ?? null,
    [scopedAppointments],
  )

  const recentActivity = useMemo(
    () =>
      [...scopedAppointments]
        .filter(
          (appointment) =>
            appointment.booking_date !== today &&
            (appointment.status !== 'confirmed' || !isFutureAppointment(appointment)),
        )
        .sort((a, b) => getAppointmentInstant(b).getTime() - getAppointmentInstant(a).getTime())
        .slice(0, 8),
    [scopedAppointments, today],
  )

  const completedCount = useMemo(
    () => scopedAppointments.filter((appointment) => appointment.status === 'completed').length,
    [scopedAppointments],
  )

  const cancelledCount = useMemo(
    () => scopedAppointments.filter((appointment) => appointment.status === 'cancelled').length,
    [scopedAppointments],
  )

  const bookedValue = useMemo(
    () =>
      scopedAppointments
        .filter((appointment) => appointment.status !== 'cancelled')
        .reduce((total, appointment) => total + appointment.booking_fee, 0),
    [scopedAppointments],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <section className="rounded-2xl border border-[#ecd8c5] bg-[#fff9f4] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ead8c8] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand">
              <Store size={11} />
              Owner Inbox
            </span>
            <h1 className="mt-3 text-xl font-bold text-[#2d160b]">Appointments</h1>
          </div>
          {nextAppointment && (
            <div className="shrink-0 rounded-xl border border-[#e8d5c4] bg-white px-3 py-2.5 max-w-[160px]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9b7c69]">Next up</p>
              <p className="mt-1 text-xs font-bold text-[#2d160b] leading-snug">{nextAppointment.user_name}</p>
              <p className="text-[11px] text-[#7c6253] mt-0.5">
                {formatTimeRange(nextAppointment.slot_start, nextAppointment.slot_end)}
              </p>
            </div>
          )}
        </div>
      </section>

      {listings.length > 1 && (
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Business
          <select
            value={listingId}
            onChange={(event) => setListingId(event.target.value)}
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

      <div className="flex gap-2">
        {(['bookings', 'availability', 'schedule'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              tab === id ? 'bg-brand text-white' : 'border border-[#e5d3c2] bg-white text-[#7b6254]'
            }`}
          >
            {id === 'bookings' ? 'Bookings' : id === 'availability' ? 'Availability' : 'Schedule'}
          </button>
        ))}
      </div>

      {tab !== 'bookings' && !listingsLoading && !selectedListing && (
        <p className="rounded-2xl border border-dashed border-[#e5d3c2] p-6 text-center text-xs text-[#9b7c69]">
          Appointments are not enabled for any of your businesses yet.
        </p>
      )}

      {tab === 'availability' && selectedListing && (
        <AvailabilityTab
          key={selectedListing.id}
          listingId={selectedListing.id}
          listingName={selectedListing.name}
          rawSettings={selectedListing.appointment_settings}
          onSaved={refreshListings}
        />
      )}

      {tab === 'schedule' && selectedListing && (
        <ScheduleTab listingId={selectedListing.id} listingName={selectedListing.name} />
      )}

      {tab === 'bookings' && (
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#eee2d7] bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff3e7] text-brand mb-3">
            <Calendar size={16} />
          </div>
          <p className="text-2xl font-bold text-[#2d160b]">{todayAppointments.length}</p>
          <p className="text-[11px] text-[#9b7c69] mt-0.5 uppercase tracking-wide font-semibold">Today</p>
        </div>
        <div className="rounded-2xl border border-[#eee2d7] bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-3">
            <Clock3 size={16} />
          </div>
          <p className="text-2xl font-bold text-[#2d160b]">{upcomingAppointments.length}</p>
          <p className="text-[11px] text-[#9b7c69] mt-0.5 uppercase tracking-wide font-semibold">Upcoming</p>
        </div>
        <div className="rounded-2xl border border-[#eee2d7] bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-600 mb-3">
            <CheckCircle size={16} />
          </div>
          <p className="text-2xl font-bold text-[#2d160b]">{completedCount}</p>
          <p className="text-[11px] text-[#9b7c69] mt-0.5 uppercase tracking-wide font-semibold">Done</p>
        </div>
        <div className="rounded-2xl border border-[#eee2d7] bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-3">
            <IndianRupee size={16} />
          </div>
          <p className="text-2xl font-bold text-[#2d160b]">{formatFee(bookedValue)}</p>
          <p className="text-[11px] text-[#9b7c69] mt-0.5 uppercase tracking-wide font-semibold">Value</p>
        </div>
      </section>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {loading ? (
        tab === 'bookings' && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="mr-2 animate-spin" />
          Loading appointments...
        </div>
        )
      ) : appointments.length === 0 ? (
        tab === 'bookings' && (
        <div className="rounded-[28px] border border-[#eee2d7] bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-lg font-semibold text-[#2d160b]">No appointments yet.</p>
          <p className="mt-2 text-sm text-[#7c6253]">Once customers start booking, they will show up here.</p>
        </div>
        )
      ) : (
        <div className="space-y-8">
          {tab === 'bookings' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#2d160b]">Today</h2>
              <p className="mt-1 text-sm text-[#7c6253]">Use this section as your live operating queue.</p>
            </div>
            {todayAppointments.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#ead8c8] bg-[#fcf7f2] px-4 py-6 text-sm text-[#8c7364]">
                No appointments for today.
              </p>
            ) : (
              <div className="space-y-4">
                {todayAppointments.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    onUpdated={applyPatch}
                    onError={setErrorMessage}
                  />
                ))}
              </div>
            )}
          </section>
          )}

          {tab === 'bookings' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#2d160b]">Upcoming</h2>
              <p className="mt-1 text-sm text-[#7c6253]">Confirmed bookings that are scheduled after today.</p>
            </div>
            {upcomingAppointments.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#ead8c8] bg-[#fcf7f2] px-4 py-6 text-sm text-[#8c7364]">
                No future appointments scheduled.
              </p>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    onUpdated={applyPatch}
                    onError={setErrorMessage}
                  />
                ))}
              </div>
            )}
          </section>
          )}

          {tab === 'bookings' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#2d160b]">Recent Activity</h2>
              <p className="mt-1 text-sm text-[#7c6253]">Completed, cancelled, no-show, or already elapsed appointments.</p>
            </div>
            {recentActivity.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#ead8c8] bg-[#fcf7f2] px-4 py-6 text-sm text-[#8c7364]">
                No activity to show yet.
              </p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    onUpdated={applyPatch}
                    onError={setErrorMessage}
                  />
                ))}
              </div>
            )}
          </section>
          )}
        </div>
      )}
    </div>
  )
}
