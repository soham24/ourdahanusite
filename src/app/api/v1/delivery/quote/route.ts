import { getServiceabilityQuote } from '@/app/actions/delivery'
import { getApiUser } from '@/lib/api/auth'
import { handleOptions } from '@/lib/api/cors'
import { apiError, apiJson } from '@/lib/api/respond'

export function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/v1/delivery/quote — serviceability + delivery fee for a drop pin.
 * Body: { listingId, lat, lng, itemsTotalPaise }
 */
export async function POST(request: Request) {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)

  const body = (await request.json().catch(() => null)) as
    { listingId?: string; lat?: number; lng?: number; itemsTotalPaise?: number } | null
  if (!body?.listingId) return apiError('Missing listingId', 400)
  const lat = Number(body.lat), lng = Number(body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return apiError('Invalid coordinates', 400)

  const res = await getServiceabilityQuote(body.listingId, { lat, lng }, Math.max(0, Math.floor(Number(body.itemsTotalPaise) || 0)))
  if (res.error) return apiError(res.error, 422)
  return apiJson({ quote: res.quote, pickup: res.pickup })
}
