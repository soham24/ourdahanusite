'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import {
  findFinalizedIntentByPaymentId,
  markIntentCaptured,
  markIntentFinalized,
} from '@/lib/payment-intents'
import { generateHandoffOtp, haversineKm, quoteDelivery, type DeliveryConfig, type FeeQuote } from '@/lib/delivery'
import { rateLimit } from '@/lib/rate-limit'

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
  // Money fields arrive in rupees from the form; store as paise.
  const rupeesToPaise = (key: string, fallback: number) =>
    Math.max(0, Math.round(num(key, fallback) * 100))
  const freeAboveRaw = formData.get('free_above_rupees')
  const freeAbove = freeAboveRaw == null || String(freeAboveRaw).trim() === ''
    ? null
    : Math.max(0, Math.round(Number(freeAboveRaw) * 100))

  const { error } = await supabase
    .from('listing_delivery_config')
    .upsert({
      listing_id: listingId,
      delivery_enabled: formData.get('delivery_enabled') === 'on' || formData.get('delivery_enabled') === 'true',
      radius_km: Math.max(0.5, num('radius_km', 5)),
      base_fee_paise: rupeesToPaise('base_fee_rupees', 20),
      per_km_fee_paise: rupeesToPaise('per_km_fee_rupees', 10),
      free_above_paise: freeAbove,
      min_order_paise: rupeesToPaise('min_order_rupees', 0),
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

// ── Cart validation + order placement ──────────────────────────────────────

export interface CartItemInput {
  productId: string
  quantity: number
}

interface ValidatedCart {
  listing: { id: string; name: string; owner_id: string; lat: number; lng: number }
  lineItems: Array<{ listing_product_id: string; name: string; price_paise: number; quantity: number; line_total_paise: number }>
  itemsTotalPaise: number
  quote: FeeQuote
  pickup: { lat: number; lng: number }
}

/**
 * Server-authoritative cart validation: never trusts client prices. Reads the
 * listing + products with the admin client, validates active/stock/ownership of
 * each line, computes totals from DB prices, and re-quotes the delivery fee.
 * Shared by the COD action and the online order-creation route.
 */
export async function validateDeliveryCart(
  listingId: string,
  items: CartItemInput[],
  drop: { lat: number; lng: number },
): Promise<{ error?: string; cart?: ValidatedCart }> {
  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }
  if (!items.length) return { error: 'Your cart is empty.' }

  const { data: listing } = await admin
    .from('listings')
    .select('id, name, owner_id, approved, lat, lng')
    .eq('id', listingId)
    .maybeSingle()
  if (!listing || !listing.approved) return { error: 'This business is not available.' }
  if (listing.lat == null || listing.lng == null) return { error: 'This business has not set its location.' }

  const qty = new Map<string, number>()
  for (const it of items) {
    const q = Math.max(1, Math.min(99, Math.floor(Number(it.quantity) || 1)))
    qty.set(it.productId, (qty.get(it.productId) ?? 0) + q)
  }

  const { data: products } = await admin
    .from('listing_products')
    .select('id, listing_id, name, price_paise, quantity_in_stock, is_active')
    .in('id', [...qty.keys()])

  const lineItems: ValidatedCart['lineItems'] = []
  let itemsTotalPaise = 0
  for (const [productId, quantity] of qty) {
    const p = (products ?? []).find((row) => row.id === productId)
    if (!p || !p.is_active || p.listing_id !== listingId) {
      return { error: 'One or more items are no longer available.' }
    }
    if (p.quantity_in_stock !== null && p.quantity_in_stock < quantity) {
      return { error: `Only ${p.quantity_in_stock} of "${p.name}" left in stock.` }
    }
    const lineTotal = p.price_paise * quantity
    itemsTotalPaise += lineTotal
    lineItems.push({ listing_product_id: p.id, name: p.name, price_paise: p.price_paise, quantity, line_total_paise: lineTotal })
  }

  const config = await getDeliveryConfig(listingId)
  const pickup = { lat: listing.lat as number, lng: listing.lng as number }
  const quote = quoteDelivery(config, pickup, drop, itemsTotalPaise)
  if (!quote.serviceable) {
    const msg = quote.reason === 'out_of_range' ? 'This address is outside the delivery area.'
      : quote.reason === 'below_min_order' ? 'Order is below the minimum for delivery.'
      : 'Delivery is not available right now.'
    return { error: msg }
  }

  return {
    cart: {
      listing: { id: listing.id, name: listing.name, owner_id: listing.owner_id, lat: pickup.lat, lng: pickup.lng },
      lineItems, itemsTotalPaise, quote, pickup,
    },
  }
}

/**
 * Place a delivery order — Cash on Delivery or online (Razorpay, finalized after
 * payment). Validates the cart server-side, verifies the payment signature for
 * online orders (idempotent on payment id), inserts the order + items,
 * decrements stock, and returns the order id + handoff OTP.
 */
export async function placeDeliveryOrder(
  formData: FormData,
): Promise<{ error?: string; orderId?: string; otp?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to order.' }

  if (!rateLimit(`delivery-order:${user.id}`, 15, 10 * 60 * 1000).ok) {
    return { error: 'Too many attempts. Please wait a moment and try again.' }
  }

  const listingId = String(formData.get('listing_id') ?? '').trim()
  const customerName = String(formData.get('customer_name') ?? '').trim()
  const customerPhone = String(formData.get('customer_phone') ?? '').trim()
  const dropAddress = String(formData.get('drop_address') ?? '').trim()
  const dropLat = Number(formData.get('drop_lat'))
  const dropLng = Number(formData.get('drop_lng'))
  const notes = String(formData.get('notes') ?? '').trim() || null
  const paymentMode = String(formData.get('payment_mode') ?? 'cod').trim() === 'online' ? 'online' : 'cod'

  if (!listingId || !customerName || !customerPhone || !dropAddress) {
    return { error: 'Please fill name, phone, and delivery address.' }
  }
  if (!Number.isFinite(dropLat) || !Number.isFinite(dropLng)) {
    return { error: 'Please drop a pin for your delivery location.' }
  }

  let items: CartItemInput[]
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'))
  } catch {
    return { error: 'Invalid cart.' }
  }

  // ── Online: verify the Razorpay signature before trusting the payment ──
  let razorpay: { orderId: string; paymentId: string; signature: string } | null = null
  if (paymentMode === 'online') {
    const orderId = String(formData.get('razorpay_order_id') ?? '').trim()
    const paymentId = String(formData.get('razorpay_payment_id') ?? '').trim()
    const signature = String(formData.get('razorpay_signature') ?? '').trim()
    if (!orderId || !paymentId || !signature) return { error: 'Payment details missing.' }

    // Idempotency: if this payment already finalized a delivery order, return it.
    const finalized = await findFinalizedIntentByPaymentId(paymentId)
    if (finalized && finalized.user_id === user.id && finalized.entity_table === 'delivery_orders') {
      return { orderId: finalized.entity_id ?? undefined }
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
    const { createHmac } = await import('crypto')
    const expected = createHmac('sha256', keySecret ?? '')
      .update(`${orderId}|${paymentId}`)
      .digest('hex')
    if (!keySecret || expected !== signature) {
      return { error: 'Payment verification failed. Please contact support.' }
    }
    razorpay = { orderId, paymentId, signature }
  }

  const { error, cart } = await validateDeliveryCart(listingId, items, { lat: dropLat, lng: dropLng })
  if (error || !cart) return { error: error ?? 'Could not validate your cart.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }

  if (razorpay) {
    await markIntentCaptured({
      razorpayOrderId: razorpay.orderId,
      razorpayPaymentId: razorpay.paymentId,
      razorpaySignature: razorpay.signature,
    })
  }

  const otp = generateHandoffOtp()
  const { data: order, error: insertError } = await admin
    .from('delivery_orders')
    .insert({
      listing_id: cart.listing.id,
      customer_id: user.id,
      status: 'placed',
      payment_mode: paymentMode,
      payment_status: paymentMode === 'online' ? 'paid' : 'pending',
      items_total_paise: cart.itemsTotalPaise,
      delivery_fee_paise: cart.quote.deliveryFeePaise,
      grand_total_paise: cart.quote.grandTotalPaise,
      customer_name: customerName,
      customer_phone: customerPhone,
      pickup_lat: cart.pickup.lat,
      pickup_lng: cart.pickup.lng,
      drop_lat: dropLat,
      drop_lng: dropLng,
      drop_address: dropAddress,
      distance_km: cart.quote.distanceKm,
      handoff_otp: otp,
      notes,
      ...(razorpay ? {
        razorpay_order_id: razorpay.orderId,
        razorpay_payment_id: razorpay.paymentId,
        razorpay_signature: razorpay.signature,
      } : {}),
    })
    .select('id')
    .single()

  if (insertError || !order) return { error: 'Could not place your order. Please try again.' }

  await admin.from('delivery_order_items').insert(
    cart.lineItems.map((li) => ({ delivery_order_id: order.id, ...li })),
  )

  // Best-effort stock decrement per line (RPC clamps at zero).
  for (const li of cart.lineItems) {
    await admin.rpc('decrement_product_stock', { p_product_id: li.listing_product_id, p_quantity: li.quantity })
  }

  if (razorpay) {
    await markIntentFinalized({
      razorpayOrderId: razorpay.orderId,
      entityId: order.id,
      entityTable: 'delivery_orders',
    })
  }

  return { orderId: order.id, otp }
}

// ── Customer order tracking ────────────────────────────────────────────────

export interface DeliveryTracking {
  id: string
  status: string
  payment_mode: 'cod' | 'online'
  grand_total_paise: number
  handoff_otp: string | null
  listing_name: string
  drop_address: string
  rated: boolean
  rider: { full_name: string; phone: string; lat: number | null; lng: number | null } | null
  riderToDropKm: number | null
}

/** Live tracking for a customer's own delivery order (status + rider location). */
export async function getDeliveryTracking(orderId: string): Promise<{ error?: string; tracking?: DeliveryTracking }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }

  const { data: order } = await admin
    .from('delivery_orders')
    .select('id, customer_id, listing_id, status, payment_mode, grand_total_paise, handoff_otp, drop_address, drop_lat, drop_lng, rider_id, rated')
    .eq('id', orderId)
    .maybeSingle()
  if (!order || order.customer_id !== user.id) return { error: 'Order not found.' }

  const { data: listing } = await admin.from('listings').select('name').eq('id', order.listing_id).maybeSingle()

  let rider: DeliveryTracking['rider'] = null
  let riderToDropKm: number | null = null
  // Only expose rider location once the order is out for the customer to track.
  if (order.rider_id && ['rider_assigned', 'picked_up', 'out_for_delivery'].includes(order.status)) {
    const { data: r } = await admin
      .from('riders').select('full_name, phone, current_lat, current_lng').eq('id', order.rider_id).maybeSingle()
    if (r) {
      rider = { full_name: r.full_name, phone: r.phone, lat: r.current_lat, lng: r.current_lng }
      const rLat = r.current_lat as number | null
      const rLng = r.current_lng as number | null
      const dLat = order.drop_lat as number | null
      const dLng = order.drop_lng as number | null
      if (rLat != null && rLng != null && dLat != null && dLng != null) {
        riderToDropKm = Math.round(haversineKm({ lat: rLat, lng: rLng }, { lat: dLat, lng: dLng }) * 10) / 10
      }
    }
  }

  return {
    tracking: {
      id: order.id,
      status: order.status,
      payment_mode: order.payment_mode,
      grand_total_paise: order.grand_total_paise,
      handoff_otp: order.handoff_otp,
      listing_name: listing?.name ?? 'Shop',
      drop_address: order.drop_address,
      rated: order.rated ?? false,
      rider,
      riderToDropKm,
    },
  }
}

