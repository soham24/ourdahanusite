'use server'

import { revalidatePath } from 'next/cache'

import { loadOwnerRazorpayKeys } from '@/lib/payments/owner-keys'
import { resolveOrderAmounts } from '@/lib/payments/order-amounts'
import { revalidatePublicListingDetail } from '@/lib/cache-tags'
import { orderItemName } from '@/lib/catalog/catalog'
import { classifyRazorpayKeyId } from '@/lib/selling/keys'
import {
  sendNotification,
  sendNotificationToAdmins,
} from '@/lib/notifications'
import {
  findFinalizedIntentByPaymentId,
  getIntentByOrderId,
  markIntentCaptured,
  recordIntentError,
} from '@/lib/payment-intents'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

export interface MarketplaceOrder {
  id: string
  listing_id: string | null
  product_id: string | null
  product_option_id: string | null
  option_label: string | null
  buyer_id: string | null
  buyer_name: string
  buyer_phone: string
  delivery_address: string | null
  notes: string | null
  service_name: string
  service_price: number
  quantity: number
  amount_total: number
  owner_razorpay_order_id: string | null
  owner_razorpay_payment_id: string | null
  owner_razorpay_signature: string | null
  payment_status: string
  status: string
  /** Paid with Razorpay test keys: a practice purchase, no real money. */
  is_test: boolean
  fulfillment_issue?: string | null
  created_at: string
  updated_at: string
  listing?: { name: string; subdomain: string | null } | null
}

function sanitizeString(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength)
}

