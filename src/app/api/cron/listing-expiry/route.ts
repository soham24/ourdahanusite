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
import { createAdminClient } from '@/lib/supabase/admin-client'
import { runAppointmentReminders } from '@/lib/cron/appointment-reminders'
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

    // Find which milestones this listing qualifies for and hasn't been notified about
    for (const milestone of MILESTONES) {
      if (daysLeft > milestone) continue    // not yet within this window
      if (sent.includes(milestone)) continue // already sent

      try {
        if (listing.owner_id && listing.name) {
          await sendNotification(listing.owner_id as string, 'listing.expiring', {
            listingId: listing.id as string,
            listingName: listing.name as string,
            daysLeft: milestone,
          })
        }

        await adminClient
          .from('listings')
          .update({ reminders_sent: [...sent, milestone] })
          .eq('id', listing.id)

        sent.push(milestone)
        stats.reminded[milestone]++
      } catch {
        stats.errors++
      }
    }
  }

  const appointmentReminders = await runAppointmentReminders(adminClient, now)

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
  console.log('[cron/appointment-reminders]', appointmentReminders)
  return NextResponse.json({ ok: true, listings: stats, appointmentReminders })
}
