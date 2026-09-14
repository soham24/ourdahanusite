/**
 * Daily cron job — jobs board expiry reminders.
 *
 * Vercel runs this at 03:30 UTC (09:00 IST) every day, per vercel.json. Hobby
 * crons may fire anywhere within that hour. Secured with CRON_SECRET.
 *
 * Sends one `job.expiring` reminder for each live post within 3 days of expiry.
 * Nothing here expires posts: the board stops showing a post once its
 * expires_at passes.
 */

import { connection, NextResponse } from 'next/server'

import { daysLeft, REMINDER_WINDOW_DAYS } from '@/lib/jobs/lifecycle'
import { sendNotification } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin-client'

const DAY_MS = 86_400_000

interface DuePost {
  id: string
  kind: 'hiring' | 'seeking'
  title: string
  posted_by: string
  expires_at: string
}

export async function GET(request: Request) {
  await connection()

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
  }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * DAY_MS).toISOString()

  const { data, error } = await db
    .from('job_posts')
    .select('id, kind, title, posted_by, expires_at')
    .eq('status', 'approved')
    .is('reminder_sent_at', null)
    .gt('expires_at', now.toISOString())
    .lte('expires_at', windowEnd)
    .limit(500)

  if (error) {
    console.error('[cron/job-reminders] query failed', error.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const stats = { due: 0, sent: 0, skipped: 0, failed: 0 }

  for (const post of (data ?? []) as DuePost[]) {
    stats.due += 1

    // Claim before sending: only the run that flips reminder_sent_at from null
    // sends, so an overlapping or repeated run never double-sends.
    const { data: claimed } = await db
      .from('job_posts')
      .update({ reminder_sent_at: now.toISOString() })
      .eq('id', post.id)
      .is('reminder_sent_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) {
      stats.skipped += 1
      continue
    }

    // sendNotification never throws: false means muted, in-app off, or an error
    // it has already logged. The claim above stands either way, so no double sends.
    const delivered = await sendNotification(
      post.posted_by,
      'job.expiring',
      { postId: post.id, title: post.title, kind: post.kind, daysLeft: daysLeft(post.expires_at, now) },
      { awaitDelivery: true },
    )
    if (delivered) stats.sent += 1
    else stats.failed += 1
  }

  console.log('[cron/job-reminders]', stats)
  return NextResponse.json({ ok: true, ...stats })
}
