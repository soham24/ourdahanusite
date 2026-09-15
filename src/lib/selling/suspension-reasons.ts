import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin-client'

/**
 * Admin-written suspension reasons live in listing_selling_suspensions, which
 * has RLS on, no policies and no API grants: only the service role reads it.
 * Callers must already have checked the viewer may see these listings.
 */
export async function loadSuspensionReasons(listingIds: string[]): Promise<Map<string, string>> {
  const reasons = new Map<string, string>()
  if (listingIds.length === 0) return reasons
  const adminClient = createAdminClient()
  if (!adminClient) return reasons
  const { data } = await adminClient
    .from('listing_selling_suspensions')
    .select('listing_id, reason')
    .in('listing_id', listingIds)
  for (const row of (data ?? []) as { listing_id: string; reason: string }[]) {
    reasons.set(row.listing_id, row.reason)
  }
  return reasons
}

export async function loadSuspensionReason(listingId: string): Promise<string | null> {
  return (await loadSuspensionReasons([listingId])).get(listingId) ?? null
}
