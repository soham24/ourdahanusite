import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin-client'
import { classifyRazorpayKeyId } from '@/lib/selling/keys'

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
