import 'server-only'

import type { AppointmentDateOverride } from '@/lib/appointment-slots'
import { normalizeDayWindows } from '@/lib/listing-content'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createPublicClient } from '@/lib/supabase/public'

export type AppointmentOverrideRecord = AppointmentDateOverride & {
  id: string
  note: string | null
}

type OverrideRow = {
  id: string
  listing_id: string
  override_date: string
  closed: boolean | null
  windows: unknown
  note: string | null
}

function getOverrideReader() {
  return createAdminClient() ?? createPublicClient()
}

function toRecord(row: OverrideRow): AppointmentOverrideRecord {
  const windows = normalizeDayWindows(row.windows)
  return {
    id: row.id,
    override_date: row.override_date,
    closed: row.closed !== false,
    windows: windows.length > 0 ? windows : null,
    note: row.note,
  }
}

/**
 * Overrides are read on every slot query, so this is deliberately NOT cached
 * with `use cache` — an owner closing tomorrow must take effect immediately,
 * and the row count per business is tiny.
 */
export async function getOverridesForListing(
  listingId: string,
  fromDate: string,
  toDate: string,
): Promise<AppointmentOverrideRecord[]> {
  try {
    const supabase = getOverrideReader()
    const { data } = await supabase
      .from('appointment_date_overrides')
      .select('id, listing_id, override_date, closed, windows, note')
      .eq('listing_id', listingId)
      .gte('override_date', fromDate)
      .lte('override_date', toDate)
      .order('override_date', { ascending: true })

    return ((data ?? []) as OverrideRow[]).map(toRecord)
  } catch {
    return []
  }
}

export async function getOverrideMap(
  listingId: string,
  fromDate: string,
  toDate: string,
): Promise<Record<string, AppointmentOverrideRecord>> {
  const rows = await getOverridesForListing(listingId, fromDate, toDate)
  const map: Record<string, AppointmentOverrideRecord> = Object.create(null)
  for (const row of rows) map[row.override_date] = row
  return map
}

/** A failed directory read must not be mistaken for normal weekly opening hours. */
export async function getOverridesForListings(
  listingIds: string[],
  fromDate: string,
  toDate: string,
): Promise<Record<string, Record<string, AppointmentOverrideRecord>>> {
  const byListing: Record<string, Record<string, AppointmentOverrideRecord>> = Object.create(null)
  if (listingIds.length === 0) return byListing

  try {
    const supabase = getOverrideReader()
    const { data, error } = await supabase
      .from('appointment_date_overrides')
      .select('id, listing_id, override_date, closed, windows, note')
      .in('listing_id', listingIds)
      .gte('override_date', fromDate)
      .lte('override_date', toDate)

    if (error) throw new Error('Appointment availability is temporarily unavailable')
    for (const row of (data ?? []) as OverrideRow[]) {
      const bucket = byListing[row.listing_id] ?? (byListing[row.listing_id] = Object.create(null))
      bucket[row.override_date] = toRecord(row)
    }
  } catch {
    throw new Error('Appointment availability is temporarily unavailable')
  }

  return byListing
}

export async function listUpcomingOverrides(
  listingId: string,
  fromDate: string,
): Promise<AppointmentOverrideRecord[]> {
  return getOverridesForListing(listingId, fromDate, '2099-12-31')
}
