import { NextResponse } from 'next/server'

/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * NOTE: state lives in the serverless instance's memory, so limits are enforced
 * per-instance, not globally. This still meaningfully throttles a single abuser
 * hitting a warm instance and is zero-dependency. For globally-consistent limits
 * across all instances, swap the Map for Upstash Redis (@upstash/ratelimit).
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Opportunistic cleanup so the Map doesn't grow unbounded on long-lived instances.
function sweep(now: number) {
  if (buckets.size < 5000) return
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

/**
 * @param key     Unique identifier for the caller+route (e.g. `newsletter:1.2.3.4`).
 * @param limit   Max requests allowed per window.
 * @param windowMs Window length in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: limit - 1, resetAt }
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Standard 429 response with Retry-After, for when a limit is exceeded. */
export function tooManyRequests(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'Cache-Control': 'no-store',
      },
    },
  )
}
