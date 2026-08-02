/**
 * Decide where an OAuth callback is allowed to send the browser.
 *
 * `next` arrives from a query string, so it is attacker-controlled: without
 * this gate, /auth/callback?next=https://evil.com is an open redirect that
 * can be used to phish OurDahanu users with a genuine ourdahanu.in link.
 *
 * Allowed:
 *   - relative paths beginning with a single '/'
 *   - https URLs on ourdahanu.in or any *.ourdahanu.in subdomain
 *   - localhost (any port, any subdomain) so local dev sign-in works
 * Everything else falls back to the origin root.
 */
export function resolveSafeRedirect(next: string | null, origin: string): string {
  const fallback = new URL('/', origin).toString()
  if (!next) return fallback

  // '//evil.com' is protocol-relative — the browser treats it as a foreign
  // host, so it must not be mistaken for a relative path.
  if (next.startsWith('//')) return fallback

  if (next.startsWith('/')) {
    try {
      return new URL(next, origin).toString()
    } catch {
      return fallback
    }
  }

  let parsed: URL
  try {
    parsed = new URL(next)
  } catch {
    return fallback
  }

  const host = parsed.hostname.toLowerCase()
  const isLocalhost = host === 'localhost' || host.endsWith('.localhost')

  // Only https off-localhost: http would let a network attacker strip TLS.
  if (parsed.protocol !== (isLocalhost ? 'http:' : 'https:')) return fallback

  // Note the leading dot on the suffix check: 'notourdahanu.in' and
  // 'ourdahanu.in.evil.com' must both fail.
  const isOurDomain = host === 'ourdahanu.in' || host.endsWith('.ourdahanu.in')
  if (!isOurDomain && !isLocalhost) return fallback

  return parsed.toString()
}
