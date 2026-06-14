'use server'

import { createClient } from '@/lib/supabase/server'
import { quoteDelivery, type DeliveryConfig, type FeeQuote } from '@/lib/delivery'

const DEFAULT_CONFIG: DeliveryConfig = {
  delivery_enabled: false,
  radius_km: 5,
  base_fee_paise: 2000,
  per_km_fee_paise: 1000,
  free_above_paise: null,
  min_order_paise: 0,
  prep_time_min: 20,
}

/** Read a listing's delivery config (public). Returns defaults if none saved. */
export async function getDeliveryConfig(listingId: string): Promise<DeliveryConfig> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('listing_delivery_config')
    .select('delivery_enabled, radius_km, base_fee_paise, per_km_fee_paise, free_above_paise, min_order_paise, prep_time_min')
    .eq('listing_id', listingId)
    .maybeSingle()
  return (data as DeliveryConfig | null) ?? DEFAULT_CONFIG
}

/** Owner-only: enable/configure delivery for a listing. RLS enforces ownership. */
export async function saveDeliveryConfig(
  formData: FormData,
): Promise<{ error?: string; ok?: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }

  const listingId = String(formData.get('listing_id') ?? '').trim()
  if (!listingId) return { error: 'Missing listing.' }

  // Verify ownership explicitly (RLS also guards the write).
  const { data: listing } = await supabase
    .from('listings')
    .select('id, owner_id')
    .eq('id', listingId)
    .maybeSingle()
  if (!listing || listing.owner_id !== user.id) return { error: 'Not your listing.' }

  const num = (key: string, fallback: number) => {
    const v = Number(formData.get(key))
    return Number.isFinite(v) ? v : fallback
  }
  const freeAboveRaw = formData.get('free_above_paise')
  const freeAbove = freeAboveRaw == null || String(freeAboveRaw).trim() === ''
    ? null
    : Math.max(0, Math.floor(Number(freeAboveRaw)))

  const { error } = await supabase
    .from('listing_delivery_config')
    .upsert({
      listing_id: listingId,
      delivery_enabled: formData.get('delivery_enabled') === 'on' || formData.get('delivery_enabled') === 'true',
      radius_km: Math.max(0.5, num('radius_km', 5)),
      base_fee_paise: Math.max(0, Math.floor(num('base_fee_paise', 2000))),
      per_km_fee_paise: Math.max(0, Math.floor(num('per_km_fee_paise', 1000))),
      free_above_paise: freeAbove,
      min_order_paise: Math.max(0, Math.floor(num('min_order_paise', 0))),
      prep_time_min: Math.max(0, Math.floor(num('prep_time_min', 20))),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'listing_id' })

  if (error) return { error: 'Could not save delivery settings.' }
  return { ok: true }
}

/**
 * Serviceability + fee quote for a drop location and cart subtotal.
 * Pure math in lib/delivery; this just loads the listing geo + config.
 */
export async function getServiceabilityQuote(
  listingId: string,
  drop: { lat: number; lng: number },
  itemsTotalPaise: number,
): Promise<{ error?: string; quote?: FeeQuote; pickup?: { lat: number; lng: number } }> {
  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, lat, lng')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing || listing.lat == null || listing.lng == null) {
    return { error: 'This business has not set its location yet.' }
  }

  const config = await getDeliveryConfig(listingId)
  const pickup = { lat: listing.lat as number, lng: listing.lng as number }
  const quote = quoteDelivery(config, pickup, drop, itemsTotalPaise)
  return { quote, pickup }
}
