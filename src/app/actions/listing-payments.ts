'use server'

import { after } from 'next/server'

import { getUserRole, requireAdmin } from '@/app/actions/admin'
import { revalidatePublicListingDetail } from '@/lib/cache-tags'
import { encryptSecret, keyIdLast4 } from '@/lib/crypto/secret'
import { sendNotification, sendNotificationToAdmins } from '@/lib/notifications'
import {
  KEY_ID_INVALID_MESSAGE,
  classifyRazorpayKeyId,
  verifyFailureMessage,
} from '@/lib/selling/keys'
import {
  LISTING_NOT_LIVE_MESSAGE,
  becameLive,
  sellingPausedMessage,
} from '@/lib/selling/shop-mode'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

/* ------------------------------------------------------------------ */
/*  Owner: connect and disconnect Razorpay                             */
/* ------------------------------------------------------------------ */

/** Verify keys work by asking Razorpay for the authenticated orders list. */
async function verifyRazorpayKeys(
  keyId: string,
  keySecret: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
  try {
    const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
      method: 'GET',
      headers: { Authorization: auth },
      cache: 'no-store',
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: verifyFailureMessage(res.status) }
  } catch {
    return { ok: false, error: verifyFailureMessage(null) }
  }
}

type SellingListing = {
  id: string
  name: string
  owner_id: string | null
  approved: boolean | null
  payments_suspended_at: string | null
  payments_suspended_reason: string | null
}

/**
 * The listing, when the signed-in user owns it or is an admin. Approval and
 * suspension are checked by the caller, because disconnecting stays allowed
 * while selling is paused.
 */
async function loadOwnedListing(
  listingId: string,
): Promise<{ listing: SellingListing } | { error: string }> {
  const supabase = await createClient()
  const { user, role } = await getUserRole(supabase)
  if (!user) return { error: 'Please sign in.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data } = await adminClient
    .from('listings')
    .select('id, name, owner_id, approved, payments_suspended_at, payments_suspended_reason')
    .eq('id', listingId)
    .maybeSingle()

  const listing = (data ?? null) as SellingListing | null
  if (!listing) return { error: 'Listing not found.' }
  if (listing.owner_id !== user.id && role !== 'admin') {
    return { error: 'You do not own this listing.' }
  }
  return { listing }
}

export async function saveRazorpayConfig(
  formData: FormData,
): Promise<{ error?: string; ok?: true; mode?: 'test' | 'live' }> {
  const listingId = String(formData.get('listing_id') ?? '').trim()
  const keyId = String(formData.get('razorpay_key_id') ?? '').trim()
  const keySecret = String(formData.get('razorpay_key_secret') ?? '').trim()

  if (!listingId) return { error: 'Listing is required.' }
  const kind = classifyRazorpayKeyId(keyId)
  if (kind === 'empty') return { error: 'Paste your Razorpay Key ID.' }
  if (kind === 'invalid') return { error: KEY_ID_INVALID_MESSAGE }
  if (!keySecret) return { error: 'Paste your Razorpay Key Secret.' }

  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return { error: owned.error }
  const { listing } = owned

  if (listing.payments_suspended_at) {
    return { error: sellingPausedMessage(listing.payments_suspended_reason) }
  }
  if (!listing.approved) return { error: LISTING_NOT_LIVE_MESSAGE }

  const verify = await verifyRazorpayKeys(keyId, keySecret)
  if (!verify.ok) return { error: verify.error }

  let ciphertext: string
  try {
    ciphertext = encryptSecret(keySecret)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Encryption failed.' }
  }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: previousData } = await adminClient
    .from('listing_payment_configs')
    .select('razorpay_key_id, verified_at')
    .eq('listing_id', listingId)
    .maybeSingle()
  const previous = (previousData ?? null) as
    | { razorpay_key_id: string; verified_at: string | null }
    | null

  const now = new Date().toISOString()
  const { error: configError } = await adminClient
    .from('listing_payment_configs')
    .upsert(
      {
        listing_id: listingId,
        razorpay_key_id: keyId,
        razorpay_key_secret_encrypted: ciphertext,
        razorpay_key_last4: keyIdLast4(keyId),
        // The key prefix decides test vs live; owners are never asked.
        test_mode: kind === 'test',
        verified_at: now,
        updated_at: now,
      },
      { onConflict: 'listing_id' },
    )
  if (configError) return { error: configError.message }

  const { error: listingError } = await adminClient
    .from('listings')
    .update({ payments_enabled: true })
    .eq('id', listingId)
  if (listingError) return { error: listingError.message }

  revalidatePublicListingDetail(listingId)

  const goesLive = becameLive(
    previous ? { keyId: previous.razorpay_key_id, verifiedAt: previous.verified_at } : null,
    keyId,
  )
  if (goesLive) {
    after(async () => {
      try {
        await sendNotificationToAdmins(
          'admin.new_submission',
          { kind: 'shop_live', title: listing.name, reviewPath: '/admin/payments' },
          { awaitDelivery: true },
        )
      } catch (error) {
        console.error('[listing-payments] shop_live notification failed', error)
      }
    })
  }

  return { ok: true, mode: kind }
}

