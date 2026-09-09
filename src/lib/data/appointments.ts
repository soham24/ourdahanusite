import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { logCacheRegeneration } from '@/lib/isr-debug'
import {
  normalizeAppointmentSettings,
  type AppointmentSettings,
} from '@/lib/listing-content'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createPublicClient } from '@/lib/supabase/public'
import { generateAvailableSlots, type AppointmentSlot } from '@/lib/appointment-slots'
import { getOverrideMap } from '@/lib/data/appointment-overrides'

export type CachedAppointmentSettings = {
  listingId: string
  appointments_enabled: boolean
  appointment_booking_fee: number
  appointment_settings: AppointmentSettings | null
}

export type AppointmentBookingConfig = CachedAppointmentSettings & {
  listingName: string
}

type AppointmentSettingsRow = {
  id: string
  name?: string | null
  appointments_enabled: boolean | null
  appointment_booking_fee: number | string | null
  appointment_settings: unknown
}

function getAppointmentReader() {
  return createAdminClient() ?? createPublicClient()
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'))
  return Number.isFinite(parsed) ? parsed : 0
}

export async function getCachedAppointmentSettings(
  listingId: string,
): Promise<CachedAppointmentSettings | null> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.appointments)
  cacheTag(CACHE_TAGS.listing(listingId))
  logCacheRegeneration({
    scope: 'appointments:settings',
    tags: [CACHE_TAGS.appointments, CACHE_TAGS.listing(listingId)],
    detail: { listingId },
  })

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('listings')
      .select('id, appointments_enabled, appointment_booking_fee, appointment_settings')
      .eq('id', listingId)
      .eq('approved', true)
      .maybeSingle()

    const row = data as AppointmentSettingsRow | null
    if (!row) return null

    return {
      listingId: row.id,
      appointments_enabled: row.appointments_enabled === true,
      appointment_booking_fee: toNumber(row.appointment_booking_fee),
      appointment_settings: normalizeAppointmentSettings(row.appointment_settings),
    }
  } catch {
    return null
  }
}

export async function getAppointmentCountsForDate(
  listingId: string,
  bookingDate: string,
): Promise<Record<string, number>> {
  try {
    const supabase = getAppointmentReader()
    const { data } = await supabase
      .from('appointments')
      .select('slot_start')
      .eq('listing_id', listingId)
      .eq('booking_date', bookingDate)
      .eq('status', 'confirmed')

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const slotStart = typeof row.slot_start === 'string' ? row.slot_start.slice(0, 5) : ''
      if (!slotStart) continue
      counts[slotStart] = (counts[slotStart] ?? 0) + 1
    }
    return counts
  } catch {
    return {}
  }
}

export async function getLiveAppointmentBookingConfig(
  listingId: string,
): Promise<AppointmentBookingConfig | null> {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('listings')
      .select('id, name, appointments_enabled, appointment_booking_fee, appointment_settings')
      .eq('id', listingId)
      .eq('approved', true)
      .maybeSingle()

    const row = data as AppointmentSettingsRow | null
    if (!row) return null

    return {
      listingId: row.id,
      listingName: typeof row.name === 'string' ? row.name : 'Appointment',
      appointments_enabled: row.appointments_enabled === true,
      appointment_booking_fee: toNumber(row.appointment_booking_fee),
      appointment_settings: normalizeAppointmentSettings(row.appointment_settings),
    }
  } catch {
    return null
  }
}

/**
 * The one place that turns settings + a date into slots. Every caller — the
 * booking pre-check, the Razorpay order route, and the directory — goes
 * through here so they cannot disagree about whether a slot exists.
 */
export async function getSlotsForDate(
  listingId: string,
  settings: AppointmentSettings,
  bookingDate: string,
): Promise<AppointmentSlot[]> {
  const [counts, overrides] = await Promise.all([
    getAppointmentCountsForDate(listingId, bookingDate),
    getOverrideMap(listingId, bookingDate, bookingDate),
  ])

  return generateAvailableSlots(settings, bookingDate, counts, overrides[bookingDate] ?? null)
}
