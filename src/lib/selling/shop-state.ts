import 'server-only'

import { deriveShopMode, type ShopMode } from '@/lib/selling/shop-mode'
import { createAdminClient } from '@/lib/supabase/admin-client'

export interface ShopState {
  mode: ShopMode
  ownerId: string | null
  listingName: string
}

/**
 * Live (never cached) read of a listing's shop mode and owner, for decisions
 * that must not trust a cached page: who may open checkout and create a
 * Razorpay order. Uses the service role because payment configs have no
 * public read policy; the key secret is never selected.
 */
export async function loadShopState(listingId: string): Promise<ShopState | null> {
  const adminClient = createAdminClient()
  if (!adminClient) return null

  const [{ data: listingData }, { data: configData }] = await Promise.all([
    adminClient
      .from('listings')
      .select('name, owner_id, approved, payments_enabled, payments_suspended_at')
      .eq('id', listingId)
      .maybeSingle(),
    adminClient
      .from('listing_payment_configs')
      .select('verified_at, razorpay_key_id')
      .eq('listing_id', listingId)
      .maybeSingle(),
  ])

  const listing = (listingData ?? null) as {
    name: string
    owner_id: string | null
    approved: boolean | null
    payments_enabled: boolean | null
    payments_suspended_at: string | null
  } | null
  if (!listing) return null

  const config = (configData ?? null) as { verified_at: string | null; razorpay_key_id: string } | null

  return {
    mode: deriveShopMode({
      approved: listing.approved === true,
      paymentsEnabled: listing.payments_enabled === true,
      suspendedAt: listing.payments_suspended_at,
      verifiedAt: config?.verified_at ?? null,
      keyId: config?.razorpay_key_id ?? null,
    }),
    ownerId: listing.owner_id,
    listingName: listing.name,
  }
}
