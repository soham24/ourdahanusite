/**
 * Monthly cron job — each owner's summary of the month that just ended.
 *
 * Vercel runs this at 03:30 UTC (09:00 IST) on the 1st, per vercel.json.
 * Secured with CRON_SECRET. One `listing.monthly_summary` per live listing:
 * views, calls, WhatsApp taps and new reviews, and what is left to set up.
 *
 * Safe to run again: each listing is claimed by setting last_summary_month
 * before sending, so a repeated or late run sends nothing twice.
 *
 * `?dry=1` claims and sends nothing, and returns what would go out.
 */

import { connection, NextResponse } from 'next/server'

import { getIndiaToday } from '@/lib/india-time'
import { listingCompleteness } from '@/lib/listing-completeness'
import type { ListingEventRow } from '@/lib/listing-stats'
import { monthTotals, summaryMonth } from '@/lib/monthly-summary'
import { sendNotification } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { bearerToken, isConfigured, secretMatches } from '@/lib/http/shared-secret'

/** PostgREST's default page size; events are paged like the owner dashboard does. */
const PAGE = 1000

type SummaryListing = {
  id: string
  name: string
  subdomain: string | null
  owner_id: string | null
  last_summary_month: string | null
  image_url: string | null
  cover_image: string | null
  description: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  map_url: string | null
  photos: unknown
  opening_hours: unknown
  appointments_enabled: boolean | null
  appointment_settings: unknown
}

export async function GET(request: Request) {
  await connection()

  const cronSecret = process.env.CRON_SECRET
  if (!isConfigured(cronSecret)) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (!secretMatches(bearerToken(request.headers.get('authorization')), cronSecret.trim())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  if (!db) return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })

  const month = summaryMonth(getIndiaToday())
  const dryRun = new URL(request.url).searchParams.get('dry') === '1'
  const preview: { listing: string; views: number; taps: number; newReviews: number; todo: number }[] = []

  const { data: listingData, error: listingError } = await db
    .from('listings')
    .select('id, name, subdomain, owner_id, last_summary_month, image_url, cover_image, description, phone, whatsapp, address, map_url, photos, opening_hours, appointments_enabled, appointment_settings')
    .eq('approved', true)
    .not('owner_id', 'is', null)
  if (listingError) {
    console.error('[cron/monthly-summary] listings query failed', listingError.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
  const listings = ((listingData ?? []) as SummaryListing[]).filter((l) => l.last_summary_month !== month.key)
  if (listings.length === 0) return NextResponse.json({ ok: true, month: month.key, due: 0 })
  const ids = listings.map((l) => l.id)

  // A wrong number in someone's inbox is worse than a late one: any failed
  // read stops the run, and the next run picks the month up again.
  const events: ListingEventRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('listing_events')
      .select('listing_id, kind, day')
      .in('listing_id', ids)
      .gte('day', month.priorStart)
      .lte('day', month.end)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[cron/monthly-summary] events query failed', error.message)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
    events.push(...((data ?? []) as ListingEventRow[]))
    if (!data || data.length < PAGE) break
  }

  const [{ data: reviewData, error: reviewError }, { data: itemData, error: itemError }] = await Promise.all([
    db
      .from('reviews')
      .select('listing_id')
      .in('listing_id', ids)
      .gte('created_at', `${month.start}T00:00:00+05:30`)
      .lte('created_at', `${month.end}T23:59:59.999+05:30`),
    db.from('listing_products').select('listing_id').eq('is_active', true).in('listing_id', ids),
  ])
  if (reviewError || itemError) {
    console.error('[cron/monthly-summary] reviews or items query failed', (reviewError ?? itemError)?.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const totals = monthTotals(events, month)
  const countBy = (rows: { listing_id: string }[] | null) => {
    const counts = new Map<string, number>()
    for (const row of rows ?? []) counts.set(row.listing_id, (counts.get(row.listing_id) ?? 0) + 1)
    return counts
  }
  const reviewCounts = countBy(reviewData as { listing_id: string }[] | null)
  const itemCounts = countBy(itemData as { listing_id: string }[] | null)

  const stats = { due: listings.length, sent: 0, quiet: 0, skipped: 0, failed: 0 }

  for (const listing of listings) {
    const t = totals[listing.id] ?? { views: 0, phone: 0, whatsapp: 0, priorViews: 0 }
    const newReviews = reviewCounts.get(listing.id) ?? 0
    const todo = listingCompleteness({ ...listing, itemCount: itemCounts.get(listing.id) ?? 0 }).missing

    if (dryRun) {
      preview.push({ listing: listing.name, views: t.views, taps: t.phone + t.whatsapp, newReviews, todo: todo.length })
      continue
    }

    // Claim first. The filter makes it a compare-and-set: a concurrent run
    // that already claimed this month leaves this update matching nothing.
    const { data: claimed } = await db
      .from('listings')
      .update({ last_summary_month: month.key })
      .eq('id', listing.id)
      .or(`last_summary_month.is.null,last_summary_month.neq.${month.key}`)
      .select('id')
    if (!claimed || claimed.length === 0) {
      stats.skipped += 1
      continue
    }

    // Nothing happened and nothing to do: no email saying "0 views".
    if (t.views + t.phone + t.whatsapp + newReviews === 0 && todo.length === 0) {
      stats.quiet += 1
      continue
    }

    const delivered = await sendNotification(
      listing.owner_id!,
      'listing.monthly_summary',
      {
        listingId: listing.id,
        listingName: listing.name,
        subdomain: listing.subdomain,
        monthLabel: month.label,
        views: t.views,
        priorViews: t.priorViews,
        phone: t.phone,
        whatsapp: t.whatsapp,
        newReviews,
        todo: todo.map((step) => ({ label: step.label, href: step.href })),
      },
      { awaitDelivery: true },
    )
    if (delivered) stats.sent += 1
    else stats.failed += 1
  }

  if (dryRun) return NextResponse.json({ ok: true, dryRun: true, month: month.key, due: stats.due, preview })
  console.log('[cron/monthly-summary]', month.key, stats)
  return NextResponse.json({ ok: true, month: month.key, ...stats })
}
