import { bookAppointment } from '@/app/actions/appointments'
import { getApiUser } from '@/lib/api/auth'
import { handleOptions } from '@/lib/api/cors'
import { toFormData } from '@/lib/api/form'
import { apiError, apiJson } from '@/lib/api/respond'

export function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/v1/appointments — book an appointment (after Razorpay payment when
 * a booking fee applies; free bookings omit the payment fields). Wraps the
 * existing bookAppointment action.
 *
 * Body: { listing_id, booking_date, slot_start, user_name, user_phone,
 *         user_email?, notes?, razorpay_order_id?, razorpay_payment_id?,
 *         razorpay_signature? }
 */
export async function POST(request: Request) {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return apiError('Invalid JSON body', 400)

  const result = await bookAppointment(toFormData(body))
  if (result.error) return apiError(result.error, 400)

  return apiJson({ appointmentId: result.appointmentId })
}
