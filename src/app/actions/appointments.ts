'use server'

import { getUserRole, requireAdmin } from '@/app/actions/admin'
import { generateAvailableSlots, type AppointmentSlot } from '@/lib/appointment-slots'
import { revalidateAppointmentsCache } from '@/lib/cache-tags'
import {
  getAppointmentCountsForDate,
  getCachedAppointmentSettings,
  getLiveAppointmentBookingConfig,
} from '@/lib/data/appointments'
import {
  sendNotification,
  sendNotificationToAdmins,
} from '@/lib/notifications'
import {
  findFinalizedIntentByPaymentId,
  markIntentCaptured,
  markIntentFinalized,
  recordIntentError,
} from '@/lib/payment-intents'
import {
  fetchRazorpayOrder,
  validateRazorpayOrder,
} from '@/lib/payment-security'
import { normalizeInlineText, normalizePhoneOrNull } from '@/lib/listing-content'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'

export type AppointmentStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface AppointmentRecord {
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
  booking_fee: number
  payment_status: 'pending' | 'paid' | 'free'
  status: AppointmentStatus
  cancelled_by: 'user' | 'owner' | 'admin' | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
  listing?: {
    name: string
    subdomain: string | null
    category?: string | null
  } | null
}

const INDIA_TIME_ZONE = 'Asia/Kolkata'
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

function getIndiaNowInfo() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

function getAppointmentInstant(bookingDate: string, slotStart: string): Date {
  return new Date(`${bookingDate}T${slotStart}:00+05:30`)
}

