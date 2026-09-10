import { NextResponse } from 'next/server'

import { getIndiaToday } from '@/lib/india-time'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

const KINDS = new Set(['view', 'phone', 'whatsapp'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Records one listing view or contact tap.
 *
 * Always answers 204, even when nothing was written. This endpoint is called
 * by a fire-and-forget beacon on a page a customer is reading; there is no UI
 * to show an error to, and a failure here must never be visible to them.
 * "Nothing was written" is the normal case — a repeat visit on the same day
 * is expected to collide with the unique index.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: listingId } = await context.params
  if (!UUID.test(listingId)) return new NextResponse(null, { status: 204 })

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

  // Cheap ceiling on a single abuser. The unique index is the real defence
  // against inflated counts; this just stops someone burning invocations.
  const rl = rateLimit(`track:${visitorKey}`, 60, 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.resetAt)

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
  if (error && !isDuplicate) {
    console.error('[listing-events] insert failed', error.message)
    return new NextResponse(null, { status: 204 })
  }

  // Lifetime counter, incremented only for genuinely new events so it stays
  // consistent with the event rows. It exists so the dashboard tile stops
  // reading zero immediately, and so lifetime history survives the retention
  // prune of old event rows.
  if (!isDuplicate && kind === 'view') {
    await adminClient.rpc('increment_listing_views', { p_listing_id: listingId })
  }

  return new NextResponse(null, { status: 204 })
}
