'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock3,
  CreditCard,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

import {
  bookAppointment,
  getAvailableSlotsForDate,
} from '@/app/actions/appointments'
import type { AppointmentSlot } from '@/lib/appointment-slots'
import type { AppointmentSettings } from '@/lib/listing-content'

type Props = {
  listingId: string
  listingName: string
  bookingFee: number
  appointmentSettings: AppointmentSettings
  isLoggedIn: boolean
  userName: string
  userPhone: string
  userEmail: string
}

type BookingStatus = 'idle' | 'loading-slots' | 'processing' | 'success' | 'error'

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal: { ondismiss: () => void }
  prefill: { name: string; contact: string; email?: string }
  theme: { color: string }
}

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

function formatSelectedDate(value: string): string {
  return new Date(`${value}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function formatTimeLabel(value: string): string {
  return new Date(`1970-01-01T${value}:00+05:30`).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

function formatSlotLabel(slot: AppointmentSlot): string {
  return `${formatTimeLabel(slot.start)} - ${formatTimeLabel(slot.end)}`
}

function getSlotPeriod(slot: AppointmentSlot): 'morning' | 'afternoon' | 'evening' {
  const hour = Number.parseInt(slot.start.split(':')[0], 10)
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

const PERIOD_META = {
  morning: { label: 'Morning', icon: '☀️' },
  afternoon: { label: 'Afternoon', icon: '🌤️' },
  evening: { label: 'Evening', icon: '🌙' },
} as const

function formatFee(value: number): string {
  return value > 0 ? `Rs ${value.toLocaleString('en-IN')}` : 'Free'
}

export default function AppointmentBooking({
  listingId,
  listingName,
  bookingFee,
  appointmentSettings,
  isLoggedIn,
  userName,
  userPhone,
  userEmail,
}: Props) {
  const pathname = usePathname()
  const today = useMemo(() => getIndiaToday(), [])
  const maxDate = useMemo(
    () => addIndiaDays(today, appointmentSettings.advance_days),
    [appointmentSettings.advance_days, today],
  )

  const [selectedDate, setSelectedDate] = useState(today)
  const [slots, setSlots] = useState<AppointmentSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null)
  const [status, setStatus] = useState<BookingStatus>('idle')
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<{ date: string; slot: AppointmentSlot } | null>(null)
  const [scriptReady, setScriptReady] = useState(bookingFee <= 0)
  const [name, setName] = useState(userName)
  const [phone, setPhone] = useState(userPhone)
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; slot?: string }>({})

  const availableSlotsCount = useMemo(
    () => slots.filter((slot) => slot.available).length,
    [slots],
  )

  const selectedSlotLabel = selectedSlot
    ? formatSlotLabel(selectedSlot)
    : 'Pick a time slot to continue'

  const bookingHighlights = [
    {
      label: 'Fee',
      value: formatFee(bookingFee),
      tone: 'text-brand',
    },
    {
      label: 'Slot Length',
      value: `${appointmentSettings.slot_duration} min`,
      tone: 'text-gray-900',
    },
    {
      label: 'Capacity',
      value: `${appointmentSettings.capacity} / slot`,
      tone: 'text-gray-900',
    },
    {
      label: 'Booking Window',
      value: `${appointmentSettings.advance_days} days`,
      tone: 'text-gray-900',
    },
  ]

  useEffect(() => {
    setName(userName)
  }, [userName])

  useEffect(() => {
    setPhone(userPhone)
  }, [userPhone])

  useEffect(() => {
    let active = true

    async function loadSlots() {
      setStatus('loading-slots')
      setError('')
      setSelectedSlot(null)

      const result = await getAvailableSlotsForDate(listingId, selectedDate)
      if (!active) return

      setSlots(result.slots)
      setStatus('idle')

      if (result.error) {
        setError(result.error)
      } else if (result.slots.length === 0) {
        setError('No slots available for the selected date.')
      }
    }

    void loadSlots()
    return () => {
      active = false
    }
  }, [listingId, selectedDate])

  useEffect(() => {
    if (bookingFee <= 0 || document.getElementById('razorpay-script')) {
      setScriptReady(true)
      return
    }

    const script = document.createElement('script')
    script.id = 'razorpay-script'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => setScriptReady(true)
    document.body.appendChild(script)
  }, [bookingFee])

  async function submitBooking(payment?: {
    razorpay_payment_id?: string
    razorpay_order_id?: string
    razorpay_signature?: string
  }) {
    if (!selectedSlot) {
      setError('Please choose a slot first.')
      return
    }

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    if (!trimmedName || !trimmedPhone) {
      setError('Please enter your name and phone number.')
      return
    }

    setStatus('processing')
    setError('')

    const formData = new FormData()
    formData.set('listing_id', listingId)
    formData.set('booking_date', selectedDate)
    formData.set('slot_start', selectedSlot.start)
    formData.set('user_name', trimmedName)
    formData.set('user_phone', trimmedPhone)
    formData.set('user_email', userEmail)
    formData.set('notes', notes.trim())

    if (payment?.razorpay_order_id) {
      formData.set('razorpay_order_id', payment.razorpay_order_id)
    }
    if (payment?.razorpay_payment_id) {
      formData.set('razorpay_payment_id', payment.razorpay_payment_id)
    }
    if (payment?.razorpay_signature) {
      formData.set('razorpay_signature', payment.razorpay_signature)
    }

    const result = await bookAppointment(formData)
    if (result.error) {
      setStatus('error')
      setError(result.error)
      return
    }

    setConfirmation({ date: selectedDate, slot: selectedSlot })
    setStatus('success')
  }

  function validateFields(): boolean {
    const errors: { name?: string; phone?: string; slot?: string } = {}

    if (!selectedSlot) {
      errors.slot = 'Please select a time slot.'
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      errors.name = 'Name is required.'
    } else if (trimmedName.length < 2) {
      errors.name = 'Name must be at least 2 characters.'
    }

    const trimmedPhone = phone.trim().replace(/[\s\-()]/g, '')
    if (!trimmedPhone) {
      errors.phone = 'Phone number is required.'
    } else if (!/^\+?\d{10,13}$/.test(trimmedPhone)) {
      errors.phone = 'Enter a valid 10-digit phone number.'
    }

    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors).join(' '))
      return false
    }

    setError('')
    return true
  }

  async function handleConfirm() {
    if (!validateFields()) return
    if (!selectedSlot) return // type guard — validateFields already checks this

    if (bookingFee <= 0) {
      await submitBooking()
      return
    }

    if (!scriptReady || !window.Razorpay) {
      setError('Payment gateway is still loading. Please try again in a moment.')
      return
    }

    setStatus('processing')
    setError('')

    const response = await fetch('/api/razorpay/create-appointment-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId,
        bookingDate: selectedDate,
        slotStart: selectedSlot.start,
      }),
    })

    const orderData = await response.json()
    if (!response.ok || orderData.error) {
      setStatus('error')
      setError(orderData.error || 'Unable to start payment right now.')
      return
    }

    if (orderData.isFree) {
      await submitBooking()
      return
    }

    const RazorpayClass = window.Razorpay as unknown as new (options: RazorpayOptions) => { open: () => void }
    const razorpay = new RazorpayClass({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: listingName,
      description: `Appointment on ${formatSelectedDate(selectedDate)} at ${selectedSlot.start}`,
      order_id: orderData.orderId,
      handler: async (paymentResponse) => {
        await submitBooking(paymentResponse)
      },
      modal: {
        ondismiss: () => {
          setStatus('idle')
        },
      },
      prefill: {
        name: name.trim(),
        contact: phone.trim(),
        email: userEmail,
      },
      theme: { color: '#C4663A' },
    })

    razorpay.open()
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[#e7d8ca] bg-gradient-to-br from-[#fff7ef] via-white to-[#f4ede4]">
      <div className="absolute -top-24 right-0 h-56 w-56 rounded-full bg-[#f5dfc5] blur-3xl opacity-70" />
      <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[#f2e8d9] blur-3xl opacity-70" />

      <div className="relative space-y-6 p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#e9c9a7] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              <Sparkles size={13} />
              Appointment Booking
            </span>
            <h2 className="mt-4 text-2xl font-bold text-[#2d160b] sm:text-3xl">
              Reserve a time with {listingName}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#6f5748] sm:text-[15px]">
              Choose a date, pick a live slot, and confirm instantly. The booking summary stays visible throughout
              the flow so the customer always knows what is being booked and what will be charged.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {['Choose date', 'Pick slot', bookingFee > 0 ? 'Pay & confirm' : 'Confirm instantly'].map((step, index) => (
                <div
                  key={step}
                  className="inline-flex items-center gap-2 rounded-full bg-[#3D1A08] px-3 py-1.5 text-xs font-semibold text-bg"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[11px]">
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[360px]">
            {bookingHighlights.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_10px_30px_rgba(61,26,8,0.05)] backdrop-blur"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9b7a67]">{item.label}</p>
                <p className={`mt-1 text-base font-bold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {status === 'success' && confirmation ? (
          <div className="rounded-[24px] border border-green-200 bg-gradient-to-br from-green-50 to-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-600 text-white">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-900">Appointment confirmed</h3>
                  <p className="mt-1 text-sm text-green-800">
                    {formatSelectedDate(confirmation.date)} at {formatSlotLabel(confirmation.slot)}
                  </p>
                  <p className="mt-2 text-sm text-green-700">
                    {bookingFee > 0
                      ? `Payment received: ${formatFee(bookingFee)}`
                      : 'No payment was required for this booking.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard/appointments"
                  className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800"
                >
                  View My Appointments
                  <ArrowRight size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmation(null)
                    setSelectedSlot(null)
                    setStatus('idle')
                  }}
                  className="inline-flex items-center rounded-xl border border-green-200 px-4 py-2.5 text-sm font-semibold text-green-800 transition-colors hover:border-green-300 hover:bg-green-50"
                >
                  Book Another Slot
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_20px_50px_rgba(61,26,8,0.06)] backdrop-blur lg:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
                <div className="rounded-2xl border border-[#efe2d6] bg-[#fffaf5] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#7d5a47]">
                    <Calendar size={15} className="text-brand" />
                    Step 1
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-[#2d160b]">Choose a date</h3>
                  <p className="mt-1 text-sm text-[#7c6253]">
                    Booking window stays open for up to {appointmentSettings.advance_days} days ahead.
                  </p>

                  <input
                    type="date"
                    min={today}
                    max={maxDate}
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="mt-4 w-full rounded-2xl border border-[#decbbb] bg-white px-4 py-3 text-sm text-gray-800 focus:border-brand focus:outline-none"
                  />

                  <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-[#6b5547]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9f806d]">Selected Date</p>
                    <p className="mt-1 font-semibold text-[#2d160b]">{formatSelectedDate(selectedDate)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#efe2d6] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#7d5a47]">
                        <Clock3 size={15} className="text-brand" />
                        Step 2
                      </div>
                      <h3 className="mt-1 text-lg font-bold text-[#2d160b]">Pick a live time slot</h3>
                      <p className="mt-1 text-sm text-[#7c6253]">
                        {availableSlotsCount > 0
                          ? `${availableSlotsCount} open slot${availableSlotsCount === 1 ? '' : 's'} for this date`
                          : 'Live availability updates as bookings come in'}
                      </p>
                    </div>

                    {status === 'loading-slots' && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#f8efe7] px-3 py-1 text-xs font-semibold text-[#8a6754]">
                        <Loader2 size={12} className="animate-spin" />
                        Loading slots
                      </span>
                    )}
                  </div>

                  {slots.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#ead9ca] bg-[#fcf7f2] px-4 py-8 text-center text-sm text-[#8c7364]">
                      {error || 'No slots available for this date.'}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {(['morning', 'afternoon', 'evening'] as const).map((period) => {
                        const periodSlots = slots.filter((s) => getSlotPeriod(s) === period)
                        if (periodSlots.length === 0) return null
                        const meta = PERIOD_META[period]
                        return (
                          <div key={period}>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#9b7a67]">
                              <span>{meta.icon}</span>
                              {meta.label}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {periodSlots.map((slot) => {
                                const isSelected = selectedSlot?.start === slot.start
                                return (
                                  <button
                                    key={slot.start}
                                    type="button"
                                    disabled={!slot.available}
                                    onClick={() => {
                                      setSelectedSlot(slot)
                                      setError('')
                                      if (fieldErrors.slot) setFieldErrors((prev) => ({ ...prev, slot: undefined }))
                                    }}
                                    className={`relative rounded-xl border px-3 py-2 text-center text-sm font-medium transition-all ${
                                      !slot.available
                                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300 line-through'
                                        : isSelected
                                        ? 'border-brand bg-brand text-white shadow-md'
                                        : 'border-[#e4d3c4] bg-white text-[#2d160b] hover:border-brand hover:bg-[#fff5ec]'
                                    }`}
                                    title={`${formatSlotLabel(slot)}${slot.available ? ` — ${slot.remaining} left` : ' — Full'}`}
                                  >
                                    {formatTimeLabel(slot.start)}
                                    {slot.available && slot.remaining <= (appointmentSettings.capacity > 1 ? Math.ceil(appointmentSettings.capacity / 2) : 0) && (
                                      <span className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                                        isSelected ? 'bg-white text-brand' : 'bg-orange-100 text-orange-600'
                                      }`}>
                                        {slot.remaining}
                                      </span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                      {selectedSlot && (
                        <div className="rounded-xl border border-brand/20 bg-[#fff5ec] px-3 py-2 text-sm text-[#5a3825]">
                          <span className="font-semibold text-brand">Selected:</span>{' '}
                          {formatSlotLabel(selectedSlot)} — {selectedSlot.remaining} spot{selectedSlot.remaining === 1 ? '' : 's'} left
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {!isLoggedIn ? (
                <div className="mt-5 rounded-[24px] border border-[#efdac8] bg-[#fff7f0] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#2d160b]">Sign in to complete the booking</p>
                      <p className="mt-1 text-sm text-[#7c6253]">
                        The booking will be attached to your account so you can track or cancel it later from your dashboard.
                      </p>
                    </div>
                    <Link
                      href={`/login?next=${encodeURIComponent(pathname || `/listings/${listingId}`)}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong"
                    >
                      Sign In to Book
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#efe2d6] bg-[#fffaf5] p-4">
                    <p className="text-sm font-semibold text-[#2d160b]">Guest details</p>
                    <p className="mt-1 text-sm text-[#7c6253]">
                      These details are shared with the business after the booking is confirmed.
                    </p>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-gray-700">Your Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={name}
                          onChange={(event) => {
                            setName(event.target.value)
                            if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }))
                          }}
                          placeholder="Enter your full name"
                          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-gray-800 focus:outline-none ${
                            fieldErrors.name
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-[#decbbb] focus:border-brand'
                          }`}
                        />
                        {fieldErrors.name && (
                          <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-gray-700">Phone Number <span className="text-red-500">*</span></label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(event) => {
                            setPhone(event.target.value)
                            if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }))
                          }}
                          placeholder="10-digit mobile number"
                          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-gray-800 focus:outline-none ${
                            fieldErrors.phone
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-[#decbbb] focus:border-brand'
                          }`}
                        />
                        {fieldErrors.phone && (
                          <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#efe2d6] bg-white p-4">
                    <p className="text-sm font-semibold text-[#2d160b]">Notes for the business</p>
                    <p className="mt-1 text-sm text-[#7c6253]">
                      Add context, questions, or anything the business should know before the appointment.
                    </p>

                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={6}
                      placeholder="Optional notes or questions"
                      className="mt-4 w-full resize-none rounded-xl border border-[#decbbb] bg-[#fffdfb] px-4 py-3 text-sm text-gray-800 focus:border-brand focus:outline-none"
                    />

                    <div className="mt-4 rounded-xl bg-[#f8efe7] px-4 py-3 text-sm text-[#6a5447]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9f806d]">Account Email</p>
                      <p className="mt-1 font-medium text-[#2d160b]">{userEmail || 'Stored on your account'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <aside className="rounded-[28px] bg-[#3D1A08] p-5 text-bg shadow-[0_24px_60px_rgba(61,26,8,0.24)] lg:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f4d8c0]">
                <ShieldCheck size={15} />
                Booking Summary
              </div>

              <div className="mt-4 rounded-2xl bg-white/8 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9b79d]">Business</p>
                <p className="mt-1 text-lg font-bold">{listingName}</p>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9b79d]">Selected Slot</p>
                <p className="mt-1 text-base font-semibold">{selectedSlotLabel}</p>
                <p className="mt-1 text-sm text-[#f4d8c0]">{formatSelectedDate(selectedDate)}</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-2 text-[#f1cfb4]">
                    <CreditCard size={14} />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">Amount</span>
                  </div>
                  <p className="mt-2 text-xl font-bold">{formatFee(bookingFee)}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-2 text-[#f1cfb4]">
                    <Users size={14} />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">Capacity</span>
                  </div>
                  <p className="mt-2 text-xl font-bold">{appointmentSettings.capacity} per slot</p>
                </div>
              </div>

              <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-[#f0dbca]">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#f0b176]" />
                  <p>Slots are generated from the business availability and update live as bookings happen.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#f0b176]" />
                  <p>
                    {bookingFee > 0
                      ? 'Payment is handled securely through Razorpay before the appointment is confirmed.'
                      : 'This listing currently offers free appointment booking with instant confirmation.'}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#f0b176]" />
                  <p>After booking, the appointment will show up in your dashboard for tracking and cancellation.</p>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={!selectedSlot || status === 'processing' || status === 'loading-slots'}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-bg px-5 py-3.5 text-sm font-semibold text-[#3D1A08] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === 'processing' ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {bookingFee > 0 ? <CreditCard size={15} /> : <CheckCircle size={15} />}
                      {bookingFee > 0 ? 'Pay and Confirm' : 'Confirm Booking'}
                    </>
                  )}
                </button>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(pathname || `/listings/${listingId}`)}`}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-bg px-5 py-3.5 text-sm font-semibold text-[#3D1A08] transition-colors hover:bg-white"
                >
                  Sign In to Continue
                  <ArrowRight size={15} />
                </Link>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  )
}
