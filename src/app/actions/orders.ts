'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePublicListingDetail } from '@/lib/cache-tags'
import {
  findFinalizedIntentByPaymentId,
  markIntentCaptured,
  markIntentFinalized,
  recordIntentError,
} from '@/lib/payment-intents'
import {
  fetchRazorpayOrder,
  resolveListingService,
  validateRazorpayOrder,
} from '@/lib/payment-security'
import { createClient } from '@/lib/supabase/server'

export interface Order {
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
  commission_rate: number
  commission_amount: number
  seller_payout_amount: number
  seller_upi_id: string
  payment_flow: 'platform_upi_payout' | 'owner_razorpay'
  owner_razorpay_order_id: string | null
  owner_razorpay_payment_id: string | null
  owner_razorpay_signature: string | null
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  payment_status: string
  payout_status: string
  razorpay_payout_id: string | null
  payout_error: string | null
  status: string
  created_at: string
  updated_at: string
  listing?: { name: string; subdomain: string | null } | null
}

export async function placeOrder(formData: FormData): Promise<{ error?: string; orderId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to place an order.' }

  const paymentId = (formData.get('razorpay_payment_id') as string)?.trim()
  const orderId = (formData.get('razorpay_order_id') as string)?.trim()
  const signature = (formData.get('razorpay_signature') as string)?.trim()

  if (!paymentId || !orderId || !signature) {
    return { error: 'Payment details missing. Please try again.' }
  }

  const finalized = await findFinalizedIntentByPaymentId(paymentId)
  if (finalized && finalized.user_id === user.id && finalized.entity_table === 'orders') {
    return { orderId: finalized.entity_id ?? undefined }
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
  if (!keySecret) return { error: 'Payment gateway not configured.' }

  const { createHmac } = await import('crypto')
  const expected = createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  if (expected !== signature) {
    return { error: 'Payment verification failed. Please contact support.' }
  }

  const listingId = (formData.get('listing_id') as string)?.trim()
  const serviceName = (formData.get('service_name') as string)?.trim() || null
  const serviceIndexRaw = formData.get('service_index')
  const serviceIndex =
    serviceIndexRaw == null || serviceIndexRaw === ''
      ? null
      : Number.parseInt(String(serviceIndexRaw), 10)
  const quantity = Math.max(1, Math.min(99, Math.floor(Number(formData.get('quantity') || 1))))
  const buyerName = (formData.get('buyer_name') as string)?.trim()
  const buyerPhone = (formData.get('buyer_phone') as string)?.trim()
  const deliveryAddress = (formData.get('delivery_address') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!listingId || !buyerName || !buyerPhone) {
    return { error: 'Required order fields are missing.' }
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, upi_id, owner_id, whatsapp, phone, services')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing || !listing.upi_id) {
    return { error: 'Listing not found or payment not configured.' }
  }

  const { service, error: serviceError } = resolveListingService(listing.services, {
    serviceIndex,
    serviceName,
  })
  if (!service || serviceError) {
    return { error: serviceError || 'Selected service is unavailable.' }
  }

  const razorpayOrder = await fetchRazorpayOrder(orderId)
  const paymentOrderError = validateRazorpayOrder({
    order: razorpayOrder,
    flow: 'order',
    userId: user.id,
    expectedAmountPaise: Math.round(service.price * quantity * 100),
    expectedNotes: {
      flow: 'order',
      listing_id: listingId,
      service_index: String(service.index),
      buyer_id: user.id,
      quantity: String(quantity),
    },
  })
  if (paymentOrderError) {
    await recordIntentError({ razorpayOrderId: orderId, message: paymentOrderError })
    return { error: paymentOrderError }
  }

  await markIntentCaptured({
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: signature,
  })

  const amountTotal = service.price * quantity
  const commissionRate = 0.03
  const commissionAmount = Math.round(amountTotal * commissionRate * 100) / 100
  const sellerPayoutAmount = Math.round((amountTotal - commissionAmount) * 100) / 100

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: newOrder, error: insertError } = await adminClient
    .from('orders')
    .insert({
      listing_id: listingId,
      buyer_id: user.id,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      delivery_address: deliveryAddress,
      notes,
      service_name: service.name,
      service_price: service.price,
      quantity,
      amount_total: amountTotal,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      seller_payout_amount: sellerPayoutAmount,
      seller_upi_id: listing.upi_id,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      payment_status: 'paid',
      payout_status: 'pending',
      status: 'confirmed',
    })
    .select('id')
    .single()

  if (insertError || !newOrder) {
    console.error('[placeOrder] insert error:', insertError)
    await recordIntentError({
      razorpayOrderId: orderId,
      message: insertError?.message || 'order insert failed',
    })
    return { error: 'Failed to record order. Please contact support with payment ID: ' + paymentId }
  }

  const newOrderId = newOrder.id

  await markIntentFinalized({
    razorpayOrderId: orderId,
    entityId: newOrderId,
    entityTable: 'orders',
  })
  void (async () => {
    const { payoutToUpi } = await import('@/lib/razorpay-payouts')
    const result = await payoutToUpi({
      orderId: newOrderId,
      recipientUpi: listing.upi_id!,
      recipientName: listing.name,
      amountPaise: Math.round(sellerPayoutAmount * 100),
    })

    if ('payoutId' in result) {
      await adminClient.from('orders').update({
        payout_status: 'paid',
        razorpay_payout_id: result.payoutId,
        updated_at: new Date().toISOString(),
      }).eq('id', newOrderId)
    } else {
      await adminClient.from('orders').update({
        payout_status: 'failed',
        payout_error: result.error,
        updated_at: new Date().toISOString(),
      }).eq('id', newOrderId)
      console.error('[placeOrder] payout failed for order', newOrderId, result.error)
    }
  })()

  const sellerContact = listing.whatsapp || listing.phone
  if (sellerContact) {
    const msg = encodeURIComponent([
      '🛒 New order on OurDahanu!',
      '',
      `Item: ${service.name} ×${quantity}`,
      `Amount: ₹${amountTotal}`,
      `From: ${buyerName} (${buyerPhone})`,
      deliveryAddress ? `Delivery to: ${deliveryAddress}` : null,
      notes ? `Notes: ${notes}` : null,
      '',
      'Manage orders at ourdahanu.in/my-business/orders',
    ].filter(Boolean).join('\n'))
    void Promise.resolve(msg)
  }

  revalidatePublicListingDetail(listingId)
  return { orderId: newOrderId }
}

