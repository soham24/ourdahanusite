'use server'

import { getIndiaToday } from '@/lib/india-time'
import {
  monthWindows,
  summariseListingEvents,
  type ListingEventRow,
  type ListingStats,
} from '@/lib/listing-stats'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

/** Matches PostgREST's default "Max Rows"; see the paging loop below. */
const EVENT_PAGE_SIZE = 1000

/**
 * This month's and last month's numbers for listings the caller owns.
 *
 * Ownership is re-checked here against the database rather than trusted from
 * the caller's list of ids — otherwise anyone could ask for anyone's numbers
 * by passing someone else's listing id.
 */
export async function getMyListingStats(
  listingIds: string[],
): Promise<Record<string, ListingStats> | null> {
  if (listingIds.length === 0) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const adminClient = createAdminClient()
  if (!adminClient) return null

  const { data: owned, error: ownedError } = await adminClient
    .from('listings')
    .select('id')
    .eq('owner_id', user.id)
    .in('id', listingIds)

  if (ownedError) return null

  const ownedIds = ((owned ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (ownedIds.length === 0) return {}

  const windows = monthWindows(getIndiaToday())

  // PostgREST caps a response at the project's "Max Rows" setting (1000 by
  // default) and says nothing when it truncates. An owner busy enough to
  // cross that would silently be shown an undercount — and with no ORDER BY,
  // an arbitrary subset rather than even a recent one. A wrong number here is
  // worse than no feature, so page until the table is exhausted. Ordering by
  // id keeps the pages stable; id is a unique uuid.
  const rows: ListingEventRow[] = []
  for (let from = 0; ; from += EVENT_PAGE_SIZE) {
    const { data, error } = await adminClient
      .from('listing_events')
      .select('listing_id, kind, day')
      .in('listing_id', ownedIds)
      .gte('day', windows.previousStart)
      .order('id', { ascending: true })
      .range(from, from + EVENT_PAGE_SIZE - 1)

    // A page error means the totals gathered so far are incomplete. Returning
    // them anyway would show a paying owner a real-looking but wrong number
    // ("3 views this month" when the true count is higher) — worse than
    // admitting the load failed.
    if (error) return null
    if (!data || data.length === 0) break
    rows.push(...(data as ListingEventRow[]))
    if (data.length < EVENT_PAGE_SIZE) break
  }

  return summariseListingEvents(rows, windows)
}
