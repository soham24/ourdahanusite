import 'server-only'

import { getCachedPricingConfig } from '@/lib/data/pricing'
import { createPublicClient } from '@/lib/supabase/public'

type FlowKind = 'listing' | 'order' | 'appointment'

export type SubmissionCharge = {
  couponCode: string | null
  couponValid: boolean
  finalPrice: number
  isFree: boolean
  paymentStatus: 'paid' | 'free_coupon'
}

type RazorpayOrder = {
  id: string
  amount: number
  amount_paid?: number
  currency?: string
  receipt?: string
  status?: string
  notes?: Record<string, string>
}

function normalizeCouponCode(value: string | null | undefined): string | null {
  const code = (value ?? '').trim().toLowerCase()
  return code || null
}

async function getEnabledCouponFinalPrice(code: string): Promise<number | null> {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('coupons')
      .select('final_price')
      .eq('code', code)
      .eq('enabled', true)
      .maybeSingle()

    const coupon = data as { final_price?: number } | null
    return typeof coupon?.final_price === 'number' ? coupon.final_price : null
  } catch {
    return null
  }
}

async function getSubmissionCharge(
  couponCode: string | null | undefined,
): Promise<SubmissionCharge> {
  const pricing = await getCachedPricingConfig()
  const basePrice = pricing.current_price

  const normalizedCode = normalizeCouponCode(couponCode)
  if (!normalizedCode) {
    return {
      couponCode: null,
      couponValid: false,
      finalPrice: basePrice,
      isFree: basePrice === 0,
      paymentStatus: basePrice === 0 ? 'free_coupon' : 'paid',
    }
  }

  const couponFinalPrice = await getEnabledCouponFinalPrice(normalizedCode)
  if (couponFinalPrice === null) {
    return {
      couponCode: normalizedCode,
      couponValid: false,
      finalPrice: basePrice,
      isFree: false,
      paymentStatus: 'paid',
    }
  }

  return {
    couponCode: normalizedCode,
    couponValid: true,
    finalPrice: couponFinalPrice,
    isFree: couponFinalPrice === 0,
    paymentStatus: couponFinalPrice === 0 ? 'free_coupon' : 'paid',
  }
}

export async function getListingSubmissionCharge(
  couponCode: string | null | undefined,
): Promise<SubmissionCharge> {
  return getSubmissionCharge(couponCode)
}

export function buildReceiptPrefix(flow: FlowKind, userId: string): string {
  return `${flow}_${userId.slice(0, 8)}_`
}

export async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrder | null> {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim()
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
  if (!keyId || !keySecret) {
    return null
  }

  try {
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('[Razorpay] Failed to fetch order details', {
        orderId,
        status: response.status,
      })
      return null
    }

    return await response.json() as RazorpayOrder
  } catch (error) {
    console.error('[Razorpay] Failed to fetch order details', { orderId, error })
    return null
  }
}

export function validateRazorpayOrder(options: {
  order: RazorpayOrder | null
  flow: FlowKind
  userId: string
  expectedAmountPaise: number
  expectedNotes?: Record<string, string>
}): string | null {
  const { order, flow, userId, expectedAmountPaise, expectedNotes } = options

  if (!order) {
    return 'Unable to verify payment details. Please contact support.'
  }

  if (order.amount !== expectedAmountPaise) {
    return 'Paid amount does not match the expected total.'
  }

  if (order.status !== 'paid' || order.amount_paid !== expectedAmountPaise) {
    return 'Payment has not completed. Please retry confirmation without paying again.'
  }

  if (order.currency !== 'INR') {
    return 'Payment currency is invalid.'
  }

  const receiptPrefix = buildReceiptPrefix(flow, userId)
  if (!order.receipt || !order.receipt.startsWith(receiptPrefix)) {
    return 'Payment order does not belong to this account.'
  }

  if (!expectedNotes) {
    return null
  }

  const hasOrderNotes = !!order.notes && Object.keys(order.notes).length > 0
  if (!hasOrderNotes) {
    return 'Payment order details are missing.'
  }

  for (const [key, value] of Object.entries(expectedNotes)) {
    if (order.notes?.[key] !== value) {
      return 'Payment order details do not match this request.'
    }
  }

  return null
}