function addIndiaDays(dateString: string, days: number): string {
  const base = new Date(`${dateString}T12:00:00+05:30`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

function normalizeBookingDate(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim()
  if (!DATE_REGEX.test(normalized)) return null
  const parsed = new Date(`${normalized}T12:00:00+05:30`)
  return Number.isNaN(parsed.getTime()) ? null : normalized
}

function normalizeSlotTime(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim().slice(0, 5)
  return TIME_REGEX.test(normalized) ? normalized : null
}

function parseMoney(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'))
  return Number.isFinite(parsed) ? parsed : 0
}

function validateBookingDateRange(bookingDate: string, advanceDays: number): string | null {
  const today = getIndiaNowInfo()
  const maxDate = addIndiaDays(today, advanceDays)

  if (bookingDate < today) {
    return 'Please choose today or a future date.'
  }

  if (bookingDate > maxDate) {
    return 'Selected date is outside the booking window.'
  }

  return null
}

async function resolveLiveSlots(
  listingId: string,
  bookingDate: string,
): Promise<{
  config: Awaited<ReturnType<typeof getLiveAppointmentBookingConfig>>
  slots: AppointmentSlot[]
  error?: string
}> {
  const config = await getLiveAppointmentBookingConfig(listingId)
  if (!config || !config.appointments_enabled || !config.appointment_settings) {
    return { config, slots: [], error: 'Appointments are not available for this listing.' }
  }

  const dateError = validateBookingDateRange(bookingDate, config.appointment_settings.advance_days)
  if (dateError) {
    return { config, slots: [], error: dateError }
  }

  const counts = await getAppointmentCountsForDate(listingId, bookingDate)
  const slots = generateAvailableSlots(config.appointment_settings, bookingDate, counts)
  return { config, slots }
}

async function getAppointmentAccess(appointmentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, role: 'user' as const, appointment: null }

  const { role } = await getUserRole(supabase)
  const reader = createAdminClient() ?? supabase
  const { data: appointment } = await reader
    .from('appointments')
    .select('id, listing_id, user_id, status, booking_date, slot_start, listing:listing_id(owner_id)')
    .eq('id', appointmentId)
    .maybeSingle()

  return {
    supabase,
    user,
    role,
    appointment: appointment as {
      id: string
      listing_id: string
      user_id: string
      status: AppointmentStatus
      booking_date: string
      slot_start: string
      listing?: { owner_id: string | null } | null
    } | null,
  }
}

export async function getAvailableSlotsForDate(
  listingId: string,
  bookingDate: string,
): Promise<{ error?: string; slots: AppointmentSlot[] }> {
  const normalizedDate = normalizeBookingDate(bookingDate)
  if (!listingId || !normalizedDate) {
    return { error: 'Please choose a valid date.', slots: [] }
  }

  const settings = await getCachedAppointmentSettings(listingId)
  if (!settings || !settings.appointments_enabled || !settings.appointment_settings) {
    return { slots: [] }
  }

  const dateError = validateBookingDateRange(normalizedDate, settings.appointment_settings.advance_days)
  if (dateError) {
    return { error: dateError, slots: [] }
  }

  const counts = await getAppointmentCountsForDate(listingId, normalizedDate)
  return {
    slots: generateAvailableSlots(settings.appointment_settings, normalizedDate, counts),
  }
}

export async function bookAppointment(
  formData: FormData,
): Promise<{ error?: string; appointmentId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to book an appointment.' }

  const listingId = String(formData.get('listing_id') ?? '').trim()
  const bookingDate = normalizeBookingDate(String(formData.get('booking_date') ?? ''))
  const slotStart = normalizeSlotTime(String(formData.get('slot_start') ?? ''))
  const userName = normalizeInlineText(String(formData.get('user_name') ?? ''), 80)
  const userPhone = normalizePhoneOrNull(String(formData.get('user_phone') ?? ''))
  const userEmail = normalizeInlineText(String(user.email ?? formData.get('user_email') ?? ''), 120)
  const notes = normalizeInlineText(String(formData.get('notes') ?? ''), 500)

  if (!listingId || !bookingDate || !slotStart || !userName || !userPhone) {
    return { error: 'Required booking details are missing.' }
  }

  const { config, slots, error: slotsError } = await resolveLiveSlots(listingId, bookingDate)
  if (!config || !config.appointments_enabled || !config.appointment_settings) {
    return { error: slotsError || 'Appointments are not available for this listing.' }
  }
  if (slotsError) {
    return { error: slotsError }
  }

  const selectedSlot = slots.find((slot) => slot.start === slotStart)
  if (!selectedSlot) {
    return { error: 'Selected time slot is invalid.' }
  }
  if (!selectedSlot.available) {
    return { error: 'Selected slot is already full. Please choose another time.' }
  }

  const bookingFee = parseMoney(config.appointment_booking_fee)
  let paymentStatus: 'paid' | 'free' = bookingFee > 0 ? 'paid' : 'free'
  let orderId: string | null = null
  let paymentId: string | null = null
  let signature: string | null = null

  if (bookingFee > 0) {
    paymentId = String(formData.get('razorpay_payment_id') ?? '').trim() || null
    orderId = String(formData.get('razorpay_order_id') ?? '').trim() || null
    signature = String(formData.get('razorpay_signature') ?? '').trim() || null

    if (!paymentId || !orderId || !signature) {
      return { error: 'Payment details are missing. Please try again.' }
    }

    const finalized = await findFinalizedIntentByPaymentId(paymentId)
    if (
      finalized &&
      finalized.user_id === user.id &&
      finalized.entity_table === 'appointments'
    ) {
      return { appointmentId: finalized.entity_id ?? undefined }
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
    if (!keySecret) return { error: 'Payment gateway not configured.' }

    const { createHmac } = await import('crypto')
    const expectedSignature = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')

    if (expectedSignature !== signature) {
      return { error: 'Payment verification failed. Please contact support.' }
    }

    const razorpayOrder = await fetchRazorpayOrder(orderId)
    const paymentOrderError = validateRazorpayOrder({
      order: razorpayOrder,
      flow: 'appointment',
      userId: user.id,
      expectedAmountPaise: Math.round(bookingFee * 100),
      expectedNotes: {
        flow: 'appointment',
        listing_id: listingId,
        booking_date: bookingDate,
        slot_start: slotStart,
        buyer_id: user.id,
      },
    })

    if (paymentOrderError) {
      await recordIntentError({ razorpayOrderId: orderId, message: paymentOrderError })
      return { error: paymentOrderError }
    }

    await markIntentCaptured({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })
  } else {
    paymentStatus = 'free'
  }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { data, error } = await adminClient.rpc('create_appointment_booking', {
    p_listing_id: listingId,
    p_user_id: user.id,
    p_booking_date: bookingDate,
    p_slot_start: slotStart,
    p_slot_end: selectedSlot.end,
    p_user_name: userName,
    p_user_phone: userPhone,
    p_user_email: userEmail,
    p_notes: notes,
    p_booking_fee: bookingFee,
    p_razorpay_order_id: orderId,
    p_razorpay_payment_id: paymentId,
    p_razorpay_signature: signature,
    p_payment_status: paymentStatus,
  })

  if (error || !data) {
    if (orderId) {
      await recordIntentError({
        razorpayOrderId: orderId,
        message: error?.message || 'appointment booking failed',
      })
    }

    const isSlotConflict =
      error?.message?.toLowerCase().includes('full') ||
      error?.message?.toLowerCase().includes('duplicate')

    if (isSlotConflict) {
      return {
        error:
          bookingFee > 0
            ? `That slot was taken just before confirmation. Payment ID: ${paymentId}. Please contact support.`
            : 'That slot was taken just before confirmation. Please choose another time.',
      }
    }

    return { error: error?.message || 'Unable to confirm this booking right now.' }
  }

  if (orderId) {
    await markIntentFinalized({
      razorpayOrderId: orderId,
      entityId: String(data),
      entityTable: 'appointments',
    })
  }

  revalidateAppointmentsCache(listingId)

  // Fire-and-forget notifications: fan out to owner + buyer + admins via
  // the unified notification engine.
  void (async () => {
    try {
      const { data: listing } = await adminClient
        .from('listings')
        .select('name, owner_id, subdomain')
        .eq('id', listingId)
        .maybeSingle()

      const basePayload = {
        listingId,
        listingName: String(listing?.name ?? 'Business'),
        subdomain: (listing?.subdomain as string | null) ?? null,
        customerName: userName,
        customerPhone: userPhone ?? '',
        bookingDate,
        slotStart,
        slotEnd: selectedSlot.end,
        bookingFee,
      }

      await Promise.allSettled([
        listing?.owner_id
          ? sendNotification(listing.owner_id as string, 'appointment.booked', {
              ...basePayload,
              recipient: 'owner',
            })
          : Promise.resolve(),
        sendNotification(user.id, 'appointment.booked', {
          ...basePayload,
          recipient: 'buyer',
        }),
        sendNotificationToAdmins('appointment.booked', {
          ...basePayload,
          recipient: 'admin',
        }),
      ])
    } catch (err) {
      console.error('[bookAppointment:notify]', err)
    }
  })()

  return {
    appointmentId: String(data),
  }
}

export async function cancelAppointment(
  appointmentId: string,
  reason?: string,
): Promise<{ error?: string }> {
  const { user, role, appointment } = await getAppointmentAccess(appointmentId)
  if (!user) return { error: 'Please sign in first.' }
  if (!appointment) return { error: 'Appointment not found.' }

  const isAdmin = role === 'admin' || role === 'moderator'
  const isOwner = appointment.listing?.owner_id === user.id
  const isCustomer = appointment.user_id === user.id
  if (!isAdmin && !isOwner && !isCustomer) {
    return { error: 'Access denied.' }
  }

  if (appointment.status !== 'confirmed') {
    return { error: 'Only confirmed appointments can be cancelled.' }
  }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const cancellationReason = normalizeInlineText(reason ?? '', 220)
  const cancelledBy: 'user' | 'owner' | 'admin' =
    isAdmin ? 'admin' : isOwner && !isCustomer ? 'owner' : 'user'

  const { error } = await adminClient
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_by: cancelledBy,
      cancellation_reason: cancellationReason,
    })
    .eq('id', appointmentId)

  if (error) return { error: error.message }

  // Fire-and-forget cancellation notifications to the other party
  void (async () => {
    try {
      const { data: listing } = await adminClient
        .from('listings')
        .select('name')
        .eq('id', appointment.listing_id)
        .maybeSingle()

      const listingName = String(listing?.name ?? 'Business')
      const ownerId = appointment.listing?.owner_id ?? null
      const customerId = appointment.user_id

      const promises: Promise<unknown>[] = []
      // Notify the customer unless they cancelled themselves
      if (cancelledBy !== 'user' && customerId) {
        promises.push(
          sendNotification(customerId, 'appointment.cancelled', {
            listingName,
            bookingDate: appointment.booking_date,
            slotStart: appointment.slot_start.slice(0, 5),
            recipient: 'buyer',
          }),
        )
      }
      // Notify the owner unless they cancelled it
      if (cancelledBy !== 'owner' && ownerId) {
        promises.push(
          sendNotification(ownerId, 'appointment.cancelled', {
            listingName,
            bookingDate: appointment.booking_date,
            slotStart: appointment.slot_start.slice(0, 5),
            recipient: 'owner',
          }),
        )
      }
      await Promise.allSettled(promises)
    } catch (err) {
      console.error('[cancelAppointment:notify]', err)
    }
  })()

  revalidateAppointmentsCache(appointment.listing_id)
  return {}
}

