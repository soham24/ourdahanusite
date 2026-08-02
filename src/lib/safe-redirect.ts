/**
 * Decide where an OAuth callback is allowed to send the browser.
 *
 * `next` arrives from a query string, so it is attacker-controlled: without
 * this gate, /auth/callback?next=https://evil.com is an open redirect that
 * can be used to phish OurDahanu users with a genuine ourdahanu.in link.
 *
 * There is a single parse-then-validate path, on purpose: `next` is parsed
 * exactly once via `new URL(next, origin)` (which resolves relative paths
 * against `origin` and leaves absolute URLs as-is), and the resulting host
 * is checked against the allowlist below no matter which shape the input
 * had. A separate "trust relative paths" branch is what created the
 * original bug — the WHATWG URL parser treats a backslash as `/` for
 * special schemes and strips tab/LF/CR from anywhere in the input, so
 * inputs like '/\evil.com' or '/\t/evil.com' start with a single '/' yet
 * parse to a foreign host. Validating the host unconditionally closes that
 * off regardless of what the input looked like before parsing.
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

  let parsed: URL
  try {
    parsed = new URL(next, origin)
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
