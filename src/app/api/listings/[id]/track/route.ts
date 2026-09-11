import { NextResponse } from 'next/server'

import { getIndiaToday } from '@/lib/india-time'
import { getClientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { ipRateLimitKey, isLikelyBot } from '@/lib/track-request'

const KINDS = new Set(['view', 'phone', 'whatsapp'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Records one listing view or contact tap.
 *
 * Answers 204 on every path except the IP rate limit's 429, even when
 * nothing was written. This endpoint is called by a fire-and-forget beacon on
 * a page a customer is reading; there is no UI to show an error to, and a
 * failure here must never be visible to them. "Nothing was written" is the
 * normal case — a repeat visit on the same day is expected to collide with
 * the unique index.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: listingId } = await context.params
  if (!UUID.test(listingId)) return new NextResponse(null, { status: 204 })

  // Keyed on IP, deliberately NOT on visitorKey: the caller invents its own
  // visitorKey, so a key-based limit is bypassed by rotating it — and rotating
  // it also mints a fresh row under the unique index, defeating the per-day
  // dedupe at the same time. IP is the only identifier here the caller does
  // not simply choose. Matches check-subdomain and newsletter, which key the
  // same limiter the same way.
  //
  // The key is cut down to a /64 for an IPv6 address: a single rented server
  // is routinely handed a whole /64, so keying on the full address would let
  // one abuser rotate through effectively unlimited keys and never be
  // limited. Run before the body is read so a request that will never be
  // valid is rejected as cheaply as possible.
  const ipKey = ipRateLimitKey(getClientIp(request))
  const rl = rateLimit(`track:${ipKey}`, 60, 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.resetAt)

  let kind = ''
  let visitorKey = ''
  try {
    const body = (await request.json()) as { kind?: string; visitorKey?: string }
    kind = String(body.kind ?? '')
    visitorKey = String(body.visitorKey ?? '').trim().slice(0, 64)
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  if (!KINDS.has(kind) || visitorKey.length < 8) {
    return new NextResponse(null, { status: 204 })
  }

  // A crawler that runs JavaScript starts with empty storage on every visit,
  // so without this every render of a page it fetches would count as a new
  // visitor's view.
  if (isLikelyBot(request.headers.get('user-agent'))) {
    return new NextResponse(null, { status: 204 })
  }

  // A second, tighter limiter per target. Per-day dedupe already means one
  // real person produces at most one event per kind per listing per day, so
  // ten distinct people from one address hitting the same listing within an
  // hour is already a lot. The cap is 10 rather than lower because many
  // mobile users in India share a single IPv4 address behind carrier-grade
  // NAT, and undercounting their genuine views is worse than a slightly
  // looser cap. It answers 204 rather than 429 because the caller is a
  // fire-and-forget beacon with no way to act on a 429.
  const targetRl = rateLimit(`track:${ipKey}:${listingId}:${kind}`, 10, 60 * 60 * 1000)
  if (!targetRl.ok) return new NextResponse(null, { status: 204 })

  const adminClient = createAdminClient()
  if (!adminClient) return new NextResponse(null, { status: 204 })

  // The owner must never move their own numbers. The first thing an owner
  // does with a view counter is open their own listing and watch it; if it
  // climbs, they stop believing the contact figures too.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: listing } = await adminClient
      .from('listings')
      .select('owner_id')
      .eq('id', listingId)
      .maybeSingle()
    if (listing?.owner_id === user.id) {
      return new NextResponse(null, { status: 204 })
    }
  }

  const { error } = await adminClient.from('listing_events').insert({
    listing_id: listingId,
    kind,
    visitor_key: visitorKey,
    day: getIndiaToday(),
  })

  // 23505 is the unique index doing its job: this visitor already counted for
  // this kind today. That is success, not an error.
  const isDuplicate = error?.code === '23505'
  // 23503 is a foreign-key violation: a well-formed UUID for a listing that
  // does not exist (deleted, or simply made up). Not an error worth logging —
  // it is indistinguishable from someone probing the endpoint with a random
  // id, and it happens on every request from a stale cached page too.
  const isMissingListing = error?.code === '23503'
  if (error && !isDuplicate && !isMissingListing) {
    console.error('[listing-events] insert failed', error.message)
    return new NextResponse(null, { status: 204 })
  }

  // Lifetime counter, incremented only for genuinely new events so it stays
  // consistent with the event rows. It exists so the dashboard tile stops
  // reading zero immediately, and so lifetime history survives the retention
  // prune of old event rows.
  if (!isDuplicate && !isMissingListing && kind === 'view') {
    const { error: rpcError } = await adminClient.rpc('increment_listing_views', {
      p_listing_id: listingId,
    })
    if (rpcError) {
      console.error('[listing-events] increment_listing_views failed', rpcError.message)
    }
  }

  return new NextResponse(null, { status: 204 })
}