export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('orders')
    .select('*, listing:listing_id(name, subdomain)')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  return (data ?? []) as Order[]
}

export async function getListingOrders(listingId: string): Promise<Order[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!listing) return []

  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })

  return (data ?? []) as Order[]
}

export async function getMyListingOrders(): Promise<{ orders: Order[]; listingId: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { orders: [], listingId: null }

  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!listing) return { orders: [], listingId: null }

  const orders = await getListingOrders(listing.id)
  return { orders, listingId: listing.id }
}

export async function updateOrderStatus(
  orderId: string,
  status: 'fulfilled' | 'cancelled',
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { data: order } = await supabase
    .from('orders')
    .select('id, listing_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { error: 'Order not found.' }

  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', order.listing_id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!listing) return { error: 'Access denied.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) return { error: error.message }

  revalidatePath('/my-business/orders')
  return {}
}

export async function getAllOrders(): Promise<Order[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { getUserRole } = await import('@/app/actions/admin')
  const { role } = await getUserRole(supabase)
  if (role !== 'admin' && role !== 'moderator') return []

  const adminClient = createAdminClient()
  if (!adminClient) return []

  const { data } = await adminClient
    .from('orders')
    .select('*, listing:listing_id(name, subdomain)')
    .order('created_at', { ascending: false })

  return (data ?? []) as Order[]
}

export async function retryPayout(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { getUserRole } = await import('@/app/actions/admin')
  const { role } = await getUserRole(supabase)
  if (role !== 'admin' && role !== 'moderator') return { error: 'Access denied.' }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data: order } = await adminClient
    .from('orders')
    .select('id, seller_upi_id, seller_payout_amount, listing:listing_id(name)')
    .eq('id', orderId)
    .single() as { data: (Order & { listing: { name: string } | null }) | null }

  if (!order) return { error: 'Order not found.' }

  const { payoutToUpi } = await import('@/lib/razorpay-payouts')
  const result = await payoutToUpi({
    orderId: order.id,
    recipientUpi: order.seller_upi_id,
    recipientName: order.listing?.name ?? 'Seller',
    amountPaise: Math.round(order.seller_payout_amount * 100),
  })

  if ('payoutId' in result) {
    await adminClient.from('orders').update({
      payout_status: 'paid',
      razorpay_payout_id: result.payoutId,
      payout_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', orderId)
    revalidatePath('/admin/orders')
    return {}
  }

  await adminClient.from('orders').update({
    payout_status: 'failed',
    payout_error: result.error,
    updated_at: new Date().toISOString(),
  }).eq('id', orderId)
  revalidatePath('/admin/orders')
  return { error: result.error }
}
