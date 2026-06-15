'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { haversineKm } from '@/lib/delivery'

/**
 * Sequential auto-dispatch: offer a ready order to the single nearest eligible
 * rider (the business's own riders first, then the platform pool). On decline or
 * timeout the next-nearest is offered. Returns the offered rider id, or null
 * when no eligible rider remains (→ manual fallback).
 */
export async function findAndOfferRider(orderId: string): Promise<{ offeredRiderId: string | null }> {
  const admin = createAdminClient()
  if (!admin) return { offeredRiderId: null }

  const { data: order } = await admin
    .from('delivery_orders')
    .select('id, listing_id, status, rider_id, pickup_lat, pickup_lng')
    .eq('id', orderId)
    .maybeSingle()
  // Only dispatch an unassigned, ready order.
  if (!order || order.rider_id || order.status !== 'ready_for_pickup') return { offeredRiderId: null }
  if (order.pickup_lat == null || order.pickup_lng == null) return { offeredRiderId: null }

  // Riders already offered this order (any outcome) are skipped.
  const { data: prior } = await admin
    .from('rider_assignments')
    .select('rider_id')
    .eq('delivery_order_id', orderId)
  const seen = new Set((prior ?? []).map((p) => p.rider_id))

  const { data: riders } = await admin
    .from('riders')
    .select('id, home_business_id, current_lat, current_lng')
    .eq('status', 'approved')
    .eq('is_online', true)
    .not('current_lat', 'is', null)
    .not('current_lng', 'is', null)

  const pickup = { lat: order.pickup_lat as number, lng: order.pickup_lng as number }
  const candidates = (riders ?? [])
    .filter((r) => !seen.has(r.id))
    .map((r) => ({
      id: r.id,
      own: r.home_business_id === order.listing_id,
      dist: haversineKm(pickup, { lat: r.current_lat as number, lng: r.current_lng as number }),
    }))
    // Business's own riders first, then nearest.
    .sort((a, b) => (a.own === b.own ? a.dist - b.dist : a.own ? -1 : 1))

  const next = candidates[0]
  if (!next) return { offeredRiderId: null }

  await admin.from('rider_assignments').insert({
    delivery_order_id: orderId,
    rider_id: next.id,
    status: 'offered',
  })
  return { offeredRiderId: next.id }
}

async function myRiderId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('riders').select('id').eq('user_id', user.id).maybeSingle()
  return data?.id ?? null
}

export interface RiderOffer {
  delivery_order_id: string
  listing_name: string
  drop_address: string
  distance_km: number | null
  delivery_fee_paise: number
  grand_total_paise: number
  payment_mode: 'cod' | 'online'
  item_count: number
}

/** Live offers + the rider's currently-assigned (active) delivery. */
export async function getRiderWork(): Promise<{ offers: RiderOffer[]; active: RiderActive | null }> {
  const riderId = await myRiderId()
  if (!riderId) return { offers: [], active: null }
  const admin = createAdminClient()
  if (!admin) return { offers: [], active: null }

  // Pending offers
  const { data: offered } = await admin
    .from('rider_assignments')
    .select('delivery_order_id')
    .eq('rider_id', riderId)
    .eq('status', 'offered')
  const offerIds = (offered ?? []).map((o) => o.delivery_order_id)

  const offers: RiderOffer[] = []
  if (offerIds.length > 0) {
    const rows = await loadOrdersForRider(admin, offerIds)
    offers.push(...rows)
  }

  // Active assignment
  const { data: activeOrder } = await admin
    .from('delivery_orders')
    .select('id, listing_id, status, drop_address, drop_lat, drop_lng, customer_name, customer_phone, payment_mode, grand_total_paise, delivery_fee_paise')
    .eq('rider_id', riderId)
    .in('status', ['rider_assigned', 'picked_up', 'out_for_delivery'])
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let active: RiderActive | null = null
  if (activeOrder) {
    const { data: l } = await admin.from('listings').select('name').eq('id', activeOrder.listing_id).maybeSingle()
    active = {
      delivery_order_id: activeOrder.id,
      status: activeOrder.status,
      listing_name: l?.name ?? 'Shop',
      drop_address: activeOrder.drop_address,
      customer_name: activeOrder.customer_name,
      customer_phone: activeOrder.customer_phone,
      payment_mode: activeOrder.payment_mode,
      grand_total_paise: activeOrder.grand_total_paise,
      delivery_fee_paise: activeOrder.delivery_fee_paise,
    }
  }
  return { offers, active }
}

