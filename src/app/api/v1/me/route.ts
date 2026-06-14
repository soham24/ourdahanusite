import { getApiUser } from '@/lib/api/auth'
import { apiError, apiJson } from '@/lib/api/respond'
import { handleOptions } from '@/lib/api/cors'

export function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/v1/me — the authenticated user's identity + profile.
 * Proves the dual-auth contract: works with a Supabase JWT (native app) or
 * the session cookie (web). RLS scopes the profile read to the caller.
 */
export async function GET() {
  const auth = await getApiUser()
  if (!auth) return apiError('Unauthorized', 401)

  const { user, supabase } = auth
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, phone, address, bio, is_admin, role')
    .eq('id', user.id)
    .maybeSingle()

  return apiJson({
    user: { id: user.id, email: user.email },
    profile: profile ?? null,
  })
}
