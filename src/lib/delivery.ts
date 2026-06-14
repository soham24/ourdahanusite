/**
 * Pure helpers for the quick-commerce delivery layer: distance + fee math.
 * No I/O — safe to use on server and client, and easy to unit-test.
 */

export interface DeliveryConfig {
  delivery_enabled: boolean
  radius_km: number
  base_fee_paise: number
  per_km_fee_paise: number
  free_above_paise: number | null
  min_order_paise: number
  prep_time_min: number
}

/** Great-circle distance in km between two lat/lng points (Haversine). */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371 // km
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export interface FeeQuote {
  serviceable: boolean
  reason?: 'delivery_disabled' | 'out_of_range' | 'below_min_order'
  distanceKm: number
  deliveryFeePaise: number
  grandTotalPaise: number
}

/**
 * Compute serviceability + delivery fee for a cart.
 * Fee = base + ceil(distance) * per_km, waived when items >= free_above.
 */
export function quoteDelivery(
  config: DeliveryConfig,
  pickup: { lat: number; lng: number },
  drop: { lat: number; lng: number },
  itemsTotalPaise: number,
): FeeQuote {
  const distanceKm = round2(haversineKm(pickup, drop))

  if (!config.delivery_enabled) {
    return fail('delivery_disabled', distanceKm, itemsTotalPaise)
  }
  if (distanceKm > config.radius_km) {
    return fail('out_of_range', distanceKm, itemsTotalPaise)
  }
  if (itemsTotalPaise < config.min_order_paise) {
    return fail('below_min_order', distanceKm, itemsTotalPaise)
  }

  const free = config.free_above_paise != null && itemsTotalPaise >= config.free_above_paise
  const deliveryFeePaise = free
    ? 0
    : config.base_fee_paise + Math.ceil(distanceKm) * config.per_km_fee_paise

  return {
    serviceable: true,
    distanceKm,
    deliveryFeePaise,
    grandTotalPaise: itemsTotalPaise + deliveryFeePaise,
  }
}

function fail(reason: FeeQuote['reason'], distanceKm: number, itemsTotalPaise: number): FeeQuote {
  return { serviceable: false, reason, distanceKm, deliveryFeePaise: 0, grandTotalPaise: itemsTotalPaise }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 6-digit numeric handoff OTP for delivery confirmation. */
export function generateHandoffOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}
