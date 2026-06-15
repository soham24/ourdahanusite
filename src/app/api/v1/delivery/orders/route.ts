import { placeDeliveryOrder } from '@/app/actions/delivery'
import { getApiUser } from '@/lib/api/auth'
import { handleOptions } from '@/lib/api/cors'
import { toFormData } from '@/lib/api/form'
import { apiError, apiJson } from '@/lib/api/respond'

export function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/v1/delivery/orders — place a delivery order (COD or online finalize).
 * Body: { listing_id, customer_name, customer_phone, drop_address, drop_lat,
 *         drop_lng, items: [{productId, quantity}], payment_mode,
 *         razorpay_order_id?, razorpay_payment_id?, razorpay_signature?, notes? }
 * `items` is JSON-stringified into FormData for the shared action.
 */
export async function POST(request: Request) {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return apiError('Invalid JSON body', 400)

  const payload = { ...body, items: JSON.stringify(body.items ?? []) }
  const res = await placeDeliveryOrder(toFormData(payload))
  if (res.error) return apiError(res.error, 400)
  return apiJson({ orderId: res.orderId, otp: res.otp })
}
