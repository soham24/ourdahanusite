/**
 * Pure request guards for the listing-tracking beacon. Kept out of the route
 * so they can be unit-tested without a Request object or a database.
 */

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview/i

/** True when a request should not count as a person looking at a listing. */
export function isLikelyBot(userAgent: string | null): boolean {
  // A real browser always sends a User-Agent with sendBeacon. A request
  // without one comes from a script, not a visitor.
  if (!userAgent) return true
  return BOT_UA.test(userAgent)
}

/**
 * The key to rate-limit a client address under.
 *
 * IPv4 addresses are used as-is. IPv6 addresses are cut down to their /64
 * prefix: a single host is routinely given a whole /64, so keying on the
 * full address lets anyone with a rented server rotate through an effectively
 * unlimited number of keys and never be limited. IPv4-mapped IPv6
 * (::ffff:1.2.3.4) is treated as the IPv4 address it wraps.
 */
export function ipRateLimitKey(ip: string): string {
  const trimmed = ip.trim().toLowerCase()
  if (!trimmed.includes(':')) return trimmed

  const mapped = trimmed.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapped) return mapped[1]

  // Drop a zone id (fe80::1%eth0) before parsing.
  const address = trimmed.split('%')[0]
  const [head, tail] = address.split('::')
  const headParts = head ? head.split(':') : []
  const tailParts = tail ? tail.split(':') : []
  const hextets = address.includes('::')
    ? [
        ...headParts,
        ...new Array<string>(Math.max(8 - headParts.length - tailParts.length, 0)).fill('0'),
        ...tailParts,
      ]
    : headParts

  // Not a well-formed address: key on it verbatim rather than guess.
  if (hextets.length !== 8) return address

  // Normalise leading zeros so 2001:0db8 and 2001:db8 share a key.
  return `${hextets.slice(0, 4).map((h) => h.replace(/^0+(?=.)/, '')).join(':')}::/64`
}