export interface RiderActive {
  delivery_order_id: string
  status: string
  listing_name: string
  drop_address: string
  customer_name: string
  customer_phone: string
  payment_mode: 'cod' | 'online'
  grand_total_paise: number
  delivery_fee_paise: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadOrdersForRider(admin: any, ids: string[]): Promise<RiderOffer[]> {
  const { data: orders } = await admin
    .from('delivery_orders')
    .select('id, listing_id, drop_address, distance_km, delivery_fee_paise, grand_total_paise, payment_mode')
    .in('id', ids)
  const { data: names } = await admin
    .from('listings')
    .select('id, name')
    .in('id', [...new Set((orders ?? []).map((o: { listing_id: string }) => o.listing_id))])
  const { data: itemCounts } = await admin
    .from('delivery_order_items')
    .select('delivery_order_id')
    .in('delivery_order_id', ids)
  const nameById = new Map((names ?? []).map((n: { id: string; name: string }) => [n.id, n.name]))
  const countById = new Map<string, number>()
  for (const it of (itemCounts ?? []) as { delivery_order_id: string }[]) {
    countById.set(it.delivery_order_id, (countById.get(it.delivery_order_id) ?? 0) + 1)
  }
  return (orders ?? []).map((o: {
    id: string; listing_id: string; drop_address: string; distance_km: number | null
    delivery_fee_paise: number; grand_total_paise: number; payment_mode: 'cod' | 'online'
  }) => ({
    delivery_order_id: o.id,
    listing_name: nameById.get(o.listing_id) ?? 'Shop',
    drop_address: o.drop_address,
    distance_km: o.distance_km,
    delivery_fee_paise: o.delivery_fee_paise,
    grand_total_paise: o.grand_total_paise,
    payment_mode: o.payment_mode,
    item_count: countById.get(o.id) ?? 0,
  }))
}

/** Rider accepts an offer (atomic claim via RPC). */
export async function acceptDeliveryOffer(orderId: string): Promise<{ error?: string; ok?: true }> {
  const riderId = await myRiderId()
  if (!riderId) return { error: 'Not a rider.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accept_delivery_offer', { p_order_id: orderId, p_rider_id: riderId })
  if (error) return { error: 'Could not accept the offer.' }
  if (data !== true) return { error: 'This order was already taken.' }
  return { ok: true }
}

/** Rider declines an offer → cascade to the next-nearest rider. */
export async function declineDeliveryOffer(orderId: string): Promise<{ ok?: true }> {
  const riderId = await myRiderId()
  if (!riderId) return { ok: true }
  const admin = createAdminClient()
  if (admin) {
    await admin
      .from('rider_assignments')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('delivery_order_id', orderId)
      .eq('rider_id', riderId)
      .eq('status', 'offered')
  }
  await findAndOfferRider(orderId)
  return { ok: true }
}

/** Rider marks the order picked up from the shop. */
export async function riderMarkPickedUp(orderId: string): Promise<{ error?: string; ok?: true }> {
  return riderTransition(orderId, ['rider_assigned'], { status: 'picked_up', picked_up_at: new Date().toISOString() })
}

/** Rider marks themselves en route. */
export async function riderMarkOutForDelivery(orderId: string): Promise<{ error?: string; ok?: true }> {
  return riderTransition(orderId, ['picked_up'], { status: 'out_for_delivery' })
}

/** Rider completes delivery — verifies the customer handoff OTP, then settles ledgers. */
export async function riderMarkDelivered(orderId: string, otp: string): Promise<{ error?: string; ok?: true }> {
  const riderId = await myRiderId()
  if (!riderId) return { error: 'Not a rider.' }
  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }

  const { data: order } = await admin
    .from('delivery_orders')
    .select('id, rider_id, status, handoff_otp, payment_mode, grand_total_paise, delivery_fee_paise')
    .eq('id', orderId)
    .maybeSingle()
  if (!order || order.rider_id !== riderId) return { error: 'Not your delivery.' }
  if (!['picked_up', 'out_for_delivery'].includes(order.status)) return { error: 'Order is not out for delivery.' }
  if ((otp ?? '').trim() !== order.handoff_otp) return { error: 'Incorrect delivery OTP.' }

  await admin.from('delivery_orders')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      // COD becomes paid on handoff; online was already paid at checkout.
      ...(order.payment_mode === 'cod' ? { payment_status: 'paid' } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  // Ledger: rider earns the delivery fee; COD cash is owed to the business.
  await admin.from('rider_earnings').insert({ rider_id: riderId, delivery_order_id: orderId, amount_paise: order.delivery_fee_paise, status: 'pending' })
  if (order.payment_mode === 'cod') {
    await admin.from('cod_collections').insert({ delivery_order_id: orderId, rider_id: riderId, amount_paise: order.grand_total_paise, settled: false })
  }
  return { ok: true }
}

async function riderTransition(
  orderId: string,
  from: string[],
  patch: Record<string, unknown>,
): Promise<{ error?: string; ok?: true }> {
  const riderId = await myRiderId()
  if (!riderId) return { error: 'Not a rider.' }
  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }
  const { data: order } = await admin.from('delivery_orders').select('id, rider_id, status').eq('id', orderId).maybeSingle()
  if (!order || order.rider_id !== riderId) return { error: 'Not your delivery.' }
  if (!from.includes(order.status)) return { error: 'Invalid step.' }
  const { error } = await admin.from('delivery_orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', orderId)
  if (error) return { error: 'Could not update.' }
  return { ok: true }
}