export async function placeMarketplaceOrder(
  formData: FormData,
): Promise<{ error?: string; orderId?: string; issue?: string }> {
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
  // Form-supplied value only; used for the option row lookup below. The
  // authoritative option id used for the notes check, stock decision and
  // insert is resolved later, once the intent and Razorpay notes are loaded
  // (see `optionId` further down) — never trust the form alone to refuse a
  // captured payment.
  const formOptionId = sanitizeString(formData.get('option_id'), 80)

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

  const intent = await getIntentByOrderId(razorpayOrderId)
  if (intent && (intent.user_id !== user.id || intent.flow !== 'marketplace')) {
    return { error: 'Order details do not match the original request.' }
  }

  // 1. Re-validate product + price server-side (never trust client)
  const { data: liveProduct } = await adminClient
    .from('listing_products')
    .select('id, listing_id, type, name, price_paise, quantity_in_stock, is_active')
    .eq('id', productId)
    .maybeSingle()

  const product = liveProduct ?? (intent?.payload?.product_id === productId && intent.listing_id ? {
    id: productId, listing_id: intent.listing_id, name: String(intent.payload.product_name ?? 'Purchased item'),
    price_paise: Number(intent.payload.product_price_paise), quantity_in_stock: null, is_active: false,
  } : null)

  // Inactive items are accepted: this runs after capture, and create-marketplace-order already stops inactive items before payment.
  if (!product) {
    return { error: 'Product is no longer available.' }
  }

  type OptionRow = { id: string; label: string; price_paise: number; quantity_in_stock: number | null }

  // Loads an option row and confirms it belongs to this item; a stale,
  // deleted, cross-product or blank id is treated as "no option" rather
  // than an error, since a captured payment must still be saved.
  const loadOptionRow = async (id: string): Promise<OptionRow | null> => {
    if (!id) return null
    const { data } = await adminClient
      .from('listing_product_options')
      .select('id, product_id, label, price_paise, quantity_in_stock')
      .eq('id', id)
      .maybeSingle()
    return data && (data as { product_id: string }).product_id === product.id
      ? (data as OptionRow & { product_id: string })
      : null
  }

  // The option may have been renamed, repriced or deleted since payment
  // started; the intent below still carries what the buyer agreed to.
  const option = await loadOptionRow(formOptionId)

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

  const { createHmac, timingSafeEqual } = await import('crypto')
  const expectedSignature = createHmac('sha256', ownerKeys.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex')

  if (!/^[a-f0-9]{64}$/i.test(razorpaySignature) || !timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(razorpaySignature, 'hex'))) {
    return { error: 'Payment verification failed. Please contact support with your payment ID.' }
  }

  // 3. Re-fetch Razorpay order to confirm amount + notes (defense in depth)
  // The unit price and amount the buyer agreed to were recorded on the
  // payment intent when the Razorpay order was created. Check against those,
  // not the live price: an owner editing the price mid-payment must not
  // refuse a genuine paid order.
  const intentUnitPriceRaw = intent?.payload?.product_price_paise
  const fallbackUnitPriceRaw: unknown = option?.price_paise ?? product.price_paise ?? null
  const intentAmountRaw = intent?.amount_paise
  const intentOptionLabel = intent?.payload?.option_label
  const optionLabel =
    typeof intentOptionLabel === 'string' && intentOptionLabel ? intentOptionLabel : option?.label ?? null
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
    currency: string
    notes?: {
      flow?: string
      buyer_id?: string
      product_id?: string
      listing_id?: string
      quantity?: string
      option_id?: string
    }
  }

  // Resolves the unit price and total from, in order: the intent's recorded
  // price/amount, the live product/option price, and finally Razorpay's own
  // (unvalidated) report of this signature-verified order — never letting a
  // missing/NaN field anywhere in that chain reach the database as `null` or
  // `NaN`. See src/lib/payments/order-amounts.ts for the (unit tested) logic.
  const resolvedAmounts = resolveOrderAmounts({
    quantity,
    intentUnitPricePaise: intentUnitPriceRaw,
    fallbackUnitPricePaise: fallbackUnitPriceRaw,
    intentAmountPaise: intentAmountRaw,
    razorpayAmountPaise: razorpayOrder.amount,
    razorpayAmountPaidPaise: razorpayOrder.amount_paid,
  })
  if (!resolvedAmounts) {
    // Genuinely impossible: the intent, the product/option, and both of
    // Razorpay's own amount fields are all missing or invalid. There is no
    // number left to save the order with — this is the one case left where
    // a captured payment can't be saved automatically.
    return {
      error:
        'Could not confirm the paid amount with Razorpay. Please contact support with your payment ID: ' +
        razorpayPaymentId,
    }
  }
  const { unitPricePaise, amountTotalPaise, confirmedAmountPaise, priceUnconfirmed, amountUnconfirmed } =
    resolvedAmounts

  // When the amount itself was seeded from Razorpay's own report
  // (amountUnconfirmed), comparing `confirmedAmountPaise` back against
  // `razorpayOrder.amount` is circular — it was either read from that exact
  // field (trivially equal) or from `amount_paid` because `amount` itself
  // was unusable (in which case this comparison would wrongly refuse a
  // captured payment). Skip it only in that case; the amount_paid check just
  // below still guards against a genuinely incomplete capture either way.
  if ((!amountUnconfirmed && razorpayOrder.amount !== confirmedAmountPaise) || razorpayOrder.currency !== 'INR') {
    return { error: 'Order amount mismatch. Please contact support.' }
  }
  if (razorpayOrder.status !== 'paid' || razorpayOrder.amount_paid !== confirmedAmountPaise) {
    return { error: 'Payment has not completed. Please retry.' }
  }

  const n = razorpayOrder.notes ?? {}

  // Like unit price and option label, option_id must never be able to
  // refuse a captured payment because the client's form data changed or
  // went missing mid-flow. Prefer the form value (the normal case), then
  // the payment intent recorded when the Razorpay order was created, then
  // Razorpay's own notes — so a blank form value can't fail this check when
  // the intent or notes both agree an option was bought (and an order with
  // no option at all still resolves to '' from all three sources).
  const intentOptionId = intent?.payload?.option_id
  const optionId =
    formOptionId ||
    (typeof intentOptionId === 'string' ? intentOptionId : '') ||
    (n.option_id ?? '')

  if (
    n.flow !== 'marketplace' ||
    n.buyer_id !== user.id ||
    n.product_id !== product.id ||
    n.listing_id !== product.listing_id ||
    n.quantity !== String(quantity) ||
    (n.option_id ?? '') !== optionId
  ) {
    return { error: 'Order details do not match the original request.' }
  }

  // `option` above was loaded from the client's form value. When the
  // authoritative id resolved just above differs from it (the form value
  // was blank or stale but the intent or notes carried the real option),
  // re-fetch the row for that id so the stock decrement and the order
  // insert reflect what the buyer actually paid for, not what a stale form
  // implied. Still never refuses the payment: if the resolved option no
  // longer exists, this simply falls back to null, same as today.
  const resolvedOption = optionId === formOptionId ? option : await loadOptionRow(optionId)

  await markIntentCaptured({ razorpayOrderId, razorpayPaymentId, razorpaySignature })

  // Test keys move no real money: label the order and leave real stock alone.
  const isTest = classifyRazorpayKeyId(ownerKeys.keyId) === 'test'

  // One transaction serializes retries, updates stock and finalizes the intent.
  // amountTotalPaise already guarantees unitPricePaise * quantity === amountTotalPaise
  // exactly (see order-amounts.ts) — the database function requires that.
  const totalRupees = amountTotalPaise / 100
  const priceIssueNote = priceUnconfirmed
    ? 'Unit price could not be confirmed after payment; the amount charged was used to estimate it, so the recorded total may differ from the amount captured by a few paise. Verify pricing and the total with the buyer.'
    : null
  const { data: finalizedOrder, error: insertError } = await adminClient.rpc('finalize_marketplace_order', {
    p_order: {
      listing_id: product.listing_id,
      product_id: product.id,
      product_option_id: resolvedOption?.id ?? null,
      option_id: optionId || null,
      option_label: optionLabel,
      buyer_id: user.id,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      delivery_address: deliveryAddress,
      notes,
      service_name: typeof intent?.payload?.product_name === 'string' ? intent.payload.product_name : product.name,
      service_price: unitPricePaise / 100,
      quantity,
      amount_total: totalRupees,
      owner_razorpay_order_id: razorpayOrderId,
      owner_razorpay_payment_id: razorpayPaymentId,
      owner_razorpay_signature: razorpaySignature,
      is_test: isTest,
    },
  })
  const result = finalizedOrder as { orderId?: string; created?: boolean; issue?: string | null } | null
  if (insertError || !result?.orderId) {
    await recordIntentError({ razorpayOrderId, message: insertError?.message || 'Order finalization failed' })
    return { error: 'Payment received but confirmation is pending. Do not pay again. Reference: ' + razorpayPaymentId }
  }
  const newOrder = { id: result.orderId }

  // The database function only records an issue it detects itself (item/option
  // removed, insufficient stock). A price it could not confirm is our own
  // finding, so fold it into the same column on first creation — never on a
  // replay, since the row (and its issue text) was already finalized then.
  // (Reaching this branch always changes the text — `result.issue` never
  // already contains `priceIssueNote`, since the database function has no
  // way to know about it — so there's nothing to gate the write on.)
  let issue = result.issue ?? null
  if (result.created && priceIssueNote) {
    issue = issue ? `${issue} ${priceIssueNote}` : priceIssueNote
    const { error: issueUpdateError } = await adminClient
      .from('orders')
      .update({ fulfillment_issue: issue })
      .eq('id', newOrder.id)
    if (issueUpdateError) {
      // The order itself is safely saved either way; only the note describing
      // *why* it needs a look failed to persist. Record it so this doesn't
      // silently show as a clean order while owner/admin were told otherwise.
      console.error('[marketplace:order.placed fulfillment_issue write]', issueUpdateError)
      await recordIntentError({
        razorpayOrderId,
        message: `Order ${newOrder.id} saved but fulfillment_issue update failed: ${issueUpdateError.message}`,
      })
    }
  }

  if (!result.created) return { orderId: newOrder.id, issue: issue ?? undefined }

  // Fan out notifications to buyer + owner + admins (awaited delivery)
  await (async () => {
    const basePayload = {
      orderId: newOrder.id,
      listingId: product.listing_id,
      listingName: listing.name,
      productName: orderItemName(product.name, optionLabel),
      quantity,
      amountTotal: totalRupees,
      buyerName,
      isTest,
      // Owner/admin templates render this as an extra line; the buyer
      // template never reads it, so their confirmation stays positive.
      fulfillmentIssue: issue ?? undefined,
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
  return { orderId: newOrder.id, issue: issue ?? undefined }
}

export async function getMyMarketplaceOrders(): Promise<MarketplaceOrder[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('orders')
    .select('*, listing:listing_id(name, subdomain)')
    .eq('buyer_id', user.id)
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
    .select('id, listing_id, buyer_id, service_name, option_label')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { error: 'Order not found.' }

  const { data: listing } = await adminClient
    .from('listings')
    .select('id, name, owner_id')
    .eq('id', order.listing_id)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }

  const { getUserRole } = await import('@/app/actions/admin')
  const { role } = await getUserRole(supabase)
  if (!['confirmed', 'fulfilled', 'cancelled'].includes(status)) return { error: 'Invalid order status.' }
  if (listing.owner_id !== user.id && role !== 'admin' && role !== 'moderator') {
    return { error: 'Access denied.' }
  }

  const { error } = await adminClient
    .from('orders')
    .update({
      status,
      // A settled order — fulfilled or cancelled — no longer needs the
      // "needs attention" flag: it either resolved fine or won't be
      // fulfilled at all, so the banner shouldn't keep following it around.
      ...(status === 'fulfilled' || status === 'cancelled' ? { fulfillment_issue: null } : {}),
      updated_at: new Date().toISOString(),
    })
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
        productName: orderItemName(order.service_name, order.option_label),
      },
    ).catch((err) => console.error('[marketplace:order.status notify]', err))
  }

  revalidatePath('/my-business/orders')
  revalidatePath('/admin/orders')
  revalidatePath('/account/orders')
  return {}
}
