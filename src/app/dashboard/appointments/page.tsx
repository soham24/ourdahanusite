'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Calendar, CheckCircle, Clock3, Loader2, XCircle } from 'lucide-react'

import {
  cancelAppointment,
  getMyAppointments,
  type AppointmentRecord,
} from '@/app/actions/appointments'

function formatDate(dateString: string) {
  return new Date(`${dateString}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusBadge(status: AppointmentRecord['status']) {
  if (status === 'completed') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700"><CheckCircle size={11} />Completed</span>
  }
  if (status === 'cancelled') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600"><XCircle size={11} />Cancelled</span>
  }
  if (status === 'no_show') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600"><XCircle size={11} />No Show</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700"><Clock3 size={11} />Confirmed</span>
}

function isUpcoming(appointment: AppointmentRecord): boolean {
  const appointmentDate = new Date(`${appointment.booking_date}T${appointment.slot_start}+05:30`)
  return appointmentDate.getTime() >= Date.now()
}

function AppointmentCard({
  appointment,
  onCancelled,
}: {
  appointment: AppointmentRecord
  onCancelled: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  const canCancel = appointment.status === 'confirmed' && isUpcoming(appointment)

  return (
    <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-semibold text-gray-900">{appointment.listing?.name ?? 'Listing'}</p>
            {getStatusBadge(appointment.status)}
          </div>
          <p className="text-sm text-gray-500">
            {formatDate(appointment.booking_date)} at {appointment.slot_start.slice(0, 5)} - {appointment.slot_end.slice(0, 5)}
          </p>
          {appointment.listing?.category && (
            <p className="text-xs text-gray-400 mt-1">{appointment.listing.category}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Fee</p>
          <p className="font-semibold text-warli-terra">
            {appointment.booking_fee > 0 ? `Rs ${appointment.booking_fee.toLocaleString('en-IN')}` : 'Free'}
          </p>
        </div>
      </div>

      {appointment.notes && (
        <p className="text-sm text-gray-600">{appointment.notes}</p>
      )}

      {canCancel && (
        <button
          type="button"
          onClick={() => {
            if (!window.confirm('Cancel this appointment?')) return
            startTransition(async () => {
              const result = await cancelAppointment(appointment.id)
              if (!result.error) {
                onCancelled(appointment.id)
              }
            })
          }}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          Cancel Booking
        </button>
      )}
    </div>
  )
}

export default function DashboardAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAppointments().then((data) => {
      setAppointments(data)
      setLoading(false)
    })
  }, [])

  const upcoming = useMemo(
    () => appointments.filter((appointment) => isUpcoming(appointment)),
    [appointments],
  )
  const past = useMemo(
    () => appointments.filter((appointment) => !isUpcoming(appointment)),
    [appointments],
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-warli-light flex items-center justify-center">
          <Calendar size={20} className="text-warli-terra" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-sm text-gray-500">Track confirmed, completed, and cancelled bookings.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" />
          Loading appointments...
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center">
          <p className="text-gray-400">You have not booked any appointments yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400">No upcoming appointments.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
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
            <h2 className="text-lg font-bold text-gray-900">Past</h2>
            {past.length === 0 ? (
              <p className="text-sm text-gray-400">No past appointments yet.</p>
            ) : (
              <div className="space-y-3">
                {past.map((appointment) => (
                  <AppointmentCard key={appointment.id} appointment={appointment} onCancelled={() => undefined} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
