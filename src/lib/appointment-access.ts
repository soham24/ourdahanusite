import 'server-only'

import { getUserRole } from '@/app/actions/admin'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

/**
 * Owner-or-admin access to one listing. Appointment settings and date
 * overrides both decide when customers can book, so both are gated at the
 * same bar as editing the listing itself.
 */
export async function requireListingAccess(
  listingId: string,
): Promise<{ error: string } | { userId: string }> {
  const supabase = await createClient()
  // getUserRole does the full auth.getUser() check and returns the user.
  const { user, role } = await getUserRole(supabase)
  if (!user) return { error: 'Please sign in first.' }
  const isAdmin = role === 'admin' || role === 'moderator'

  const reader = createAdminClient() ?? supabase
  const { data: listing } = await reader
    .from('listings')
    .select('id, owner_id')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { error: 'Business not found.' }
  if (!isAdmin && listing.owner_id !== user.id) return { error: 'Access denied.' }

  return { userId: user.id }
}
