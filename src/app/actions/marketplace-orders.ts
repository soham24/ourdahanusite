'use server'

import { revalidatePath } from 'next/cache'

import { loadOwnerRazorpayKeys } from '@/app/actions/listing-payments'
import { revalidatePublicListingDetail } from '@/lib/cache-tags'
import { classifyRazorpayKeyId } from '@/lib/selling/keys'
import {
  sendNotification,
  sendNotificationToAdmins,
} from '@/lib/notifications'
import {
  findFinalizedIntentByPaymentId,
  getIntentByOrderId,
  markIntentCaptured,
  markIntentFinalized,
  recordIntentError,
} from '@/lib/payment-intents'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

export interface MarketplaceOrder {
  id: string
  listing_id: string | null
  product_id: string | null
  buyer_id: string | null
  buyer_name: string
  buyer_phone: string
  delivery_address: string | null
  notes: string | null
  service_name: string
  service_price: number
  quantity: number
  amount_total: number
  payment_flow: 'platform_upi_payout' | 'owner_razorpay'
  owner_razorpay_order_id: string | null
  owner_razorpay_payment_id: string | null
  owner_razorpay_signature: string | null
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  payment_status: string
  status: string
  /** Paid with Razorpay test keys: a practice purchase, no real money. */
  is_test: boolean
  created_at: string
  updated_at: string
  listing?: { name: string; subdomain: string | null } | null
}

function sanitizeString(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength)
}

