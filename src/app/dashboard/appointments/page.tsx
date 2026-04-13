'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  Calendar,
  CheckCircle,
  Clock3,
  IndianRupee,
  Loader2,
  MapPin,
  XCircle,
} from 'lucide-react'

import {
  cancelAppointment,
  getMyAppointments,
  type AppointmentRecord,
} from '@/app/actions/appointments'

function formatDate(dateString: string) {
  return new Date(`${dateString}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTimeRange(start: string, end: string) {
  const startLabel = new Date(`1970-01-01T${start}:00+05:30`).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
  const endLabel = new Date(`1970-01-01T${end}:00+05:30`).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
  return `${startLabel} - ${endLabel}`
}

function isFutureAppointment(appointment: AppointmentRecord): boolean {
  const appointmentDate = new Date(`${appointment.booking_date}T${appointment.slot_start}:00+05:30`)
  return appointmentDate.getTime() > Date.now()
}

function formatFee(value: number) {
  return value > 0 ? `Rs ${value.toLocaleString('en-IN')}` : 'Free'
}

function getStatusBadge(status: AppointmentRecord['status']) {
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

function AppointmentCard({
  appointment,
  onCancelled,
  onError,
}: {
  appointment: AppointmentRecord
  onCancelled: (id: string) => void
  onError: (message: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const canCancel = appointment.status === 'confirmed' && isFutureAppointment(appointment)

  return (
    <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold text-[#2d160b]">{appointment.listing?.name ?? 'Listing'}</p>
            {getStatusBadge(appointment.status)}
          </div>
          <p className="mt-2 text-sm text-[#6f584a]">
            {formatDate(appointment.booking_date)}, {formatTimeRange(appointment.slot_start, appointment.slot_end)}
          </p>
          {appointment.listing?.category && (
            <p className="mt-1 text-sm text-[#8c7364]">{appointment.listing.category}</p>
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Fee</p>
          <p className="mt-1 text-lg font-bold text-warli-terra">{formatFee(appointment.booking_fee)}</p>
        </div>
      </div>

      {canCancel && (
        <div className="mt-4 border-t border-[#f1e3d8] pt-4">
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Cancel this appointment?')) return
              startTransition(async () => {
                const result = await cancelAppointment(appointment.id)
                if (result.error) {
                  onError(result.error)
                  return
                }

                onCancelled(appointment.id)
              })
            }}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-60"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            Cancel Booking
          </button>
        </div>
      )}
    </div>
  )
}

export default function DashboardAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    getMyAppointments().then((data) => {
      setAppointments(data)
      setLoading(false)
    })
  }, [])

  const upcoming = useMemo(
    () =>
      appointments.filter(
        (appointment) => appointment.status === 'confirmed' && isFutureAppointment(appointment),
      ),
    [appointments],
  )

  const history = useMemo(
    () =>
      [...appointments]
        .filter(
          (appointment) => appointment.status !== 'confirmed' || !isFutureAppointment(appointment),
        )
        .sort((a, b) => {
          const aTime = new Date(`${a.booking_date}T${a.slot_start}:00+05:30`).getTime()
          const bTime = new Date(`${b.booking_date}T${b.slot_start}:00+05:30`).getTime()
          return bTime - aTime
        }),
    [appointments],
  )

  const nextAppointment = upcoming[0] ?? null
  const completedCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'completed').length,
    [appointments],
  )
  const cancelledCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'cancelled').length,
    [appointments],
  )
  const totalBookedValue = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.status !== 'cancelled')
        .reduce((total, appointment) => total + appointment.booking_fee, 0),
    [appointments],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[#ecd8c5] bg-gradient-to-br from-[#fff7ef] via-white to-[#f4ede4] px-6 py-7 shadow-sm lg:px-8">
        <div className="absolute -right-12 top-0 h-44 w-44 rounded-full bg-[#f4d8be] blur-3xl opacity-70" />
        <div className="absolute left-0 top-16 h-32 w-32 rounded-full bg-[#efe1d0] blur-3xl opacity-80" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#ead8c8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-warli-terra">
              <Calendar size={13} />
              Your Appointment Desk
            </span>
            <h1 className="mt-4 text-3xl font-bold text-[#2d160b]">My Appointments</h1>
            <p className="mt-3 text-sm leading-6 text-[#6f584a] sm:text-[15px]">
              Track upcoming bookings, keep a clean history of completed or cancelled visits, and manage changes from a
              single place after every booking.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/80 bg-white/85 p-5 shadow-sm lg:w-[340px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Next Appointment</p>
            {nextAppointment ? (
              <>
                <p className="mt-2 text-lg font-bold text-[#2d160b]">{nextAppointment.listing?.name ?? 'Listing'}</p>
                <p className="mt-1 text-sm text-[#6f584a]">
                  {formatDate(nextAppointment.booking_date)}, {formatTimeRange(nextAppointment.slot_start, nextAppointment.slot_end)}
                </p>
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#8a6656]">
                  <MapPin size={14} />
                  {nextAppointment.listing?.category ?? 'Business appointment'}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[#7c6253]">No future confirmed appointments right now.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-blue-700">
              <Clock3 size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Upcoming</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{upcoming.length}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Future bookings that are still confirmed.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef8f0] text-green-700">
              <CheckCircle size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Completed</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{completedCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Appointments that have already happened successfully.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2f2f2] text-gray-700">
              <XCircle size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Cancelled</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{cancelledCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Bookings you or the business cancelled.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff6e8] text-amber-700">
              <IndianRupee size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Booked Value</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{formatFee(totalBookedValue)}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Total value across non-cancelled bookings.</p>
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
          <p className="text-lg font-semibold text-[#2d160b]">You have not booked any appointments yet.</p>
          <p className="mt-2 text-sm text-[#7c6253]">Once you book a slot, it will appear here with updates and status.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#2d160b]">Upcoming</h2>
              <p className="mt-1 text-sm text-[#7c6253]">Appointments that are still active and can be cancelled.</p>
            </div>
            {upcoming.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#ead8c8] bg-[#fcf7f2] px-4 py-6 text-sm text-[#8c7364]">
                No upcoming appointments.
              </p>
            ) : (
              <div className="space-y-4">
                {upcoming.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onError={setErrorMessage}
                    onCancelled={(id) => {
                      setAppointments((current) =>
                        current.map((item) =>
                          item.id === id ? { ...item, status: 'cancelled' } : item,
                        ),
                      )
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#2d160b]">History</h2>
              <p className="mt-1 text-sm text-[#7c6253]">Completed, cancelled, no-show, or already elapsed bookings.</p>
            </div>
            {history.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#ead8c8] bg-[#fcf7f2] px-4 py-6 text-sm text-[#8c7364]">
                No appointment history yet.
              </p>
            ) : (
              <div className="space-y-4">
                {history.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onError={setErrorMessage}
                    onCancelled={() => undefined}
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