export async function getMyAppointments(): Promise<AppointmentRecord[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('appointments')
    .select('*, listing:listing_id(name, subdomain, category)')
    .eq('user_id', user.id)
    .order('booking_date', { ascending: true })
    .order('slot_start', { ascending: true })

  return (data ?? []) as AppointmentRecord[]
}

export async function getListingAppointments(listingId: string): Promise<AppointmentRecord[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!listing) return []

  const { data } = await supabase
    .from('appointments')
    .select('*, listing:listing_id(name, subdomain, category)')
    .eq('listing_id', listingId)
    .order('booking_date', { ascending: true })
    .order('slot_start', { ascending: true })

  return (data ?? []) as AppointmentRecord[]
}

export async function getMyBusinessAppointments(): Promise<AppointmentRecord[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: listings } = await supabase
    .from('listings')
    .select('id')
    .eq('owner_id', user.id)

  const listingIds = (listings ?? []).map((listing) => listing.id)
  if (listingIds.length === 0) return []

  const reader = createAdminClient() ?? supabase
  const { data } = await reader
    .from('appointments')
    .select('*, listing:listing_id(name, subdomain, category)')
    .in('listing_id', listingIds)
    .order('booking_date', { ascending: true })
    .order('slot_start', { ascending: true })

  return (data ?? []) as AppointmentRecord[]
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'completed' | 'no_show',
): Promise<{ error?: string }> {
  const { user, role, appointment } = await getAppointmentAccess(appointmentId)
  if (!user) return { error: 'Please sign in first.' }
  if (!appointment) return { error: 'Appointment not found.' }

  const isAdmin = role === 'admin' || role === 'moderator'
  const isOwner = appointment.listing?.owner_id === user.id
  if (!isAdmin && !isOwner) {
    return { error: 'Access denied.' }
  }

  if (appointment.status !== 'confirmed' && appointment.status !== 'completed' && appointment.status !== 'no_show') {
    return { error: 'This appointment cannot be updated.' }
  }

  const appointmentInstant = getAppointmentInstant(appointment.booking_date, appointment.slot_start)
  if (appointment.status === 'confirmed' && appointmentInstant.getTime() > Date.now()) {
    return { error: 'This appointment can only be marked after its scheduled time.' }
  }

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId)

  if (error) return { error: error.message }

  revalidateAppointmentsCache(appointment.listing_id)
  return {}
}

export async function updateAppointmentAdminSettings(
  listingId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  await requireAdmin(supabase)

  const appointmentsEnabled = formData.get('appointments_enabled') === 'on'
  const feeValue = Math.max(
    0,
    Math.min(100000, parseMoney(formData.get('appointment_booking_fee'))),
  )

  const adminClient = createAdminClient()
  if (!adminClient) return { error: 'Server configuration error.' }

  const { error } = await adminClient
    .from('listings')
    .update({
      appointments_enabled: appointmentsEnabled,
      appointment_booking_fee: feeValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (error) return { error: error.message }

  revalidateAppointmentsCache(listingId)
  return {}
}
