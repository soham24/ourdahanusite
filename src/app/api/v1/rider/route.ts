import {
  applyAsRider, getMyRider, pingRiderLocation, setRiderOnline,
} from '@/app/actions/rider'
import {
  acceptDeliveryOffer, declineDeliveryOffer, getRiderWork,
  riderMarkDelivered, riderMarkOutForDelivery, riderMarkPickedUp,
} from '@/app/actions/dispatch'
import { getApiUser } from '@/lib/api/auth'
import { handleOptions } from '@/lib/api/cors'
import { toFormData } from '@/lib/api/form'
import { apiError, apiJson } from '@/lib/api/respond'

export function OPTIONS() {
  return handleOptions()
}

/** GET /api/v1/rider — rider profile + current offers/active delivery. */
export async function GET() {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)
  const [rider, work] = await Promise.all([getMyRider(), getRiderWork()])
  return apiJson({ rider, ...work })
}

/**
 * POST /api/v1/rider — action-dispatched rider operations.
 * Body: { action, ...args }
 *  apply { full_name, phone, vehicle_type, payout_upi }
 *  online { online }            ping { lat, lng }
 *  accept|decline { orderId }
 *  picked_up|out|delivered { orderId, otp? }
 */
export async function POST(request: Request) {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.action) return apiError('Missing action', 400)
  const action = String(body.action)
  const orderId = String(body.orderId ?? '')

  switch (action) {
    case 'apply': return wrap(await applyAsRider(toFormData(body)))
    case 'online': return wrap(await setRiderOnline(Boolean(body.online)))
    case 'ping': return wrap(await pingRiderLocation(Number(body.lat), Number(body.lng)))
    case 'accept': return wrap(await acceptDeliveryOffer(orderId))
    case 'decline': return wrap(await declineDeliveryOffer(orderId))
    case 'picked_up': return wrap(await riderMarkPickedUp(orderId))
    case 'out': return wrap(await riderMarkOutForDelivery(orderId))
    case 'delivered': return wrap(await riderMarkDelivered(orderId, String(body.otp ?? '')))
    default: return apiError('Unknown action', 400)
  }
}

function wrap(res: { error?: string; ok?: true }) {
  if (res.error) return apiError(res.error, 400)
  return apiJson({ ok: true })
}
