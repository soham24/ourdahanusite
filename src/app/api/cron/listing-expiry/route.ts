/**
 * Weekly cron job — Listing Expiry & Reminder System
 *
 * Vercel runs this at 00:00 UTC on Mondays (5:30am IST), per `vercel.json`.
 * Secured with CRON_SECRET env var.
 *
 * What it does:
 *  1. Finds approved listings whose expires_at has passed → bulk sets approved=false + sends notifications
 *  2. Fetches all listings expiring within 30 days in ONE query, filters by milestone in JS,
 *     sends notification and marks milestone sent per listing
 *
 * Notifications fan out through the unified engine (in-app + email + telegram +
 * whatsapp) based on the owner's `notification_preferences`.
 */

import { connection, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { sendNotification } from '@/lib/notifications'
import { addIndiaDays, getIndiaToday } from '@/lib/india-time'
import { bearerToken, isConfigured, secretMatches } from '@/lib/http/shared-secret'

const MILESTONES = [30, 15, 5, 3, 1] as const
const MS_PER_DAY = 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  await connection()

  const cronSecret = process.env.CRON_SECRET
  if (!isConfigured(cronSecret)) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }

  if (!secretMatches(bearerToken(request.headers.get('authorization')), cronSecret.trim())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
  }

  const now = new Date()
  const stats = {
    expired: 0,
    reminded: { 30: 0, 15: 0, 5: 0, 3: 0, 1: 0 } as Record<number, number>,
    errors: 0,
    timestamp: now.toISOString(),
  }

  // ── 1. Auto-expire listings past their expires_at ──────────────────────────
  const { data: expiredListings } = await adminClient
    .from('listings')
    .select('id, name, owner_id')
    .eq('approved', true)
    .not('expires_at', 'is', null)
    .lt('expires_at', now.toISOString())

  if (expiredListings && expiredListings.length > 0) {
    // Bulk unpublish in one UPDATE instead of N individual updates
    const expiredIds = expiredListings.map((l) => l.id as string)
    await adminClient
      .from('listings')
      .update({ approved: false })
      .in('id', expiredIds)

    // Without this the homepage, directory and each business page kept
    // showing expired listings -- shop and booking included -- for up to a
    // day. updateTag is for Server Actions; a route handler uses
    // revalidateTag, as create-marketplace-order does.
    for (const tag of [CACHE_TAGS.home, CACHE_TAGS.listings, CACHE_TAGS.listingCategories, CACHE_TAGS.appointments]) {
      revalidateTag(tag, 'max')
    }
    for (const id of expiredIds) revalidateTag(CACHE_TAGS.listing(id), 'max')

    // Notifications still need to fire per-listing (awaited delivery)
    for (const listing of expiredListings) {
      if (listing.owner_id && listing.name) {
        await sendNotification(listing.owner_id as string, 'listing.expiring', {
          listingId: listing.id as string,
          listingName: listing.name as string,
          daysLeft: 0,
        }).catch((err) => console.error('[cron/listing-expiry:expired]', err))
      }
      stats.expired++
    }
  }

  // ── 2. Send reminder notifications for milestones ─────────────────────────
  // ONE query fetches all approved listings expiring within the widest window (30 days).
  // JS then filters per milestone rather than making 5 separate DB round-trips.
  const maxCutoff = new Date(now.getTime() + 30 * MS_PER_DAY).toISOString()

  const { data: upcomingListings } = await adminClient
    .from('listings')
    .select('id, name, owner_id, reminders_sent, expires_at')
    .eq('approved', true)
    .not('expires_at', 'is', null)
    .gt('expires_at', now.toISOString())
    .lte('expires_at', maxCutoff)

  for (const listing of upcomingListings ?? []) {
    const sent = (listing.reminders_sent as number[]) ?? []
    const expiresAt = new Date(listing.expires_at as string).getTime()
    const daysLeft = Math.floor((expiresAt - now.getTime()) / MS_PER_DAY)

    // Every milestone this listing has passed and not been told about. The
    // cron runs weekly, so several can come due at once: one seen with a day
    // left has passed 30, 15, 5, 3 and 1. Sending each was a burst of
    // contradictory messages ("3 days left", "1 day left") in one go, so the
    // owner gets one, with the real number of days, and all are marked sent.
    const due = MILESTONES.filter((milestone) => daysLeft <= milestone && !sent.includes(milestone))
    if (due.length === 0) continue
    const closest = Math.min(...due)

    try {
      if (listing.owner_id && listing.name) {
        await sendNotification(listing.owner_id as string, 'listing.expiring', {
          listingId: listing.id as string,
          listingName: listing.name as string,
          daysLeft: Math.max(1, daysLeft),
        })
      }

      await adminClient
        .from('listings')
        .update({ reminders_sent: [...sent, ...due] })
        .eq('id', listing.id)

      stats.reminded[closest]++
    } catch {
      stats.errors++
    }
  }

  // Retention: listing_events exists to answer "this month vs last month",
  // so anything older than 180 days is dead weight on a free-tier database.
  // listings.views keeps the lifetime figure, so pruning never makes a
  // business's history appear to shrink.
  const eventCutoff = addIndiaDays(getIndiaToday(), -180)
  const { error: pruneError } = await adminClient
    .from('listing_events')
    .delete()
    .lt('day', eventCutoff)

  if (pruneError) {
    console.error('[cron:listing-expiry] listing_events prune failed', pruneError.message)
  }

  console.log('[cron/listing-expiry]', stats)
  return NextResponse.json({ ok: true, listings: stats })
}
