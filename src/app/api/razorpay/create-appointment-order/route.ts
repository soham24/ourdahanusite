import { NextResponse } from 'next/server'

import {
  getLiveAppointmentBookingConfig,
  getSlotsForDate,
} from '@/lib/data/appointments'
import { recordPaymentIntent } from '@/lib/payment-intents'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

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

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to book an appointment.' }, { status: 401 })
  }

  const rl = rateLimit(`rzp-order:${user.id}`, 20, 10 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.resetAt)

  const keyId = process.env.RAZORPAY_KEY_ID?.trim()
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()

  let listingId = ''
  let bookingDate = ''
  let slotStart = ''

  try {
    const body = await request.json() as {
      listingId: string
      bookingDate: string
      slotStart: string
    }

    listingId = body.listingId?.trim() || ''
    bookingDate = body.bookingDate?.trim() || ''
    slotStart = body.slotStart?.trim().slice(0, 5) || ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!listingId || !DATE_REGEX.test(bookingDate) || !TIME_REGEX.test(slotStart)) {
    return NextResponse.json({ error: 'Missing booking details.' }, { status: 400 })
  }

  const config = await getLiveAppointmentBookingConfig(listingId)
  if (!config || !config.appointments_enabled || !config.appointment_settings) {
    return NextResponse.json({ error: 'Appointments are not available for this listing.' }, { status: 404 })
  }

  const today = getIndiaToday()
  const maxDate = addIndiaDays(today, config.appointment_settings.advance_days)
  if (bookingDate < today || bookingDate > maxDate) {
    return NextResponse.json({ error: 'Selected date is outside the booking window.' }, { status: 400 })
  }

  const slots = await getSlotsForDate(listingId, config.appointment_settings, bookingDate)
  const selectedSlot = slots.find((slot) => slot.start === slotStart)

  if (!selectedSlot) {
    return NextResponse.json({ error: 'Selected slot is invalid.' }, { status: 400 })
  }

  if (!selectedSlot.available) {
    return NextResponse.json({ error: 'Selected slot is already full.' }, { status: 409 })
  }

  const amountRupees = Number.isFinite(config.appointment_booking_fee)
    ? config.appointment_booking_fee
    : 0

  if (amountRupees <= 0) {
    return NextResponse.json({
      isFree: true,
      bookingFee: 0,
      slotEnd: selectedSlot.end,
    })
  }

  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 500 })
  }

  const amountPaise = Math.round(amountRupees * 100)
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: `appointment_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        flow: 'appointment',
        listing_id: listingId,
        listing_name: config.listingName,
        booking_date: bookingDate,
        slot_start: slotStart,
        slot_end: selectedSlot.end,
        buyer_id: user.id,
      },
    }),
  })

  const order = await response.json()
  if (!response.ok) {
    console.error('[Razorpay appointment] Order creation failed:', order)
    return NextResponse.json({
      error: order.error?.description || `Razorpay error ${response.status}`,
    }, { status: 500 })
  }

  await recordPaymentIntent({
    userId: user.id,
    flow: 'appointment',
    razorpayOrderId: order.id as string,
    amountPaise,
    currency: 'INR',
    payload: {
      listing_id: listingId,
      booking_date: bookingDate,
      slot_start: slotStart,
      slot_end: selectedSlot.end,
      booking_fee: amountRupees,
    },
    listingId,
  })

  return NextResponse.json({
    isFree: false,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    bookingFee: amountRupees,
    slotEnd: selectedSlot.end,
    listingName: config.listingName,
  })
}