/** Customer rates the rider after delivery (1–5). Recomputes the rider average. */
export async function rateDelivery(orderId: string, rating: number): Promise<{ error?: string; ok?: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }
  const stars = Math.round(Number(rating))
  if (stars < 1 || stars > 5) return { error: 'Pick 1 to 5 stars.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }

  const { data: order } = await admin
    .from('delivery_orders')
    .select('id, customer_id, status, rated, rider_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order || order.customer_id !== user.id) return { error: 'Order not found.' }
  if (order.status !== 'delivered') return { error: 'You can rate after delivery.' }
  if (order.rated) return { error: 'Already rated.' }

  await admin.from('delivery_orders').update({ rider_rating: stars, rated: true }).eq('id', orderId)

  // Recompute the rider's running average from all rated deliveries.
  if (order.rider_id) {
    const { data: rated } = await admin
      .from('delivery_orders')
      .select('rider_rating')
      .eq('rider_id', order.rider_id)
      .eq('rated', true)
      .not('rider_rating', 'is', null)
    const vals = (rated ?? []).map((r) => r.rider_rating as number)
    if (vals.length > 0) {
      const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
      await admin.from('riders').update({ rating: avg }).eq('id', order.rider_id)
    }
  }
  return { ok: true }
}

/**
 * Customer cancels their own order. Only allowed for COD orders that the shop
 * hasn't accepted yet (no money moved, no rider committed). Online/paid orders
 * route to the business for a refund.
 */
export async function cancelMyDeliveryOrder(orderId: string): Promise<{ error?: string; ok?: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }
  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }

  const { data: order } = await admin
    .from('delivery_orders')
    .select('id, customer_id, status, payment_mode')
    .eq('id', orderId)
    .maybeSingle()
  if (!order || order.customer_id !== user.id) return { error: 'Order not found.' }
  if (order.status !== 'placed') return { error: 'This order can no longer be cancelled here — please contact the shop.' }
  if (order.payment_mode !== 'cod') return { error: 'Paid orders are cancelled by the shop. Please contact them for a refund.' }

  const { error } = await admin
    .from('delivery_orders')
    .update({ status: 'cancelled', cancel_reason: 'Cancelled by customer', updated_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) return { error: 'Could not cancel.' }
  return { ok: true }
}

