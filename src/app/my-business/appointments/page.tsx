'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Calendar, CheckCircle, Clock3, Loader2, XCircle } from 'lucide-react'

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

function formatDate(dateString: string) {
  return new Date(`${dateString}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function statusBadge(status: AppointmentRecord['status']) {
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

function AppointmentRow({
  appointment,
  onUpdated,
}: {
  appointment: AppointmentRecord
  onUpdated: (id: string, patch: Partial<AppointmentRecord>) => void
}) {
  const [isPending, startTransition] = useTransition()
  const canManage = appointment.status === 'confirmed'

  const runStatusUpdate = (status: 'completed' | 'no_show') => {
    startTransition(async () => {
      const result = await updateAppointmentStatus(appointment.id, status)
      if (!result.error) {
        onUpdated(appointment.id, { status })
      }
    })
  }

  const runCancel = () => {
    const reason = window.prompt('Cancellation reason (optional):') ?? undefined
    startTransition(async () => {
      const result = await cancelAppointment(appointment.id, reason)
      if (!result.error) {
        onUpdated(appointment.id, {
          status: 'cancelled',
          cancellation_reason: reason ?? null,
        })
      }
    })
  }

  return (
    <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-semibold text-gray-900">{appointment.listing?.name ?? 'Listing'}</p>
            {statusBadge(appointment.status)}
          </div>
          <p className="text-sm text-gray-500">
            {formatDate(appointment.booking_date)} at {appointment.slot_start.slice(0, 5)} - {appointment.slot_end.slice(0, 5)}
          </p>
          <p className="text-sm text-gray-700 mt-1">
            {appointment.user_name} · {appointment.user_phone}
          </p>
          {appointment.user_email && (
            <p className="text-xs text-gray-400 mt-1">{appointment.user_email}</p>
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

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => runStatusUpdate('completed')}
            className="inline-flex items-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Mark Completed
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => runStatusUpdate('no_show')}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
          >
            <XCircle size={14} />
            Mark No Show
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={runCancel}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

export default function MyBusinessAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const today = useMemo(() => getIndiaToday(), [])

  useEffect(() => {
    getMyBusinessAppointments().then((data) => {
      setAppointments(data)
      setLoading(false)
    })
  }, [])

  const todaysAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.booking_date === today),
    [appointments, today],
  )
  const upcomingAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.booking_date > today),
    [appointments, today],
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-warli-light flex items-center justify-center">
          <Calendar size={20} className="text-warli-terra" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incoming Appointments</h1>
          <p className="text-sm text-gray-500">Manage upcoming bookings across your listings.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" />
          Loading appointments...
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center">
          <p className="text-gray-400">No appointments yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Today</h2>
            {todaysAppointments.length === 0 ? (
              <p className="text-sm text-gray-400">No appointments for today.</p>
            ) : (
              <div className="space-y-3">
                {todaysAppointments.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    onUpdated={(id, patch) => {
                      setAppointments((current) =>
                        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
                      )
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Upcoming</h2>
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-gray-400">No future appointments scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    onUpdated={(id, patch) => {
                      setAppointments((current) =>
                        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
                      )
                    }}
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
