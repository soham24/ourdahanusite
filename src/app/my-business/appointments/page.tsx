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
    <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold text-[#2d160b]">{appointment.listing?.name ?? 'Listing'}</p>
            {statusBadge(appointment.status)}
          </div>
          <p className="mt-2 text-sm text-[#6f584a]">
            {formatDate(appointment.booking_date)}, {formatTimeRange(appointment.slot_start, appointment.slot_end)}
          </p>
          <p className="mt-2 text-sm font-medium text-[#2d160b]">
            {appointment.user_name}, {appointment.user_phone}
          </p>
          {appointment.user_email && (
            <p className="mt-1 text-sm text-[#8c7364]">{appointment.user_email}</p>
          )}
          {appointment.notes && (
            <p className="mt-3 rounded-2xl bg-[#faf3eb] px-4 py-3 text-sm text-[#6b5547]">{appointment.notes}</p>
          )}
          {appointment.cancellation_reason && (
            <p className="mt-3 text-sm text-[#8a6656]">
              Cancellation reason: {appointment.cancellation_reason}
            </p>
          )}
        </div>

        <div className="min-w-[150px] rounded-2xl bg-[#fff7ef] px-4 py-3 text-left lg:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Booking Fee</p>
          <p className="mt-1 text-lg font-bold text-warli-terra">{formatFee(appointment.booking_fee)}</p>
        </div>
      </div>

      {(canMarkAttendance || canCancel) && (
        <div className="mt-4 border-t border-[#f1e3d8] pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-[#7b6254]">
              {canMarkAttendance
                ? 'Attendance actions are now available for this appointment.'
                : 'Attendance actions unlock after the scheduled appointment time.'}
            </p>

            <div className="flex flex-wrap gap-2">
              {canMarkAttendance && (
                <>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => runStatusUpdate('completed')}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
                  >
                    {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Mark Completed
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => runStatusUpdate('no_show')}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                  >
                    <XCircle size={14} />
                    Mark No Show
                  </button>
                </>
              )}

              {canCancel && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={runCancel}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyBusinessAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const today = useMemo(() => getIndiaToday(), [])

  useEffect(() => {
    getMyBusinessAppointments().then((data) => {
      setAppointments(data)
      setLoading(false)
    })
  }, [])

  const todayAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.booking_date === today),
    [appointments, today],
  )

  const upcomingAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) => appointment.status === 'confirmed' && appointment.booking_date > today,
      ),
    [appointments, today],
  )

  const nextAppointment = useMemo(
    () =>
      appointments.find(
        (appointment) => appointment.status === 'confirmed' && isFutureAppointment(appointment),
      ) ?? null,
    [appointments],
  )

  const recentActivity = useMemo(
    () =>
      [...appointments]
        .filter(
          (appointment) =>
            appointment.booking_date !== today &&
            (appointment.status !== 'confirmed' || !isFutureAppointment(appointment)),
        )
        .sort((a, b) => getAppointmentInstant(b).getTime() - getAppointmentInstant(a).getTime())
        .slice(0, 8),
    [appointments, today],
  )

  const completedCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'completed').length,
    [appointments],
  )

  const cancelledCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'cancelled').length,
    [appointments],
  )

  const bookedValue = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.status !== 'cancelled')
        .reduce((total, appointment) => total + appointment.booking_fee, 0),
    [appointments],
  )

  const applyPatch = (id: string, patch: Partial<AppointmentRecord>) => {
    setAppointments((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[#ecd8c5] bg-gradient-to-br from-[#fff7ef] via-white to-[#f4ede4] px-6 py-7 shadow-sm lg:px-8">
        <div className="absolute -right-12 top-0 h-44 w-44 rounded-full bg-[#f4d8be] blur-3xl opacity-70" />
        <div className="absolute left-0 top-16 h-32 w-32 rounded-full bg-[#efe1d0] blur-3xl opacity-80" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#ead8c8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-warli-terra">
              <Store size={13} />
              Owner Inbox
            </span>
            <h1 className="mt-4 text-3xl font-bold text-[#2d160b]">Incoming Appointments</h1>
            <p className="mt-3 text-sm leading-6 text-[#6f584a] sm:text-[15px]">
              Keep today under control, watch the next confirmed booking, and move finished visits into completed or
              no-show without losing the context of who booked and what they requested.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/80 bg-white/85 p-5 shadow-sm lg:w-[340px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Next Confirmed Appointment</p>
            {nextAppointment ? (
              <>
                <p className="mt-2 text-lg font-bold text-[#2d160b]">{nextAppointment.listing?.name ?? 'Listing'}</p>
                <p className="mt-1 text-sm text-[#6f584a]">
                  {formatDate(nextAppointment.booking_date)}, {formatTimeRange(nextAppointment.slot_start, nextAppointment.slot_end)}
                </p>
                <p className="mt-3 text-sm font-medium text-[#2d160b]">{nextAppointment.user_name}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[#7c6253]">No future confirmed appointments yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3e7] text-warli-terra">
              <Calendar size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Today</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{todayAppointments.length}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Appointments touching today's schedule.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-blue-700">
              <Clock3 size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Upcoming</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{upcomingAppointments.length}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Future confirmed bookings after today.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef8f0] text-green-700">
              <CheckCircle size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Completed</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{completedCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Visits already marked as completed.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff6e8] text-amber-700">
              <IndianRupee size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Booked Value</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{formatFee(bookedValue)}</p>
          <p className="mt-2 text-sm text-[#7c6253]">{cancelledCount} cancelled bookings excluded.</p>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="mr-2 animate-spin" />
          Loading appointments...
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-[28px] border border-[#eee2d7] bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-lg font-semibold text-[#2d160b]">No appointments yet.</p>
          <p className="mt-2 text-sm text-[#7c6253]">Once customers start booking, they will show up here.</p>
        </div>
      ) : (
        <div className="space-y-8">
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
        </div>
      )}
    </div>
  )
}
