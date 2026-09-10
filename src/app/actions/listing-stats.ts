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

/**
 * This month's and last month's numbers for listings the caller owns.
 *
 * Ownership is re-checked here against the database rather than trusted from
 * the caller's list of ids — otherwise anyone could ask for anyone's numbers
 * by passing someone else's listing id.
 */
export async function getMyListingStats(
  listingIds: string[],
): Promise<Record<string, ListingStats>> {
  if (listingIds.length === 0) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const adminClient = createAdminClient()
  if (!adminClient) return {}

  const { data: owned } = await adminClient
    .from('listings')
    .select('id')
    .eq('owner_id', user.id)
    .in('id', listingIds)

  const ownedIds = ((owned ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (ownedIds.length === 0) return {}

  const windows = monthWindows(getIndiaToday())

  const { data } = await adminClient
    .from('listing_events')
    .select('listing_id, kind, day')
    .in('listing_id', ownedIds)
    .gte('day', windows.previousStart)

  return summariseListingEvents((data ?? []) as ListingEventRow[], windows)
}
