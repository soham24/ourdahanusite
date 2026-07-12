const SHARED_AUTH_COOKIE_DOMAIN = '.ourdahanu.in'
const LEGACY_AUTH_COOKIE_NAME = /^sb-[A-Za-z0-9_-]+-auth-token(?:\.\d+)?$/

export type AuthCookieOptions = {
  domain?: string
}

export function getAuthCookieOptions(siteUrl?: string): AuthCookieOptions {
  if (!siteUrl) return {}

  try {
    const hostname = new URL(siteUrl).hostname.toLowerCase()
    if (hostname === 'ourdahanu.in' || hostname.endsWith('.ourdahanu.in')) {
      return { domain: SHARED_AUTH_COOKIE_DOMAIN }
    }
  } catch {
    // Invalid or incomplete URLs are treated as local/non-production config.
  }

  return {}
}

/**
 * Build host-only deletion cookies for auth-token cookies written before the
 * shared `.ourdahanu.in` domain was configured. Omitting Domain is deliberate:
 * it deletes only the legacy cookie for the current host and preserves the new
 * shared-domain cookie. PKCE code-verifier cookies never match this pattern.
 */
export function getLegacyHostOnlyAuthCookieRemovals(cookieHeader: string): string[] {
  const names = new Set<string>()

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    const name = (separator === -1 ? part : part.slice(0, separator)).trim()
    if (LEGACY_AUTH_COOKIE_NAME.test(name)) names.add(name)
  }

  return [...names].map((name) => `${name}=; Path=/; Max-Age=0; SameSite=Lax`)
}
