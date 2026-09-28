import { timingSafeEqual } from 'crypto'

/**
 * Comparing a caller-supplied secret against the configured one.
 *
 * Two rules, both of which this codebase had been applying inconsistently
 * before it was opened up:
 *
 * 1. Compare in constant time. `a !== b` returns as soon as it finds a
 *    differing byte, so how long it takes leaks how much of the prefix was
 *    right. Over the public internet the jitter usually buries that, but the
 *    Razorpay webhook already did this properly with timingSafeEqual and the
 *    cron routes did not, and there is no reason for the weaker one to be
 *    anyone's starting point.
 *
 * 2. Fail closed when nothing is configured. An unset secret must mean "let
 *    nobody in", never "let everybody in". The Telegram webhook used to skip
 *    its check entirely when TELEGRAM_WEBHOOK_SECRET was absent, which is the
 *    kind of default that survives right up until someone deploys without
 *    that variable and quietly has an open endpoint. `isConfigured` exists so
 *    a route can say that out loud with a 500 rather than a silent 401.
 */

/**
 * True when `candidate` equals `expected`, in time that does not depend on
 * how much of the two matched.
 *
 * `timingSafeEqual` throws unless both buffers are the same length, so the
 * lengths are compared first — which does leak the length of the expected
 * secret. That is accepted: length alone does not narrow a 128-bit random
 * value enough to matter, and the alternative (hashing both sides first) buys
 * nothing here.
 */
export function secretMatches(candidate: string | null | undefined, expected: string): boolean {
  if (!expected) return false
  if (typeof candidate !== 'string' || candidate.length === 0) return false

  const given = Buffer.from(candidate, 'utf8')
  const want = Buffer.from(expected, 'utf8')
  if (given.length !== want.length) return false

  try {
    return timingSafeEqual(given, want)
  } catch {
    return false
  }
}

/** True when the env var holds a usable, non-blank secret. */
export function isConfigured(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * The value of an `Authorization: Bearer <secret>` header, or null if the
 * header is missing or is not a bearer token. Returning null rather than the
 * raw header keeps the scheme check out of every caller.
 */
export function bearerToken(header: string | null): string | null {
  if (!header) return null
  const [scheme, ...rest] = header.split(' ')
  if (scheme.toLowerCase() !== 'bearer') return null
  const token = rest.join(' ').trim()
  return token.length > 0 ? token : null
}
