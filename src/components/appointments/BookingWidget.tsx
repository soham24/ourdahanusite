'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  ChevronLeft,
  Clock3,
  CreditCard,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react'

import {
  bookAppointment,
  getAvailableSlotsForDate,
} from '@/app/actions/appointments'
import type { AppointmentSlot } from '@/lib/appointment-slots'
import type { AppointmentSettings } from '@/lib/listing-content'
import {
  attemptWithRetry,
  clearRecoveryDraft,
  persistRecoveryDraft,
  readableReason,
  recoveryUrlFor,
  snapshotFormData,
  updateRecoveryDraft,
  type CapturedPaymentRecovery,
} from '@/lib/payment-retry'
import BookingDetailsForm from '@/components/appointments/BookingDetailsForm'
import SlotPicker from '@/components/appointments/SlotPicker'

type Props = {
  listingId: string
  listingName: string
  bookingFee: number
  appointmentSettings: AppointmentSettings
  isLoggedIn: boolean
  userName: string
  userPhone: string
  userEmail: string
  signInHref?: string
}

type BookingStatus = 'idle' | 'loading-slots' | 'processing' | 'success' | 'error' | 'recovery'

type Step = 'date' | 'time' | 'details'

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

function formatShortDate(value: string): { day: string; weekday: string; month: string } {
  const d = new Date(`${value}T12:00:00+05:30`)
  return {
    day: d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' }),
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }),
    month: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }),
  }
}

function formatTimeLabel(value: string): string {
  return new Date(`1970-01-01T${value}:00+05:30`).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

function formatFee(value: number): string {
  return value > 0 ? `Rs ${value.toLocaleString('en-IN')}` : 'Free'
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'date', label: 'Date' },
  { id: 'time', label: 'Time' },
  { id: 'details', label: 'Details' },
]

