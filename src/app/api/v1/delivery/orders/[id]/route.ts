import { cancelMyDeliveryOrder, getDeliveryTracking, rateDelivery } from '@/app/actions/delivery'
import { getApiUser } from '@/lib/api/auth'
import { handleOptions } from '@/lib/api/cors'
import { apiError, apiJson } from '@/lib/api/respond'

export function OPTIONS() {
  return handleOptions()
}

/** GET /api/v1/delivery/orders/[id] — live tracking for the customer's order. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)
  const { id } = await params
  const res = await getDeliveryTracking(id)
  if (res.error) return apiError(res.error, 404)
  return apiJson({ tracking: res.tracking })
}

/**
 * PATCH /api/v1/delivery/orders/[id] — { action: 'rate'|'cancel', rating? }.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)
  const { id } = await params
  const body = (await request.json().catch(() => null)) as { action?: string; rating?: number } | null

  if (body?.action === 'rate') {
    const res = await rateDelivery(id, Number(body.rating))
    return res.error ? apiError(res.error, 400) : apiJson({ ok: true })
  }
  if (body?.action === 'cancel') {
    const res = await cancelMyDeliveryOrder(id)
    return res.error ? apiError(res.error, 400) : apiJson({ ok: true })
  }
  return apiError('Unknown action', 400)
}
