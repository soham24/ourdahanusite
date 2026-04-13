import { Calendar, CheckCircle, Clock3, Settings } from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
import { updateAppointmentAdminSettings } from '@/app/actions/appointments'
import { normalizeAppointmentSettings } from '@/lib/listing-content'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

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

function addIndiaDays(dateString: string, days: number): string {
  const base = new Date(`${dateString}T12:00:00+05:30`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

function formatDate(dateString: string) {
  return new Date(`${dateString}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type AdminListingRow = {
  id: string
  name: string
  category: string | null
  appointments_enabled: boolean | null
  appointment_booking_fee: number | string | null
  appointment_settings: unknown
}

type UpcomingAppointmentRow = {
  id: string
  booking_date: string
  slot_start: string
  user_name: string
  listing?: { name: string | null } | null
}

export default async function AdminAppointmentsPage() {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const adminClient = createAdminClient()
  if (!adminClient) {
    throw new Error('Admin client not configured.')
  }

  const today = getIndiaToday()
  const until = addIndiaDays(today, 7)

  const [{ data: listingsData }, { data: upcomingData }] = await Promise.all([
    adminClient
      .from('listings')
      .select('id, name, category, appointments_enabled, appointment_booking_fee, appointment_settings')
      .order('name', { ascending: true }),
    adminClient
      .from('appointments')
      .select('id, booking_date, slot_start, user_name, listing:listing_id(name)')
      .gte('booking_date', today)
      .lte('booking_date', until)
      .eq('status', 'confirmed')
      .order('booking_date', { ascending: true })
      .order('slot_start', { ascending: true })
      .limit(50),
  ])

  const listings = (listingsData ?? []) as AdminListingRow[]
  const upcomingAppointments = ((upcomingData ?? []) as Array<{
    id: string
    booking_date: string
    slot_start: string
    user_name: string
    listing?: { name: string | null } | Array<{ name: string | null }> | null
  }>).map((appointment) => ({
    ...appointment,
    listing: Array.isArray(appointment.listing)
      ? (appointment.listing[0] ?? null)
      : (appointment.listing ?? null),
  })) as UpcomingAppointmentRow[]
  const enabledCount = listings.filter((listing) => listing.appointments_enabled === true).length

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Calendar size={22} className="text-warli-terra" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500">Enable appointment booking per listing and set the booking fee.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs text-gray-400">Listings with appointments enabled</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{enabledCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs text-gray-400">Upcoming bookings next 7 days</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{upcomingAppointments.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs text-gray-400">Listings with owner availability configured</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {listings.filter((listing) => !!normalizeAppointmentSettings(listing.appointment_settings)).length}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock3 size={18} className="text-warli-terra" />
          <h2 className="text-lg font-bold text-gray-900">Upcoming Appointments</h2>
        </div>

        {upcomingAppointments.length === 0 ? (
          <p className="text-sm text-gray-400">No confirmed appointments in the next 7 days.</p>
        ) : (
          <div className="space-y-3">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-gray-100 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{appointment.listing?.name ?? 'Listing'}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(appointment.booking_date)} at {appointment.slot_start.slice(0, 5)}
                  </p>
                </div>
                <p className="text-sm text-gray-700">{appointment.user_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Settings size={18} className="text-warli-terra" />
          <h2 className="text-lg font-bold text-gray-900">Per-Listing Settings</h2>
        </div>

        <div className="space-y-4">
          {listings.map((listing) => {
            const action = async (formData: FormData) => {
              'use server'
              await updateAppointmentAdminSettings(listing.id, formData)
            }
            const appointmentSettings = normalizeAppointmentSettings(listing.appointment_settings)

            return (
              <form key={listing.id} action={action} className="rounded-2xl border border-gray-100 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{listing.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{listing.category ?? 'Uncategorized'}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {listing.appointments_enabled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle size={11} />
                          Enabled
                        </span>
                      )}
                      {appointmentSettings && (
                        <span className="inline-flex items-center rounded-full bg-warli-light px-2.5 py-1 text-xs font-semibold text-warli-terra">
                          Owner settings saved
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[auto_160px_auto] gap-3 sm:items-end">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        name="appointments_enabled"
                        defaultChecked={listing.appointments_enabled === true}
                        className="rounded border-gray-300 text-warli-terra focus:ring-warli-terra"
                      />
                      Enable appointments
                    </label>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Booking Fee (Rs)</label>
                      <input
                        type="number"
                        name="appointment_booking_fee"
                        step="0.01"
                        min="0"
                        defaultValue={Number.parseFloat(String(listing.appointment_booking_fee ?? '0')) || 0}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-warli-terra text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center justify-center bg-warli-terra hover:bg-warli-deep text-warli-cream font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            )
          })}
        </div>
      </div>
    </div>
  )
}
