/**
 * "Who is signed in?" without a round trip to Supabase Auth.
 *
 * `auth.getUser()` asks the Auth server (which queries the database) on every
 * call. `auth.getClaims()` verifies the session JWT instead:
 *
 * - With asymmetric signing keys (RS256/ES256, enabled in the Supabase
 *   dashboard under Project Settings → JWT keys) it checks the signature
 *   locally against the project's JWKS, which auth-js caches in memory per
 *   server instance for 10 minutes. No database work.
 * - With the legacy shared secret (HS256) it cannot verify locally, so it
 *   falls back to `getUser(token)` — exactly today's cost.
 *
 * Either way an expired token is rejected. What it does NOT catch is a session
 * revoked (signed out elsewhere, user banned or deleted) before its access
 * token expires (at most `jwt_expiry`, one hour). That is the same trust
 * PostgREST already gives the token for RLS, so it is fine for "whose data
 * should this read" and ordinary actions. Payments, orders, admin and
 * moderator actions, and anything that hands over other people's data keep
 * calling `auth.getUser()`.
 *
 * Mobile requests (`Authorization: Bearer <jwt>`) work too: the client from
 * `createClient()` in ./server defaults `getClaims()` to that token.
 */

/** The parts of the verified JWT the app uses. */
export type AuthIdentity = {
  id: string
  email: string | null
  phone: string | null
  isAnonymous: boolean
  /** Same data as `user.user_metadata` (name, avatar), as of token issue. */
  userMetadata: Record<string, unknown>
}

type ClaimsResult = {
  data: { claims: unknown } | null
  error: unknown
}

/** Anything with `auth.getClaims()` — the server client, or a test fake. */
export type ClaimsClient = {
  auth: { getClaims(): Promise<ClaimsResult> }
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * Turns verified claims into an identity, or null when they don't describe a
 * signed-in user. Rejects the anon/service keys (no `sub`, role not
 * `authenticated`) and, as a second line behind auth-js, expired tokens.
 */
export function identityFromClaims(
  claims: unknown,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): AuthIdentity | null {
  if (!claims || typeof claims !== 'object') return null
  const c = claims as Record<string, unknown>

  const id = nonEmptyString(c.sub)
  if (!id) return null
  if (c.role !== 'authenticated') return null
  if (typeof c.exp !== 'number' || c.exp <= nowSeconds) return null

  const metadata = c.user_metadata
  return {
    id,
    email: nonEmptyString(c.email),
    phone: nonEmptyString(c.phone),
    isAnonymous: c.is_anonymous === true,
    userMetadata:
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
  }
}

/**
 * The signed-in user's identity from the verified session JWT, or null when
 * signed out or the token doesn't verify. Never throws.
 */
export async function getAuthIdentity(supabase: ClaimsClient): Promise<AuthIdentity | null> {
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data) return null
    return identityFromClaims(data.claims)
  } catch {
    return null
  }
}

/** Just the signed-in user's id, or null. */
export async function getAuthUserId(supabase: ClaimsClient): Promise<string | null> {
  return (await getAuthIdentity(supabase))?.id ?? null
}