export async function placeMarketplaceOrder(
  formData: FormData,
): Promise<{ error?: string; orderId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to place an order.' }

  const razorpayOrderId = sanitizeString(formData.get('razorpay_order_id'), 80)
  const razorpayPaymentId = sanitizeString(formData.get('razorpay_payment_id'), 80)
  const razorpaySignature = sanitizeString(formData.get('razorpay_signature'), 200)

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return { error: 'Payment details are missing. Please try again.' }
  }

  // Idempotency: same payment id retried should return the existing
  // order rather than re-decrementing stock and re-charging metadata.
  const finalized = await findFinalizedIntentByPaymentId(razorpayPaymentId)
  if (finalized && finalized.user_id === user.id && finalized.entity_table === 'orders') {
    return { orderId: finalized.entity_id ?? undefined }
  }

  const productId = sanitizeString(formData.get('product_id'), 80)
  if (!productId) return { error: 'Missing product.' }

  const quantity = Math.max(
    1,
    Math.min(99, Math.floor(Number(formData.get('quantity') || 1))),
  )
  const buyerName = sanitizeString(formData.get('buyer_name'), 120)
  const buyerPhone = sanitizeString(formData.get('buyer_phone'), 20)
  const deliveryAddress = sanitizeString(formData.get('delivery_address'), 400) || null
  const notes = sanitizeString(formData.get('notes'), 500) || null

  if (!buyerName || !buyerPhone) {
    return { error: 'Name and phone are required.' }
  }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  // 1. Re-validate product + price server-side (never trust client)
  const { data: product } = await adminClient
    .from('listing_products')
    .select('id, listing_id, type, name, price_paise, quantity_in_stock, is_active')
    .eq('id', productId)
    .maybeSingle()

  // Inactive items are accepted: this runs after capture, and create-marketplace-order already stops inactive items before payment.
  if (!product) {
    return { error: 'Product is no longer available.' }
  }

  const { data: listing } = await adminClient
    .from('listings')
    .select('id, name, owner_id')
    .eq('id', product.listing_id)
    .maybeSingle()

  if (!listing) {
    return { error: 'Listing not found.' }
  }

  // Deliberately no approved / payments_enabled / suspension check here: this
  // runs after Razorpay captured the buyer's money. Those gates only stop new
  // payments from starting (create-marketplace-order). A payment proven
  // genuine below is always saved.

  // 2. Load owner keys and verify HMAC with OWNER's secret. Unverified keys
  // are accepted: Razorpay may have started rejecting them for *new* orders
  // after this payment was created, and the signature still needs the secret.
  const ownerKeys = await loadOwnerRazorpayKeys(product.listing_id, { allowUnverified: true })
  if (!ownerKeys) {
    return { error: 'Payment setup is incomplete for this business.' }
  }

  const { createHmac } = await import('crypto')
  const expectedSignature = createHmac('sha256', ownerKeys.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex')

  if (expectedSignature !== razorpaySignature) {
    return { error: 'Payment verification failed. Please contact support with your payment ID.' }
  }

  await markIntentCaptured({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  })

  // 3. Re-fetch Razorpay order to confirm amount + notes (defense in depth)
  // The unit price and amount the buyer agreed to were recorded on the
  // payment intent when the Razorpay order was created. Check against those,
  // not the live price: an owner editing the price mid-payment must not
  // refuse a genuine paid order.
  const intent = await getIntentByOrderId(razorpayOrderId)
  if (intent && intent.user_id !== user.id) {
    return { error: 'Order details do not match the original request.' }
  }
  const intentUnitPrice = intent?.payload?.product_price_paise
  const unitPricePaise =
    typeof intentUnitPrice === 'number' && Number.isInteger(intentUnitPrice) && intentUnitPrice > 0
      ? intentUnitPrice
      : product.price_paise
  const expectedAmountPaise = intent?.amount_paise ?? unitPricePaise * quantity
  const credentials = Buffer.from(`${ownerKeys.keyId}:${ownerKeys.keySecret}`).toString('base64')
  const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpayOrderId}`, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: 'no-store',
  })

  if (!orderRes.ok) {
    return { error: 'Could not confirm payment with Razorpay. Please contact support.' }
  }

  const razorpayOrder = (await orderRes.json()) as {
    amount: number
    status: string
    amount_paid: number
    notes?: {
      flow?: string
      buyer_id?: string
      product_id?: string
      listing_id?: string
      quantity?: string
    }
  }

  if (razorpayOrder.amount !== expectedAmountPaise) {
    return { error: 'Order amount mismatch. Please contact support.' }
  }
  if (razorpayOrder.status !== 'paid' || razorpayOrder.amount_paid !== expectedAmountPaise) {
    return { error: 'Payment has not completed. Please retry.' }
  }

  const n = razorpayOrder.notes ?? {}
  if (
    n.flow !== 'marketplace' ||
    n.buyer_id !== user.id ||
    n.product_id !== product.id ||
    n.listing_id !== product.listing_id ||
    n.quantity !== String(quantity)
  ) {
    return { error: 'Order details do not match the original request.' }
  }

  // Test keys move no real money: label the order and leave real stock alone.
  const isTest = classifyRazorpayKeyId(ownerKeys.keyId) === 'test'

  // 4. Atomic stock decrement
  if (!isTest && product.quantity_in_stock !== null) {
    const { data: decOk, error: decError } = await adminClient.rpc(
      'decrement_product_stock',
      { p_product_id: product.id, p_quantity: quantity },
    )
    if (decError) {
      console.error('[marketplace] stock rpc error:', decError)
      return { error: 'Could not reserve stock. Please try again.' }
    }
    if (!decOk) {
      return { error: 'Sorry — this item just went out of stock.' }
    }
  }

  // 5. Insert the order
  const priceRupees = unitPricePaise / 100
  const totalRupees = expectedAmountPaise / 100

  const { data: newOrder, error: insertError } = await adminClient
    .from('orders')
    .insert({
      listing_id: product.listing_id,
      product_id: product.id,
      buyer_id: user.id,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      delivery_address: deliveryAddress,
      notes,
      service_name: product.name,
      service_price: priceRupees,
      quantity,
      amount_total: totalRupees,
      commission_rate: 0,
      commission_amount: 0,
      seller_payout_amount: totalRupees,
      seller_upi_id: '',
      payment_flow: 'owner_razorpay',
      owner_razorpay_order_id: razorpayOrderId,
      owner_razorpay_payment_id: razorpayPaymentId,
      owner_razorpay_signature: razorpaySignature,
      payment_status: 'paid',
      payout_status: 'not_applicable',
      status: 'confirmed',
      is_test: isTest,
    })
    .select('id')
    .single()

  if (insertError || !newOrder) {
    console.error('[marketplace] insert order failed:', insertError)
    await recordIntentError({
      razorpayOrderId,
      message: insertError?.message || 'marketplace order insert failed',
    })
    return {
      error:
        'Order recorded at Razorpay but failed to save locally. Contact support with payment ID ' +
        razorpayPaymentId,
    }
  }

  await markIntentFinalized({
    razorpayOrderId,
    entityId: newOrder.id as string,
    entityTable: 'orders',
  })

  // Fan out notifications to buyer + owner + admins (awaited delivery)
  await (async () => {
    const basePayload = {
      orderId: newOrder.id,
      listingId: product.listing_id,
      listingName: listing.name,
      productName: product.name,
      quantity,
      amountTotal: totalRupees,
      buyerName,
      isTest,
    } as const

    await Promise.allSettled([
      sendNotification(user.id, 'order.placed', {
        ...basePayload,
        recipient: 'buyer',
      }),
      listing.owner_id
        ? sendNotification(listing.owner_id, 'order.placed', {
            ...basePayload,
            recipient: 'owner',
          })
        : Promise.resolve(),
      isTest
        ? Promise.resolve()
        : sendNotificationToAdmins('order.placed', {
            ...basePayload,
            recipient: 'admin',
          }),
    ])
  })().catch((err) => console.error('[marketplace:order.placed notify]', err))

  revalidatePublicListingDetail(product.listing_id)
  return { orderId: newOrder.id }
}

export async function getMyMarketplaceOrders(): Promise<MarketplaceOrder[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('orders')
    .select('*, listing:listing_id(name, subdomain)')
    .eq('buyer_id', user.id)
    .eq('payment_flow', 'owner_razorpay')
    .order('created_at', { ascending: false })

  return (data ?? []) as MarketplaceOrder[]
}

export interface MarketplaceOrderWithListingContact extends MarketplaceOrder {
  listing?:
    | {
        name: string
        subdomain: string | null
        phone?: string | null
        whatsapp?: string | null
        owner_id?: string | null
      }
    | null
}

export async function getMyMarketplaceOrder(
  orderId: string,
): Promise<MarketplaceOrderWithListingContact | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('orders')
    .select('*, listing:listing_id(name, subdomain, phone, whatsapp, owner_id)')
    .eq('id', orderId)
    .eq('buyer_id', user.id)
    .eq('payment_flow', 'owner_razorpay')
    .maybeSingle()

  return (data ?? null) as MarketplaceOrderWithListingContact | null
}

export async function updateMarketplaceOrderStatus(
  orderId: string,
  status: 'confirmed' | 'fulfilled' | 'cancelled',
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: order } = await adminClient
    .from('orders')
    .select('id, listing_id, buyer_id, service_name, payment_flow')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { error: 'Order not found.' }

  if (order.payment_flow !== 'owner_razorpay') {
    return { error: 'This order uses a different payment flow.' }
  }

  const { data: listing } = await adminClient
    .from('listings')
    .select('id, name, owner_id')
    .eq('id', order.listing_id)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }

  const { getUserRole } = await import('@/app/actions/admin')
  const { role } = await getUserRole(supabase)
  if (listing.owner_id !== user.id && role !== 'admin' && role !== 'moderator') {
    return { error: 'Access denied.' }
  }

  const { error } = await adminClient
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) return { error: error.message }

  // Notify the buyer on status change (awaited delivery)
  if (order.buyer_id && (status === 'fulfilled' || status === 'cancelled')) {
    await sendNotification(
      order.buyer_id,
      status === 'fulfilled' ? 'order.fulfilled' : 'order.cancelled',
      {
        orderId: order.id,
        listingName: listing.name,
        productName: order.service_name,
      },
    ).catch((err) => console.error('[marketplace:order.status notify]', err))
  }

  revalidatePath('/my-business/orders')
  revalidatePath('/admin/orders')
  revalidatePath('/account/orders')
  return {}
}
