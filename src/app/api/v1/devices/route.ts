import { getApiUser } from '@/lib/api/auth'
import { handleOptions } from '@/lib/api/cors'
import { apiError, apiJson } from '@/lib/api/respond'

export function OPTIONS() {
  return handleOptions()
}

const PLATFORMS = new Set(['ios', 'android', 'web'])

/**
 * POST /api/v1/devices — register (or refresh) a push token for the signed-in
 * user. Upsert by token so re-registering the same device is idempotent.
 * Body: { token: string, platform: 'ios' | 'android' | 'web' }
 */
export async function POST(request: Request) {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)

  const body = (await request.json().catch(() => null)) as { token?: string; platform?: string } | null
  const token = body?.token?.trim()
  const platform = body?.platform?.trim()
  if (!token) return apiError('Missing device token', 400)
  if (!platform || !PLATFORMS.has(platform)) return apiError('Invalid platform', 400)

  const { error } = await auth.supabase
    .from('device_tokens')
    .upsert(
      { user_id: auth.user.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    )
  if (error) return apiError('Could not register device', 500)

  return apiJson({ ok: true })
}

/**
 * DELETE /api/v1/devices — unregister a push token (e.g. on logout).
 * Body: { token: string }
 */
export async function DELETE(request: Request) {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)

  const body = (await request.json().catch(() => null)) as { token?: string } | null
  const token = body?.token?.trim()
  if (!token) return apiError('Missing device token', 400)

  const { error } = await auth.supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('token', token)
  if (error) return apiError('Could not unregister device', 500)

  return apiJson({ ok: true })
}
