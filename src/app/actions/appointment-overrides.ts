'use server'

import { getUserRole } from '@/app/actions/admin'
import { findOverrideConflicts } from '@/lib/appointment-conflicts'
import { revalidateAppointmentsCache } from '@/lib/cache-tags'
import {
  listUpcomingOverrides,
  type AppointmentOverrideRecord,
} from '@/lib/data/appointment-overrides'
import {
  normalizeDayWindows,
  normalizeInlineText,
  type AppointmentDayWindow,
} from '@/lib/listing-content'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export type OverrideConflict = {
  id: string
  slot_start: string
  user_name: string
}

export type SaveOverrideInput = {
  listingId: string
  overrideDate: string
  closed: boolean
  windows: AppointmentDayWindow[] | null
  note: string | null
  resolution?: 'cancel_conflicts' | 'keep_conflicts'
}

export type SaveOverrideResult = {
  error?: string
  conflicts?: OverrideConflict[]
  saved?: boolean
}

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

/**
 * Owner-or-admin access to one listing. Overrides change when customers can
 * book, so this is the same bar as editing the listing itself.
 */
async function requireListingAccess(listingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in first.' as const }

  const { role } = await getUserRole(supabase)
  const isAdmin = role === 'admin' || role === 'moderator'

  const reader = createAdminClient() ?? supabase
  const { data: listing } = await reader
    .from('listings')
    .select('id, owner_id')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { error: 'Business not found.' as const }
  if (!isAdmin && listing.owner_id !== user.id) return { error: 'Access denied.' as const }

  return { userId: user.id }
}

export async function getUpcomingOverrides(
  listingId: string,
): Promise<{ error?: string; overrides: AppointmentOverrideRecord[] }> {
  const access = await requireListingAccess(listingId)
  if ('error' in access) return { error: access.error, overrides: [] }

  return { overrides: await listUpcomingOverrides(listingId, getIndiaToday()) }
}

export async function saveAppointmentDateOverride(
  input: SaveOverrideInput,
): Promise<SaveOverrideResult> {
  const access = await requireListingAccess(input.listingId)
  if ('error' in access) return { error: access.error }

  if (!DATE_REGEX.test(input.overrideDate)) {
    return { error: 'Please choose a valid date.' }
  }
  if (input.overrideDate < getIndiaToday()) {
    return { error: 'Choose today or a future date.' }
  }

  const windows = input.closed ? null : normalizeDayWindows(input.windows)
  if (!input.closed && (!windows || windows.length === 0)) {
    return { error: 'Add at least one time window, or mark the day closed.' }
  }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: existing } = await adminClient
    .from('appointments')
    .select('id, slot_start, status, user_name')
    .eq('listing_id', input.listingId)
    .eq('booking_date', input.overrideDate)

  const candidates = (existing ?? []) as Array<{
    id: string
    slot_start: string
    status: string
    user_name: string
  }>

  const conflictIds = findOverrideConflicts(candidates, {
    closed: input.closed,
    windows: windows ?? null,
  })

  // First call reports the conflicts and changes nothing. The owner decides,
  // then calls again with a resolution.
  if (conflictIds.length > 0 && !input.resolution) {
    const byId = new Map(candidates.map((row) => [row.id, row]))
    return {
      conflicts: conflictIds.map((id) => {
        const row = byId.get(id)
        return {
          id,
          slot_start: (row?.slot_start ?? '').slice(0, 5),
          user_name: row?.user_name ?? 'Customer',
        }
      }),
    }
  }

  const { error: upsertError } = await adminClient
    .from('appointment_date_overrides')
    .upsert(
      {
        listing_id: input.listingId,
        override_date: input.overrideDate,
        closed: input.closed,
        windows: windows,
        note: normalizeInlineText(input.note ?? '', 80),
      },
      { onConflict: 'listing_id,override_date' },
    )

  if (upsertError) return { error: upsertError.message }

  // The override is saved from here on. Anything that fails after this point
  // leaves the schedule genuinely changed, so the cache must be refreshed and
  // the message must say what actually happened — telling the owner "failed"
  // while the day is really closed is worse than telling them the truth.
  if (conflictIds.length > 0 && input.resolution === 'cancel_conflicts') {
    const { error: cancelError } = await adminClient
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_by: 'owner',
        cancellation_reason: 'Business closed this date',
      })
      .in('id', conflictIds)

    if (cancelError) {
      revalidateAppointmentsCache(input.listingId)
      return {
        error:
          'The date was saved, but the existing bookings on it could not be cancelled. ' +
          'Please cancel them from the Bookings tab and contact those customers.',
      }
    }
  }

  revalidateAppointmentsCache(input.listingId)
  return { saved: true }
}

export async function deleteAppointmentDateOverride(
  overrideId: string,
): Promise<{ error?: string }> {
  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: row } = await adminClient
    .from('appointment_date_overrides')
    .select('id, listing_id')
    .eq('id', overrideId)
    .maybeSingle()

  if (!row) return { error: 'That date is no longer in your schedule.' }

  const access = await requireListingAccess(row.listing_id as string)
  if ('error' in access) return { error: access.error }

  const { error } = await adminClient
    .from('appointment_date_overrides')
    .delete()
    .eq('id', overrideId)

  if (error) return { error: error.message }

  revalidateAppointmentsCache(row.listing_id as string)
  return {}
}
