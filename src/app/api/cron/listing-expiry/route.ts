/**
 * Daily cron job — Listing Expiry & Reminder System
 *
 * Vercel runs this at 00:30 UTC (6:00am IST) every day.
 * Secured with CRON_SECRET env var.
 *
 * What it does:
 *  1. Finds approved listings whose expires_at has passed → sets approved=false + sends "expired" notification
 *  2. For each milestone (30/15/5/3/1 days before expiry), finds listings due for that reminder
 *     and sends a notification, then marks that milestone as sent in reminders_sent[]
 *
 * Notifications fan out through the unified engine (in-app + email + telegram +
 * whatsapp) based on the owner's `notification_preferences`.
 */

import { connection, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { sendNotification } from '@/lib/notifications'

export async function GET(request: Request) {
  await connection()

  // ── Auth: verify CRON_SECRET if configured ──────────────────────────────────
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
  }

  const now   = new Date()
  const stats = {
    expired:   0,
    reminded:  { 30: 0, 15: 0, 5: 0, 3: 0, 1: 0 } as Record<number, number>,
    errors:    0,
    timestamp: now.toISOString(),
  }

  // ── 1. Auto-expire listings past their expires_at ──────────────────────────
  const { data: expiredListings } = await adminClient
    .from('listings')
    .select('id, name, owner_id')
    .eq('approved', true)
    .not('expires_at', 'is', null)
    .lt('expires_at', now.toISOString())

  for (const listing of expiredListings ?? []) {
    try {
      // Unpublish the listing
      await adminClient
        .from('listings')
        .update({ approved: false })
        .eq('id', listing.id)

      // Notify owner via the unified engine (fire-and-forget, non-blocking)
      if (listing.owner_id && listing.name) {
        void sendNotification(listing.owner_id as string, 'listing.expiring', {
          listingId: listing.id as string,
          listingName: listing.name as string,
          daysLeft: 0,
        }).catch((err) => console.error('[cron/listing-expiry:expired]', err))
      }

      stats.expired++
    } catch {
      stats.errors++
    }
  }

  // ── 2. Send reminder notifications for each milestone ──────────────────────
  // For each milestone, find listings that:
  //   • are still approved (not yet expired)
  //   • have an expires_at set
  //   • will expire within `days` days from now
  //   • have NOT already had that specific reminder sent
  const milestones = [30, 15, 5, 3, 1] as const

  for (const days of milestones) {
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()

    const { data: dueListings } = await adminClient
      .from('listings')
      .select('id, name, owner_id, reminders_sent')
      .eq('approved', true)
      .not('expires_at', 'is', null)
      .gt('expires_at', now.toISOString())   // still active
      .lte('expires_at', cutoff)             // expiring within `days` days

    for (const listing of dueListings ?? []) {
      const sent = (listing.reminders_sent as number[]) ?? []

      // Skip if we already sent this milestone reminder
      if (sent.includes(days)) continue

      try {
        if (listing.owner_id && listing.name) {
          await sendNotification(listing.owner_id as string, 'listing.expiring', {
            listingId: listing.id as string,
            listingName: listing.name as string,
            daysLeft: days,
          })
        }

        // Mark this milestone as sent
        await adminClient
          .from('listings')
          .update({ reminders_sent: [...sent, days] })
          .eq('id', listing.id)

        stats.reminded[days]++
      } catch {
        stats.errors++
      }
    }
  }

  console.log('[cron/listing-expiry]', stats)
  return NextResponse.json({ ok: true, ...stats })
}
