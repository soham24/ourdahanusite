import { NextResponse } from 'next/server'

import { sendAppointmentReminderEmails } from '@/lib/notify-appointment'
import { createAdminClient } from '@/lib/supabase/admin-client'

const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000

function getIndiaToday(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

function addIndiaDays(dateString: string, days: number): string {
  const base = new Date(`${dateString}T12:00:00+05:30`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

function getAppointmentInstant(bookingDate: string, slotStart: string): Date {
  return new Date(`${bookingDate}T${slotStart}:00+05:30`)
}

type AppointmentReminderRow = {
  id: string
  listing_id: string
  user_id: string
  booking_date: string
  slot_start: string
  slot_end: string
  user_name: string
  user_phone: string
  user_email: string | null
  notes: string | null
  booking_fee: number | string | null
  owner_reminder_sent_at: string | null
  customer_reminder_sent_at: string | null
  listing?: {
    name: string | null
    subdomain: string | null
    owner_id: string | null
  } | Array<{
    name: string | null
    subdomain: string | null
    owner_id: string | null
  }> | null
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'))
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const adminClient = createAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
  }

  const now = new Date()
  const reminderCutoff = new Date(now.getTime() + REMINDER_WINDOW_MS)
  const today = getIndiaToday()
  const tomorrow = addIndiaDays(today, 1)

  const stats = {
    checked: 0,
    queued: 0,
    ownerSent: 0,
    customerSent: 0,
    errors: 0,
    timestamp: now.toISOString(),
  }

  const { data } = await adminClient
    .from('appointments')
    .select('id, listing_id, user_id, booking_date, slot_start, slot_end, user_name, user_phone, user_email, notes, booking_fee, owner_reminder_sent_at, customer_reminder_sent_at, listing:listing_id(name, subdomain, owner_id)')
    .eq('status', 'confirmed')
    .gte('booking_date', today)
    .lte('booking_date', tomorrow)
    .or('owner_reminder_sent_at.is.null,customer_reminder_sent_at.is.null')
    .order('booking_date', { ascending: true })
    .order('slot_start', { ascending: true })

  const appointments = ((data ?? []) as AppointmentReminderRow[]).map((appointment) => ({
    ...appointment,
    listing: Array.isArray(appointment.listing)
      ? (appointment.listing[0] ?? null)
      : (appointment.listing ?? null),
  }))

  for (const appointment of appointments) {
    stats.checked++

    const appointmentStart = getAppointmentInstant(appointment.booking_date, appointment.slot_start)
    if (appointmentStart.getTime() <= now.getTime()) continue
    if (appointmentStart.getTime() > reminderCutoff.getTime()) continue

    const ownerReminderPending = !appointment.owner_reminder_sent_at
    const customerReminderPending = !appointment.customer_reminder_sent_at
    if (!ownerReminderPending && !customerReminderPending) continue

    stats.queued++

    try {
      const result = await sendAppointmentReminderEmails({
        listingId: appointment.listing_id,
        listingName: appointment.listing?.name ?? 'Business',
        listingSubdomain: appointment.listing?.subdomain ?? null,
        ownerUserId: appointment.listing?.owner_id ?? null,
        customerUserId: appointment.user_id,
        customerName: appointment.user_name,
        customerPhone: appointment.user_phone,
        customerEmail: appointment.user_email,
        bookingDate: appointment.booking_date,
        slotStart: appointment.slot_start.slice(0, 5),
        slotEnd: appointment.slot_end.slice(0, 5),
        bookingFee: toNumber(appointment.booking_fee),
        notes: appointment.notes,
        ownerReminderPending,
        customerReminderPending,
      })

      const sentAt = new Date().toISOString()
      const patch: Record<string, string> = {}

      if (result.ownerSent && ownerReminderPending) {
        patch.owner_reminder_sent_at = sentAt
        stats.ownerSent++
      }

      if (result.customerSent && customerReminderPending) {
        patch.customer_reminder_sent_at = sentAt
        stats.customerSent++
      }

      if (Object.keys(patch).length > 0) {
        await adminClient
          .from('appointments')
          .update(patch)
          .eq('id', appointment.id)
      }
    } catch (error) {
      stats.errors++
      console.error('[cron/appointment-reminders]', {
        appointmentId: appointment.id,
        error,
      })
    }
  }

  console.log('[cron/appointment-reminders]', stats)
  return NextResponse.json({ ok: true, ...stats })
}
