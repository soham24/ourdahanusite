import 'server-only'

import { getCachedPricingConfig } from '@/lib/data/pricing'
import { normalizeInlineText, normalizeServiceItems } from '@/lib/listing-content'
import { createPublicClient } from '@/lib/supabase/public'

type FlowKind = 'job' | 'listing' | 'order' | 'appointment'

type PricingKind = 'job' | 'listing'

export type SubmissionCharge = {
  couponCode: string | null
  couponValid: boolean
  finalPrice: number
  isFree: boolean
  paymentStatus: 'paid' | 'free_coupon'
}

export type ResolvedListingService = {
  index: number
  name: string
  price: number
  type: 'service' | 'product'
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
  kind: PricingKind,
  couponCode: string | null | undefined,
): Promise<SubmissionCharge> {
  const pricing = await getCachedPricingConfig()
  const basePrice =
    kind === 'job'
      ? pricing.job_current_price
      : pricing.current_price

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

export async function getJobSubmissionCharge(
  couponCode: string | null | undefined,
): Promise<SubmissionCharge> {
  return getSubmissionCharge('job', couponCode)
}

export async function getListingSubmissionCharge(
  couponCode: string | null | undefined,
): Promise<SubmissionCharge> {
  return getSubmissionCharge('listing', couponCode)
}

function parseServicePrice(price: string | undefined): number | null {
  if (!price) return null
  const match = price.replace(/,/g, '').match(/[\d]+(\.\d+)?/)
  if (!match) return null
  const parsed = Number.parseFloat(match[0])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseStoredServices(rawServices: unknown) {
  let parsed = rawServices

  if (typeof rawServices === 'string') {
    try {
      parsed = JSON.parse(rawServices)
    } catch {
      parsed = []
    }
  }

  return normalizeServiceItems(parsed)
}

export function resolveListingService(
  rawServices: unknown,
  options: {
    serviceIndex?: number | null
    serviceName?: string | null
  },
): { service?: ResolvedListingService; error?: string } {
  const services = parseStoredServices(rawServices)
  if (!services.length) {
    return { error: 'This listing has no orderable services configured.' }
  }

  let selectedIndex = Number.isInteger(options.serviceIndex) ? Number(options.serviceIndex) : null

  if (selectedIndex === null) {
    const normalizedName = normalizeInlineText(options.serviceName, 80)?.toLowerCase()
    if (!normalizedName) {
      return { error: 'Please select a valid service.' }
    }

    const matches = services
      .map((service, index) => ({ service, index }))
      .filter(({ service }) => service.name.toLowerCase() === normalizedName)

    if (matches.length === 0) {
      return { error: 'Selected service is no longer available.' }
    }
    if (matches.length > 1) {
      return { error: 'Selected service is ambiguous. Please refresh and try again.' }
    }

    selectedIndex = matches[0].index
  }

  if (selectedIndex === null) {
    return { error: 'Please select a valid service.' }
  }

  const service = services[selectedIndex]
  if (!service) {
    return { error: 'Selected service is no longer available.' }
  }

  const price = parseServicePrice(service.price)
  if (price === null) {
    return { error: 'Selected service is not available for online payment.' }
  }

  return {
    service: {
      index: selectedIndex,
      name: service.name,
      price,
      type: service.type === 'product' ? 'product' : 'service',
    },
  }
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

  if (order.currency && order.currency !== 'INR') {
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
    return null
  }

  for (const [key, value] of Object.entries(expectedNotes)) {
    if (order.notes?.[key] !== value) {
      return 'Payment order details do not match this request.'
    }
  }

  return null
}