export default function BookingWidget({
  listingId,
  listingName,
  bookingFee,
  appointmentSettings,
  isLoggedIn,
  userName,
  userPhone,
  userEmail,
  signInHref = '/login',
}: Props) {
  const pathname = usePathname()
  const today = useMemo(() => getIndiaToday(), [])
  const maxDate = useMemo(
    () => addIndiaDays(today, appointmentSettings.advance_days),
    [appointmentSettings.advance_days, today],
  )

  const quickDates = useMemo(() => {
    const dates: string[] = []
    for (let i = 0; i < Math.min(7, appointmentSettings.advance_days); i++) {
      dates.push(addIndiaDays(today, i))
    }
    return dates
  }, [today, appointmentSettings.advance_days])

  const [step, setStep] = useState<Step>('date')
  const [selectedDate, setSelectedDate] = useState(today)
  const [slots, setSlots] = useState<AppointmentSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null)
  const [status, setStatus] = useState<BookingStatus>('idle')
  const [recovery, setRecovery] = useState<CapturedPaymentRecovery | null>(null)
  // Whether Razorpay's handler has started for the in-flight attempt. A ref,
  // not state: ondismiss must read the current value even in the same tick.
  const capturedRef = useRef(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<{ date: string; slot: AppointmentSlot } | null>(null)
  const [scriptReady, setScriptReady] = useState(bookingFee <= 0)
  const [name, setName] = useState(userName)
  const [phone, setPhone] = useState(userPhone)
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({})

  const availableSlotsCount = useMemo(
    () => slots.filter((slot) => slot.available).length,
    [slots],
  )

  useEffect(() => { setName(userName) }, [userName])
  useEffect(() => { setPhone(userPhone) }, [userPhone])

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
    return () => { active = false }
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
    if (!selectedSlot) return

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

    if (payment?.razorpay_order_id) formData.set('razorpay_order_id', payment.razorpay_order_id)
    if (payment?.razorpay_payment_id) formData.set('razorpay_payment_id', payment.razorpay_payment_id)
    if (payment?.razorpay_signature) formData.set('razorpay_signature', payment.razorpay_signature)

    if (payment?.razorpay_order_id && payment?.razorpay_payment_id) {
      updateRecoveryDraft(payment.razorpay_order_id, {
        fields: snapshotFormData(formData),
        paymentId: payment.razorpay_payment_id,
        signature: payment.razorpay_signature,
      })
    }

    // Routes a post-capture failure to the recovery screen rather than the
    // ordinary error banner — money has moved, so the buyer needs a working
    // link, not a retry button.
    const failAfterCapture = (reason: unknown) => {
      const message = readableReason(reason)
      if (payment?.razorpay_order_id) {
        updateRecoveryDraft(payment.razorpay_order_id, { lastError: message })
      }
      if (payment?.razorpay_order_id && payment?.razorpay_payment_id) {
        setRecovery({
          razorpayOrderId: payment.razorpay_order_id,
          paymentId: payment.razorpay_payment_id,
          message,
        })
        setStatus('recovery')
      } else {
        // No payment involved (free booking) — an ordinary retryable error.
        setStatus('error')
        setError(message)
      }
    }

    let result: { error?: string }
    try {
      result = await attemptWithRetry(() => bookAppointment(formData))
    } catch (err) {
      // Every retry threw, so attemptWithRetry rethrows rather than returning
      // {error}. Without this the rejection escapes an SDK callback and the
      // buyer is stuck on "processing" forever with their money gone.
      console.error('[AppointmentBooking] booking save threw:', err)
      failAfterCapture(err)
      return
    }

    if (result.error) {
      failAfterCapture(result.error)
      return
    }

    if (payment?.razorpay_order_id) clearRecoveryDraft(payment.razorpay_order_id)

    setConfirmation({ date: selectedDate, slot: selectedSlot })
    setStatus('success')
  }

  function validateFields(): boolean {
    const errors: { name?: string; phone?: string } = {}

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
    if (!selectedSlot) return

    if (bookingFee <= 0) {
      await submitBooking()
      return
    }

    if (!scriptReady || !window.Razorpay) {
      setError('Payment gateway is still loading. Please try again in a moment.')
      return
    }

    capturedRef.current = false
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

    persistRecoveryDraft({
      orderId: orderData.orderId,
      flow: 'appointment',
      amountPaise: orderData.amount,
      fields: {
        listing_id: listingId,
        booking_date: selectedDate,
        slot_start: selectedSlot.start,
        user_name: name.trim(),
        user_phone: phone.trim(),
        user_email: userEmail,
        notes: notes.trim(),
      },
      returnTo: typeof window !== 'undefined' ? window.location.pathname : undefined,
    })

    const RazorpayClass = window.Razorpay as unknown as new (options: RazorpayOptions) => { open: () => void }
    const razorpay = new RazorpayClass({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: listingName,
      description: `Appointment on ${formatSelectedDate(selectedDate)} at ${selectedSlot.start}`,
      order_id: orderData.orderId,
      handler: async (paymentResponse) => {
        // Set before anything else so `ondismiss` can never observe a window
        // where money has moved but this flag has not been set.
        capturedRef.current = true
        await submitBooking(paymentResponse)
      },
      modal: {
        // Razorpay fires this both on a genuine cancel AND after a successful
        // payment. Only unlock the form for a cancel; otherwise leave `status`
        // wherever the handler put it.
        ondismiss: () => {
          if (capturedRef.current) return
          setStatus('idle')
        },
      },
      prefill: { name: name.trim(), contact: phone.trim(), email: userEmail },
      theme: { color: '#C4663A' },
    })

    razorpay.open()
  }

  // Payment captured but the booking didn't save. Its own early return, so the
  // booking form — and its pay button — cannot render in this state.
  if (status === 'recovery' && recovery) {
    return (
      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="bg-amber-500 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-100">
                Payment received
              </p>
              <p className="text-base font-bold">{listingName}</p>
            </div>
          </div>
        </div>
        <div className="space-y-3 px-5 py-5">
          <p className="text-sm leading-relaxed text-[var(--od-ink-2)]">
            Your money reached {listingName} safely, but we couldn&apos;t finish saving the
            booking. Nothing is lost — we have your payment reference.
          </p>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            {recovery.message}
          </p>
          <span className="block select-all rounded-lg border border-[var(--od-border)] bg-white px-3 py-2 font-mono text-xs text-[var(--od-ink)]">
            {recovery.paymentId}
          </span>
          <Link
            href={recoveryUrlFor(recovery.razorpayOrderId)}
            className="block w-full rounded-xl bg-[var(--od-brand)] py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[var(--od-brand-strong)]"
          >
            Finish my booking →
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'success' && confirmation) {
    return (
      <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
        <div className="bg-green-600 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-green-100">Booking Confirmed</p>
              <p className="text-base font-bold">{listingName}</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="rounded-xl border border-green-100 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-900">{formatSelectedDate(confirmation.date)}</p>
            <p className="mt-1 text-sm text-green-800">
              {formatTimeLabel(confirmation.slot.start)} – {formatTimeLabel(confirmation.slot.end)}
            </p>
            <p className="mt-2 text-sm text-green-700">
              {bookingFee > 0 ? `Payment: ${formatFee(bookingFee)}` : 'Free booking — no payment required.'}
            </p>
            {bookingFee > 0 && (
              <p className="mt-2 text-xs text-[var(--od-muted)]">
                ₹{bookingFee} booking fee paid. Booking fees are not refunded — to change this
                appointment, contact {listingName} directly.
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/dashboard/appointments"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white"
            >
              View My Appointments <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              onClick={() => {
                setConfirmation(null)
                setSelectedSlot(null)
                setStep('date')
                setStatus('idle')
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 px-4 py-3 text-sm font-semibold text-green-800"
            >
              Book Another Slot
            </button>
          </div>
        </div>
      </div>
    )
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="overflow-hidden rounded-2xl border border-[#eee2d7] bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-[#f0e6dc] bg-[#fff9f5] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4ede4]">
            <Calendar size={16} className="text-brand" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-[#2d160b]">{listingName}</p>
            <p className="text-[11px] text-[#9b7c69]">
              {appointmentSettings.slot_duration} min · {formatFee(bookingFee)}
              {bookingFee <= 0 ? ' booking' : ' per slot'}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mt-4 flex items-center gap-0">
          {STEPS.map((s, i) => {
            const done = i < stepIndex
            const active = i === stepIndex
            return (
              <div key={s.id} className="flex flex-1 items-center">
                <button
                  type="button"
                  disabled={i > stepIndex || (i === 1 && !selectedDate) || (i === 2 && !selectedSlot)}
                  onClick={() => {
                    if (i < stepIndex) setStep(s.id)
                  }}
                  className="flex flex-col items-center gap-1 disabled:cursor-default"
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                    done
                      ? 'bg-green-500 text-white'
                      : active
                      ? 'bg-brand text-white'
                      : 'bg-[#f0e6dc] text-[#9b7c69]'
                  }`}>
                    {done ? <CheckCircle size={13} /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-semibold ${active ? 'text-brand' : done ? 'text-green-600' : 'text-[#9b7c69]'}`}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`mx-1 flex-1 border-t-2 ${i < stepIndex ? 'border-green-400' : 'border-[#e8ddd4]'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="p-5">
        {/* Step 1: Date */}
        {step === 'date' && (
          <div className="space-y-4">
            {bookingFee > 0 ? (
              <p className="rounded-xl border border-[var(--od-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--od-ink-2)]">
                <strong className="font-bold">₹{bookingFee} booking fee</strong> — non-refundable, paid
                now to hold your slot.
              </p>
            ) : (
              <p className="rounded-xl border border-[var(--od-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--od-ink-2)]">
                <strong className="font-bold">Free to book.</strong>
              </p>
            )}

            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#9b7c69]">Quick pick</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {quickDates.map((date) => {
                  const { day, weekday, month } = formatShortDate(date)
                  const isSelected = date === selectedDate
                  const isToday = date === today
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={`flex flex-col items-center rounded-xl border py-2.5 transition-all ${
                        isSelected
                          ? 'border-brand bg-brand text-white'
                          : 'border-[#e8ddd4] bg-white text-[#2d160b] hover:border-brand/50 hover:bg-[#fff5ec]'
                      }`}
                    >
                      <span className={`text-[9px] font-semibold uppercase ${isSelected ? 'text-white/70' : 'text-[#9b7c69]'}`}>
                        {weekday}
                      </span>
                      <span className="text-base font-bold leading-tight">{day}</span>
                      <span className={`text-[9px] ${isSelected ? 'text-white/70' : 'text-[#9b7c69]'}`}>
                        {isToday ? 'Today' : month}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {appointmentSettings.advance_days > 7 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9b7c69]">Or pick a date</p>
                <input
                  type="date"
                  min={today}
                  max={maxDate}
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="w-full rounded-xl border border-[#e8ddd4] bg-white px-4 py-3 text-sm text-gray-800 focus:border-brand focus:outline-none"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setStep('time')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white"
            >
              See Available Slots
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Step 2: Time slots */}
        {step === 'time' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#2d160b]">{formatSelectedDate(selectedDate)}</p>
                {status !== 'loading-slots' && (
                  <p className="text-[12px] text-[#9b7c69]">
                    {availableSlotsCount > 0
                      ? `${availableSlotsCount} open slot${availableSlotsCount === 1 ? '' : 's'}`
                      : 'No slots available'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStep('date')}
                className="flex items-center gap-1 text-[12px] font-medium text-[#9b7c69]"
              >
                <ChevronLeft size={14} /> Change
              </button>
            </div>

            <SlotPicker
              slots={slots}
              selectedStart={selectedSlot?.start ?? null}
              loading={status === 'loading-slots'}
              onSelect={(slot) => {
                setSelectedSlot(slot)
                setStep('details')
              }}
            />
          </div>
        )}

        {/* Step 3: Details + confirm */}
        {step === 'details' && (
          <div className="space-y-4">
            {/* Booking summary pill */}
            <div className="flex items-center justify-between rounded-xl border border-[#eee2d7] bg-[#fdfaf7] px-3 py-2.5">
              <div>
                <p className="text-[12px] font-bold text-[#2d160b]">{formatSelectedDate(selectedDate)}</p>
                <p className="text-[11px] text-[#9b7c69]">
                  {selectedSlot
                    ? `${formatTimeLabel(selectedSlot.start)} – ${formatTimeLabel(selectedSlot.end)}`
                    : '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep('time')}
                className="flex items-center gap-1 text-[12px] font-medium text-[#9b7c69]"
              >
                <ChevronLeft size={14} /> Change
              </button>
            </div>

            {!isLoggedIn ? (
              <Link
                href={`${signInHref}?next=${encodeURIComponent(pathname)}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white"
              >
                Sign In to Continue <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                {/* Contact details */}
                <div>
                  <div className="mb-3 flex items-center gap-1.5">
                    <User size={13} className="text-brand" />
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9b7c69]">Your details</p>
                  </div>
                  <BookingDetailsForm
                    name={name}
                    phone={phone}
                    notes={notes}
                    fieldErrors={fieldErrors}
                    disabled={status === 'processing'}
                    onChange={(patch) => {
                      if (patch.name !== undefined) setName(patch.name)
                      if (patch.phone !== undefined) setPhone(patch.phone)
                      if (patch.notes !== undefined) setNotes(patch.notes)
                    }}
                  />
                </div>

                {/* Fee summary */}
                <div className="flex items-center justify-between rounded-xl border border-[#eee2d7] bg-[#fdfaf7] px-4 py-3">
                  <div className="flex items-center gap-2 text-[#9b7c69]">
                    {bookingFee > 0 ? <CreditCard size={14} /> : <ShieldCheck size={14} />}
                    <span className="text-[12px] font-semibold">
                      {bookingFee > 0 ? 'Booking fee' : 'Free booking'}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[#2d160b]">{formatFee(bookingFee)}</span>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {bookingFee > 0 ? (
                  <p className="rounded-xl border border-[var(--od-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--od-ink-2)]">
                    <strong className="font-bold">₹{bookingFee} booking fee</strong> — non-refundable, paid
                    now to hold your slot.
                  </p>
                ) : (
                  <p className="rounded-xl border border-[var(--od-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--od-ink-2)]">
                    <strong className="font-bold">Free to book.</strong>
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={status === 'processing' || status === 'loading-slots'}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2d160b] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#3d1f10] disabled:opacity-50"
                >
                  {status === 'processing' ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      {bookingFee > 0 ? <CreditCard size={15} /> : <CheckCircle size={15} />}
                      {bookingFee > 0 ? `Pay ${formatFee(bookingFee)} & Confirm` : 'Confirm Booking'}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
