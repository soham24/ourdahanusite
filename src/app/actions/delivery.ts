'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { generateHandoffOtp, quoteDelivery, type DeliveryConfig, type FeeQuote } from '@/lib/delivery'

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
 * Place a CASH-ON-DELIVERY delivery order. Validates the cart server-side,
 * inserts the order + items, decrements stock, and returns the order id.
 * Online (Razorpay) placement is finalized via the dedicated payment route.
 */
export async function placeDeliveryOrder(
  formData: FormData,
): Promise<{ error?: string; orderId?: string; otp?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to order.' }

  const listingId = String(formData.get('listing_id') ?? '').trim()
  const customerName = String(formData.get('customer_name') ?? '').trim()
  const customerPhone = String(formData.get('customer_phone') ?? '').trim()
  const dropAddress = String(formData.get('drop_address') ?? '').trim()
  const dropLat = Number(formData.get('drop_lat'))
  const dropLng = Number(formData.get('drop_lng'))
  const notes = String(formData.get('notes') ?? '').trim() || null

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

  const { error, cart } = await validateDeliveryCart(listingId, items, { lat: dropLat, lng: dropLng })
  if (error || !cart) return { error: error ?? 'Could not validate your cart.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server configuration error.' }

  const otp = generateHandoffOtp()
  const { data: order, error: insertError } = await admin
    .from('delivery_orders')
    .insert({
      listing_id: cart.listing.id,
      customer_id: user.id,
      status: 'placed',
      payment_mode: 'cod',
      payment_status: 'pending',
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

  return { orderId: order.id, otp }
}
