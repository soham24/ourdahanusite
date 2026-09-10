import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { generateAvailableSlots } from '@/lib/appointment-slots'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { PUBLIC_CONTENT_CACHE } from '@/lib/cache-policy'
import { getOverridesForListings } from '@/lib/data/appointment-overrides'
import { addIndiaDays, getIndiaToday } from '@/lib/india-time'
import { logCacheRegeneration } from '@/lib/isr-debug'
import { normalizeAppointmentSettings, type AppointmentSettings } from '@/lib/listing-content'
import { createPublicClient } from '@/lib/supabase/public'

/**
 * How many days forward the directory looks for a free slot. Capped so a
 * business with advance_days: 90 cannot make this page 90x more expensive
 * than its neighbours.
 */
const DIRECTORY_LOOKAHEAD_DAYS = 14
const SLOTS_SHOWN = 3

export type AppointmentDirectorySlot = { date: string; start: string }

export type AppointmentDirectoryEntry = {
  listingId: string
  name: string
  subdomain: string | null
  category: string | null
  imageUrl: string | null
  bookingFee: number
  nextSlots: AppointmentDirectorySlot[]
  hasAvailability: boolean
}

type BookableRow = {
  id: string
  name: string
  subdomain: string | null
  category: string | null
  image_thumb_url: string | null
  image_url: string | null
  appointment_booking_fee: number | string | null
  appointment_settings: unknown
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'))
  return Number.isFinite(parsed) ? parsed : 0
}

async function fetchBookableRows(): Promise<BookableRow[]> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('listings')
    .select(
      'id, name, subdomain, category, image_thumb_url, image_url, appointment_booking_fee, appointment_settings',
    )
    .eq('approved', true)
    .eq('appointments_enabled', true)
    .order('name', { ascending: true })

  return (data ?? []) as BookableRow[]
}

export async function getAppointmentDirectory(): Promise<AppointmentDirectoryEntry[]> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.appointments)
  logCacheRegeneration({ scope: 'appointments:directory', tags: [CACHE_TAGS.appointments] })

  const rows = await fetchBookableRows()
  if (rows.length === 0) return []

  const today = getIndiaToday()
  const horizon = addIndiaDays(today, DIRECTORY_LOOKAHEAD_DAYS)
  const listingIds = rows.map((row) => row.id)

  const supabase = createPublicClient()
  const [{ data: bookings }, overridesByListing] = await Promise.all([
    supabase
      .from('appointments')
      .select('listing_id, booking_date, slot_start')
      .in('listing_id', listingIds)
      .eq('status', 'confirmed')
      .gte('booking_date', today)
      .lte('booking_date', horizon),
    getOverridesForListings(listingIds, today, horizon),
  ])

  // listingId -> date -> "HH:MM" -> count
  const counts: Record<string, Record<string, Record<string, number>>> = Object.create(null)
  for (const row of (bookings ?? []) as Array<{
    listing_id: string
    booking_date: string
    slot_start: string
  }>) {
    const byDate = counts[row.listing_id] ?? (counts[row.listing_id] = Object.create(null))
    const bySlot = byDate[row.booking_date] ?? (byDate[row.booking_date] = Object.create(null))
    const start = row.slot_start.slice(0, 5)
    bySlot[start] = (bySlot[start] ?? 0) + 1
  }

  const entries: AppointmentDirectoryEntry[] = rows.map((row) => {
    const settings: AppointmentSettings | null = normalizeAppointmentSettings(row.appointment_settings)
    const nextSlots: AppointmentDirectorySlot[] = []

    if (settings) {
      const days = Math.min(settings.advance_days, DIRECTORY_LOOKAHEAD_DAYS)
      for (let offset = 0; offset <= days && nextSlots.length < SLOTS_SHOWN; offset += 1) {
        const date = addIndiaDays(today, offset)
        const slots = generateAvailableSlots(
          settings,
          date,
          counts[row.id]?.[date] ?? {},
          overridesByListing[row.id]?.[date] ?? null,
        )
        for (const slot of slots) {
          if (!slot.available) continue
          nextSlots.push({ date, start: slot.start })
          if (nextSlots.length === SLOTS_SHOWN) break
        }
      }
    }

    return {
      listingId: row.id,
      name: row.name,
      subdomain: row.subdomain,
      category: row.category,
      imageUrl: row.image_thumb_url || row.image_url || null,
      bookingFee: toNumber(row.appointment_booking_fee),
      nextSlots,
      hasAvailability: nextSlots.length > 0,
    }
  })

  // Businesses with nothing free sort last but are never hidden — a clinic that
  // forgot to set its hours must stay visible, or nobody finds out.
  return entries.sort((a, b) => {
    if (a.hasAvailability !== b.hasAvailability) return a.hasAvailability ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export type BookableListing = {
  id: string
  name: string
  subdomain: string | null
  category: string | null
  bookingFee: number
  settings: AppointmentSettings
}

export async function getBookableListingBySubdomain(
  subdomain: string,
): Promise<BookableListing | null> {
  'use cache'

  cacheLife(PUBLIC_CONTENT_CACHE)
  cacheTag(CACHE_TAGS.appointments)

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('listings')
    .select('id, name, subdomain, category, appointment_booking_fee, appointment_settings')
    .eq('subdomain', subdomain)
    .eq('approved', true)
    .eq('appointments_enabled', true)
    .maybeSingle()

  const row = data as BookableRow | null
  if (!row) return null

  const settings = normalizeAppointmentSettings(row.appointment_settings)
  if (!settings) return null

  return {
    id: row.id,
    name: row.name,
    subdomain: row.subdomain,
    category: row.category,
    bookingFee: toNumber(row.appointment_booking_fee),
    settings,
  }
}
