import { placeOrder } from '@/app/actions/orders'
import { getApiUser } from '@/lib/api/auth'
import { handleOptions } from '@/lib/api/cors'
import { toFormData } from '@/lib/api/form'
import { apiError, apiJson } from '@/lib/api/respond'

export function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/v1/orders — finalize a product order after Razorpay payment.
 * Wraps the existing placeOrder action (signature verification + payout calc +
 * service-role insert). Body is JSON; the action expects FormData.
 *
 * Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature,
 *         listing_id, service_name?, service_index?, quantity,
 *         buyer_name, buyer_phone, delivery_address?, notes? }
 */
export async function POST(request: Request) {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return apiError('Invalid JSON body', 400)

  const result = await placeOrder(toFormData(body))
  if (result.error) return apiError(result.error, 400)

  return apiJson({ orderId: result.orderId })
}
