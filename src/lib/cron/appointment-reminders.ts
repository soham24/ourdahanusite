import { addIndiaDays, getIndiaToday } from '@/lib/india-time'
import { sendNotification } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin-client'

const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

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

export type AppointmentReminderStats = {
  checked: number
  queued: number
  ownerSent: number
  customerSent: number
  errors: number
  timestamp: string
}

function getAppointmentInstant(bookingDate: string, slotStart: string): Date {
  return new Date(`${bookingDate}T${slotStart}:00+05:30`)
}

export async function runAppointmentReminders(
  adminClient: AdminClient,
  now = new Date()
): Promise<AppointmentReminderStats> {
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

    const appointmentStart = getAppointmentInstant(appointment.booking_date, appointment.slot_start.slice(0, 5))
    if (appointmentStart.getTime() <= now.getTime()) continue
    if (appointmentStart.getTime() > reminderCutoff.getTime()) continue

    const ownerReminderPending = !appointment.owner_reminder_sent_at
    const customerReminderPending = !appointment.customer_reminder_sent_at
    if (!ownerReminderPending && !customerReminderPending) continue

    stats.queued++

    try {
      const basePayload = {
        listingId: appointment.listing_id,
        listingName: appointment.listing?.name ?? 'Business',
        subdomain: appointment.listing?.subdomain ?? null,
        bookingDate: appointment.booking_date,
        slotStart: appointment.slot_start.slice(0, 5),
        slotEnd: appointment.slot_end.slice(0, 5),
      }

      const ownerId = appointment.listing?.owner_id ?? null
      const sendOwner =
        ownerReminderPending && ownerId
          ? sendNotification(ownerId, 'appointment.reminder', {
              ...basePayload,
              recipient: 'owner',
            })
          : Promise.resolve(false)
      const sendCustomer = customerReminderPending
        ? sendNotification(appointment.user_id, 'appointment.reminder', {
            ...basePayload,
            recipient: 'buyer',
          })
        : Promise.resolve(false)

      const [ownerResult, customerResult] = await Promise.allSettled([sendOwner, sendCustomer])

      const ownerOk =
        ownerResult.status === 'fulfilled' ? Boolean(ownerResult.value) : false
      const customerOk =
        customerResult.status === 'fulfilled' ? Boolean(customerResult.value) : false

      const sentAt = new Date().toISOString()
      const patch: Record<string, string> = {}

      // Mark the reminder as sent even if the dispatcher didn't write an
      // in-app row; it may have dispatched email/telegram/whatsapp instead.
      if (ownerReminderPending && ownerResult.status === 'fulfilled') {
        patch.owner_reminder_sent_at = sentAt
        if (ownerOk) stats.ownerSent++
      }
      if (customerReminderPending && customerResult.status === 'fulfilled') {
        patch.customer_reminder_sent_at = sentAt
        if (customerOk) stats.customerSent++
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

  return stats
}
