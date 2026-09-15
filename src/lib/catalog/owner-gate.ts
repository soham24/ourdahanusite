import 'server-only'

import { getUserRole } from '@/app/actions/admin'
import { LISTING_NOT_LIVE_MESSAGE, sellingPausedMessage } from '@/lib/selling/shop-mode'
import { loadSuspensionReason } from '@/lib/selling/suspension-reasons'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

/**
 * Owners manage items on their own approved, non-suspended listings; admins
 * manage items on any listing.
 */
export async function assertListingOwner(listingId: string): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in.' }

  const { role } = await getUserRole(supabase)

  // Admins manage products on any listing (including unapproved or
  // not-yet-payments-enabled ones, e.g. during onboarding). The listings RLS
  // policy hides unapproved listings from non-owners, so use the admin
  // client for the lookup when the caller is an admin. Owners always satisfy
  // RLS via the owner_id check.
  type ListingRow = {
    id: string
    owner_id: string
    approved: boolean | null
    payments_suspended_at: string | null
  }
  let listing: ListingRow | null = null
  if (role === 'admin') {
    const adminClient = createAdminClient()
    if (!adminClient) return { ok: false, error: 'Server configuration error.' }
    const { data } = await adminClient
      .from('listings')
      .select('id, owner_id, approved, payments_suspended_at')
      .eq('id', listingId)
      .maybeSingle()
    listing = (data ?? null) as ListingRow | null
  } else {
    const { data } = await supabase
      .from('listings')
      .select('id, owner_id, approved, payments_suspended_at')
      .eq('id', listingId)
      .maybeSingle()
    listing = (data ?? null) as ListingRow | null
  }

  if (!listing) return { ok: false, error: 'Listing not found.' }

  if (listing.owner_id !== user.id && role !== 'admin') {
    return { ok: false, error: 'You do not own this listing.' }
  }

  // Owners can prepare items before connecting Razorpay; customers only see
  // them once the shop is live. Admins manage any listing.
  if (role !== 'admin') {
    if (listing.payments_suspended_at) {
      return { ok: false, error: sellingPausedMessage(await loadSuspensionReason(listingId)) }
    }
    if (!listing.approved) {
      return { ok: false, error: LISTING_NOT_LIVE_MESSAGE }
    }
  }

  return { ok: true, userId: user.id }
}