export async function deleteRazorpayConfig(
  listingId: string,
): Promise<{ error?: string; ok?: true }> {
  const owned = await loadOwnedListing(listingId)
  if ('error' in owned) return { error: owned.error }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('listing_payment_configs')
    .delete()
    .eq('listing_id', listingId)
  if (error) return { error: error.message }

  const { error: listingError } = await adminClient
    .from('listings')
    .update({ payments_enabled: false })
    .eq('id', listingId)
  if (listingError) return { error: listingError.message }

  revalidatePublicListingDetail(listingId)
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/*  Admin: suspend and resume selling                                  */
/* ------------------------------------------------------------------ */

export async function suspendListingSelling(
  listingId: string,
  reason: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const trimmed = String(reason ?? '').trim()
  if (!trimmed) return { error: 'Add a short reason the owner will see.' }
  if (trimmed.length > 300) return { error: 'Keep the reason to 300 characters or fewer.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data, error } = await adminClient
    .from('listings')
    .update({
      payments_enabled: false,
      payments_suspended_at: new Date().toISOString(),
      payments_suspended_reason: trimmed,
    })
    .eq('id', listingId)
    .select('id, name, owner_id')
    .maybeSingle()

  if (error) return { error: error.message }
  const listing = (data ?? null) as { id: string; name: string; owner_id: string | null } | null
  if (!listing) return { error: 'Listing not found.' }

  revalidatePublicListingDetail(listingId)

  const ownerId = listing.owner_id
  if (ownerId) {
    after(async () => {
      try {
        await sendNotification(
          ownerId,
          'selling.paused',
          { listingId, listingName: listing.name, reason: trimmed, byAdmin: true },
          { awaitDelivery: true },
        )
      } catch (err) {
        console.error('[listing-payments] selling.paused notification failed', err)
      }
    })
  }

  return {}
}

export async function resumeListingSelling(listingId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: configData } = await adminClient
    .from('listing_payment_configs')
    .select('verified_at')
    .eq('listing_id', listingId)
    .maybeSingle()
  const hasVerifiedKeys = Boolean((configData as { verified_at: string | null } | null)?.verified_at)

  const { data, error } = await adminClient
    .from('listings')
    .update({
      payments_enabled: hasVerifiedKeys,
      payments_suspended_at: null,
      payments_suspended_reason: null,
    })
    .eq('id', listingId)
    .select('id, name, owner_id')
    .maybeSingle()

  if (error) return { error: error.message }
  const listing = (data ?? null) as { id: string; name: string; owner_id: string | null } | null
  if (!listing) return { error: 'Listing not found.' }

  revalidatePublicListingDetail(listingId)

  const ownerId = listing.owner_id
  if (ownerId) {
    after(async () => {
      try {
        await sendNotification(
          ownerId,
          'selling.resumed',
          { listingId, listingName: listing.name },
          { awaitDelivery: true },
        )
      } catch (err) {
        console.error('[listing-payments] selling.resumed notification failed', err)
      }
    })
  }

  return {}
}

/* ------------------------------------------------------------------ */
/*  Server-only helper for checkout: load decrypted owner keys         */
/* ------------------------------------------------------------------ */

export type OwnerRazorpayKeys = {
  keyId: string
  keySecret: string
  testMode: boolean
}

/**
 * Internal use only — NEVER return this from a server action to the client.
 *
 * `allowUnverified` is for finalising a payment Razorpay already captured:
 * the keys may have been flagged since that payment started, but the HMAC
 * check still needs the secret.
 */
export async function loadOwnerRazorpayKeys(
  listingId: string,
  options: { allowUnverified?: boolean } = {},
): Promise<OwnerRazorpayKeys | null> {
  const { decryptSecret } = await import('@/lib/crypto/secret')
  const adminClient = createAdminClient()
  if (!adminClient) return null

  const { data } = await adminClient
    .from('listing_payment_configs')
    .select('razorpay_key_id, razorpay_key_secret_encrypted, verified_at')
    .eq('listing_id', listingId)
    .maybeSingle()

  if (!data) return null
  if (!data.verified_at && !options.allowUnverified) return null

  try {
    return {
      keyId: data.razorpay_key_id,
      keySecret: decryptSecret(data.razorpay_key_secret_encrypted),
      testMode: classifyRazorpayKeyId(data.razorpay_key_id) === 'test',
    }
  } catch (e) {
    console.error('[loadOwnerRazorpayKeys] decrypt failed:', e)
    return null
  }
}