// ── Business-side order ops ────────────────────────────────────────────────

export type DeliveryStatus =
  | 'placed' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'rider_assigned'
  | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'delivery_failed'

// Allowed business-driven transitions. Rider-driven ones (picked_up …) live in
// the dispatch/rider actions; this guards what a shop owner can do.
const OWNER_TRANSITIONS: Record<string, DeliveryStatus[]> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['cancelled'],
}

export interface OwnerDeliveryOrder {
  id: string
  listing_id: string
  status: DeliveryStatus
  payment_mode: 'cod' | 'online'
  payment_status: string
  items_total_paise: number
  delivery_fee_paise: number
  grand_total_paise: number
  customer_name: string
  customer_phone: string
  drop_address: string
  distance_km: number | null
  notes: string | null
  created_at: string
  items: Array<{ name: string; quantity: number; line_total_paise: number }>
}

/** Orders for the signed-in owner's listings (optionally one listing). */
export async function getOwnerDeliveryOrders(listingId?: string): Promise<OwnerDeliveryOrder[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: listings } = await supabase
    .from('listings').select('id').eq('owner_id', user.id)
  const ownedIds = (listings ?? []).map((l) => l.id)
  const scope = listingId ? ownedIds.filter((id) => id === listingId) : ownedIds
  if (scope.length === 0) return []

  const { data: orders } = await supabase
    .from('delivery_orders')
    .select('id, listing_id, status, payment_mode, payment_status, items_total_paise, delivery_fee_paise, grand_total_paise, customer_name, customer_phone, drop_address, distance_km, notes, created_at')
    .in('listing_id', scope)
    .order('created_at', { ascending: false })
    .limit(100)

  const list = (orders ?? []) as Omit<OwnerDeliveryOrder, 'items'>[]
  if (list.length === 0) return []

  const { data: items } = await supabase
    .from('delivery_order_items')
    .select('delivery_order_id, name, quantity, line_total_paise')
    .in('delivery_order_id', list.map((o) => o.id))

  const byOrder = new Map<string, OwnerDeliveryOrder['items']>()
  for (const it of (items ?? []) as Array<{ delivery_order_id: string; name: string; quantity: number; line_total_paise: number }>) {
    const arr = byOrder.get(it.delivery_order_id) ?? []
    arr.push({ name: it.name, quantity: it.quantity, line_total_paise: it.line_total_paise })
    byOrder.set(it.delivery_order_id, arr)
  }

  return list.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }))
}

/** Owner moves an order through its lifecycle (accept/prepare/ready/cancel). */
export async function updateDeliveryOrderStatus(
  orderId: string,
  next: DeliveryStatus,
  reason?: string,
): Promise<{ error?: string; ok?: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }

  const { data: order } = await admin
    .from('delivery_orders')
    .select('id, status, listing_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return { error: 'Order not found.' }

  const { data: listing } = await admin
    .from('listings').select('owner_id').eq('id', order.listing_id).maybeSingle()
  if (!listing || listing.owner_id !== user.id) return { error: 'Not your order.' }

  const allowed = OWNER_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(next)) {
    return { error: `Cannot change a ${order.status} order to ${next}.` }
  }

  const patch: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() }
  if (next === 'cancelled') patch.cancel_reason = (reason ?? 'Cancelled by business').slice(0, 300)

  const { error } = await admin.from('delivery_orders').update(patch).eq('id', orderId)
  if (error) return { error: 'Could not update the order.' }

  // When an order is marked ready, kick off sequential rider dispatch.
  if (next === 'ready_for_pickup') {
    const { findAndOfferRider } = await import('@/app/actions/dispatch')
    await findAndOfferRider(orderId)
  }
  return { ok: true }
}
