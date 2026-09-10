import {
  CheckCircle,
  Clock3,
  IndianRupee,
  Settings,
  Sparkles,
  Store,
  Users,
} from 'lucide-react'

import { requireAdmin } from '@/app/actions/admin'
import { updateAppointmentAdminSettings } from '@/app/actions/appointments'
import { addIndiaDays, getIndiaToday } from '@/lib/india-time'
import {
  normalizeAppointmentSettings,
  type AppointmentSettings,
} from '@/lib/listing-content'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

function formatDate(dateString: string) {
  return new Date(`${dateString}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function parseFee(value: number | string | null): number {
  const parsed = Number.parseFloat(String(value ?? '0'))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatFee(value: number): string {
  return value > 0 ? `Rs ${value.toLocaleString('en-IN')}` : 'Free'
}

function summarizeAvailability(settings: AppointmentSettings | null) {
  if (!settings) {
    return {
      openDays: 0,
      label: 'Owner has not saved availability yet.',
    }
  }

  const openDays = Object.values(settings.availability).filter((windows) => windows.length > 0).length
  return {
    openDays,
    label: `${openDays} open day${openDays === 1 ? '' : 's'} • ${settings.slot_duration} min slots • capacity ${settings.capacity}`,
  }
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

  const [{ data: listingsData }, { data: upcomingData }, { count: upcomingCount }] = await Promise.all([
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
      .limit(8),
    adminClient
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .gte('booking_date', today)
      .lte('booking_date', until)
      .eq('status', 'confirmed'),
  ])

  const listings = (listingsData ?? []) as AdminListingRow[]
  const listingCards = listings
    .map((listing) => {
      const settings = normalizeAppointmentSettings(listing.appointment_settings)
      const fee = parseFee(listing.appointment_booking_fee)
      const availability = summarizeAvailability(settings)

      return {
        ...listing,
        fee,
        settings,
        availability,
        isEnabled: listing.appointments_enabled === true,
      }
    })
    .sort((a, b) => Number(b.isEnabled) - Number(a.isEnabled) || a.name.localeCompare(b.name))

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

  const totalListings = listingCards.length
  const enabledCount = listingCards.filter((listing) => listing.isEnabled).length
  const configuredCount = listingCards.filter((listing) => !!listing.settings).length
  const paidCount = listingCards.filter((listing) => listing.isEnabled && listing.fee > 0).length
  const enableRate = totalListings > 0 ? Math.round((enabledCount / totalListings) * 100) : 0
  const upcomingTotal = upcomingCount ?? upcomingAppointments.length

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[30px] border border-[#ecd8c5] bg-gradient-to-br from-[#34160a] via-[#4b2210] to-[#8a4b26] px-6 py-7 text-bg shadow-[0_24px_60px_rgba(61,26,8,0.22)] lg:px-8">
        <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute left-0 top-16 h-40 w-40 rounded-full bg-[#d28b5f]/30 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#f6dfca]">
              <Sparkles size={13} />
              Appointment Control Center
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Appointments</h1>
            <p className="mt-3 text-sm leading-6 text-[#f2d6c0] sm:text-[15px]">
              Manage rollout across listings, watch the next seven days of demand, and spot which businesses still
              need owner-side availability setup before appointments can go live cleanly.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8c8af]">Coverage</p>
              <p className="mt-1 text-2xl font-bold">{enableRate}%</p>
              <p className="mt-1 text-sm text-[#f2d6c0]">{enabledCount} of {totalListings} listings enabled</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8c8af]">Next 7 Days</p>
              <p className="mt-1 text-2xl font-bold">{upcomingTotal}</p>
              <p className="mt-1 text-sm text-[#f2d6c0]">confirmed bookings in pipeline</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3e7] text-brand">
              <Store size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Enabled</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{enabledCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Listings currently accepting appointment bookings.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef8f0] text-green-700">
              <CheckCircle size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Configured</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{configuredCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Owners who have already saved availability settings.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff6e8] text-amber-700">
              <IndianRupee size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Paid</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{paidCount}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Enabled listings charging a booking fee right now.</p>
        </div>

        <div className="rounded-[24px] border border-[#eee2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-blue-700">
              <Users size={20} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Demand</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-[#2d160b]">{upcomingTotal}</p>
          <p className="mt-2 text-sm text-[#7c6253]">Confirmed bookings arriving in the next seven days.</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
        <div className="rounded-[28px] border border-[#eee2d7] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock3 size={18} className="text-brand" />
            <h2 className="text-lg font-bold text-[#2d160b]">Upcoming Appointments</h2>
          </div>
          <p className="mt-2 text-sm text-[#7c6253]">
            A live preview of confirmed bookings over the next week.
          </p>

          {upcomingAppointments.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#ead8c8] bg-[#fcf7f2] px-4 py-8 text-center text-sm text-[#8c7364]">
              No confirmed appointments in the next 7 days.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {upcomingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="rounded-2xl border border-[#f0e3d7] bg-[#fffaf5] px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#2d160b]">
                        {appointment.listing?.name ?? 'Listing'}
                      </p>
                      <p className="mt-1 text-xs text-[#866d5f]">
                        {formatDate(appointment.booking_date)} at {appointment.slot_start.slice(0, 5)}
                      </p>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#6f584a]">
                      {appointment.user_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-[#eee2d7] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-brand" />
            <h2 className="text-lg font-bold text-[#2d160b]">Per-Listing Controls</h2>
          </div>
          <p className="mt-2 text-sm text-[#7c6253]">
            Enable bookings, set fees, and verify whether the owner has actually prepared availability.
          </p>

          <div className="mt-5 space-y-4">
            {listingCards.map((listing) => {
              const action = async (formData: FormData) => {
                'use server'
                await updateAppointmentAdminSettings(listing.id, formData)
              }

              return (
                <form
                  key={listing.id}
                  action={action}
                  className="rounded-[24px] border border-[#efe2d6] bg-[#fffdfb] p-5"
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-bold text-[#2d160b]">{listing.name}</p>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              listing.isEnabled
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {listing.isEnabled ? 'Live' : 'Disabled'}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-[#f7eee5] px-3 py-1 text-xs font-semibold text-brand">
                            {formatFee(listing.fee)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-[#8b7264]">{listing.category ?? 'Uncategorized'}</p>
                        <p className="mt-3 text-sm text-[#6f584a]">{listing.availability.label}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[auto_170px_auto] sm:items-end">
                        <label className="inline-flex items-center gap-2 rounded-xl border border-[#e9d7c8] bg-white px-3 py-2 text-sm font-medium text-gray-700">
                          <input
                            type="checkbox"
                            name="appointments_enabled"
                            defaultChecked={listing.isEnabled}
                            className="rounded border-gray-300 text-brand focus:ring-brand"
                          />
                          Enable appointments
                        </label>

                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">
                            Booking Fee
                          </label>
                          <input
                            type="number"
                            name="appointment_booking_fee"
                            step="0.01"
                            min="0"
                            defaultValue={listing.fee}
                            className="w-full rounded-xl border border-[#dfcdbd] bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-brand focus:outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-[#f8efe7] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Open Days</p>
                        <p className="mt-1 text-base font-bold text-[#2d160b]">{listing.availability.openDays}</p>
                      </div>
                      <div className="rounded-2xl bg-[#f8efe7] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Slot Length</p>
                        <p className="mt-1 text-base font-bold text-[#2d160b]">
                          {listing.settings ? `${listing.settings.slot_duration} min` : 'Not set'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#f8efe7] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">Capacity</p>
                        <p className="mt-1 text-base font-bold text-[#2d160b]">
                          {listing.settings ? `${listing.settings.capacity} / slot` : 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>
                </form>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
