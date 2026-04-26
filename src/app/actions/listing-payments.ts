'use server'

import { getUserRole, requireAdmin } from '@/app/actions/admin'
import { revalidatePublicListingDetail } from '@/lib/cache-tags'
import { encryptSecret, keyIdLast4 } from '@/lib/crypto/secret'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

/* ------------------------------------------------------------------ */
/*  Admin: toggle payments_enabled per listing                         */
/* ------------------------------------------------------------------ */

export async function toggleListingPaymentsEnabled(
  listingId: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('listings')
    .update({ payments_enabled: enabled })
    .eq('id', listingId)

  if (error) return { error: error.message }

  revalidatePublicListingDetail(listingId)
  return {}
}

export async function updateListingPaymentsFromForm(
  listingId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const enabled = formData.get('payments_enabled') === 'on'
  return toggleListingPaymentsEnabled(listingId, enabled)
}

/* ------------------------------------------------------------------ */
/*  Owner: Razorpay key save / delete                                  */
/* ------------------------------------------------------------------ */

/** Verify keys work by asking Razorpay for the authenticated orders list. */
async function verifyRazorpayKeys(keyId: string, keySecret: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
  try {
    const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
      method: 'GET',
      headers: { Authorization: auth },
      cache: 'no-store',
    })
    if (res.status === 401) {
      return { ok: false, error: 'Razorpay rejected these credentials. Double-check Key ID and Key Secret.' }
    }
    if (!res.ok) {
      return { ok: false, error: `Razorpay verification failed (HTTP ${res.status}).` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach Razorpay. Please try again.' }
  }
}

async function ensureOwnsListing(listingId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, owner_id, payments_enabled')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }

  const { role } = await getUserRole(supabase)
  if (listing.owner_id !== user.id && role !== 'admin') {
    return { error: 'You do not own this listing.' }
  }

  if (!listing.payments_enabled) {
    return { error: 'Payments are not enabled for this listing yet. Please wait for admin approval.' }
  }

  return {}
}

export async function saveRazorpayConfig(formData: FormData): Promise<{ error?: string; ok?: true }> {
  const listingId = (formData.get('listing_id') as string)?.trim()
  const keyId = (formData.get('razorpay_key_id') as string)?.trim()
  const keySecret = (formData.get('razorpay_key_secret') as string)?.trim()
  const testMode = formData.get('test_mode') === 'on'

  if (!listingId || !keyId || !keySecret) {
    return { error: 'Listing, Key ID, and Key Secret are all required.' }
  }

  if (!keyId.startsWith('rzp_')) {
    return { error: 'Razorpay Key ID should start with "rzp_test_" or "rzp_live_".' }
  }

  const ownership = await ensureOwnsListing(listingId)
  if (ownership.error) return { error: ownership.error }

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

  const { error } = await adminClient
    .from('listing_payment_configs')
    .upsert(
      {
        listing_id: listingId,
        razorpay_key_id: keyId,
        razorpay_key_secret_encrypted: ciphertext,
        razorpay_key_last4: keyIdLast4(keyId),
        test_mode: testMode,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'listing_id' },
    )

  if (error) return { error: error.message }

  revalidatePublicListingDetail(listingId)
  return { ok: true }
}

export async function deleteRazorpayConfig(listingId: string): Promise<{ error?: string; ok?: true }> {
  const ownership = await ensureOwnsListing(listingId)
  if (ownership.error) return { error: ownership.error }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('listing_payment_configs')
    .delete()
    .eq('listing_id', listingId)

  if (error) return { error: error.message }

  revalidatePublicListingDetail(listingId)
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/*  Server-only helper for checkout: load decrypted owner keys         */
/* ------------------------------------------------------------------ */

export type OwnerRazorpayKeys = {
  keyId: string
  keySecret: string
  testMode: boolean
}

/** Internal use only — NEVER return this from a server action to the client. */
export async function loadOwnerRazorpayKeys(listingId: string): Promise<OwnerRazorpayKeys | null> {
  const { decryptSecret } = await import('@/lib/crypto/secret')
  const adminClient = createAdminClient()
  if (!adminClient) return null

  const { data } = await adminClient
    .from('listing_payment_configs')
    .select('razorpay_key_id, razorpay_key_secret_encrypted, test_mode, verified_at')
    .eq('listing_id', listingId)
    .maybeSingle()

  if (!data || !data.verified_at) return null

  try {
    return {
      keyId: data.razorpay_key_id,
      keySecret: decryptSecret(data.razorpay_key_secret_encrypted),
      testMode: !!data.test_mode,
    }
  } catch (e) {
    console.error('[loadOwnerRazorpayKeys] decrypt failed:', e)
    return null
  }
}
