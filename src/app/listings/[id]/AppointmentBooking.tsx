'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Calendar, CheckCircle, Clock3, Loader2, ShieldCheck } from 'lucide-react'

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
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatSlotLabel(slot: AppointmentSlot): string {
  return `${slot.start} - ${slot.end}`
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

  async function handleConfirm() {
    if (!selectedSlot) {
      setError('Please choose a slot first.')
      return
    }

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
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-4 bg-warli-terra rounded-full inline-block" />
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Calendar size={15} className="text-warli-terra" />
          Book an Appointment
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Pick a date, choose an available slot, and confirm your booking for {listingName}.
      </p>

      {status === 'success' && confirmation ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-6">
          <div className="flex items-start gap-3">
            <CheckCircle size={22} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-800">Appointment confirmed</h3>
              <p className="text-sm text-green-700 mt-1">
                {formatSelectedDate(confirmation.date)} at {formatSlotLabel(confirmation.slot)}
              </p>
              <p className="text-sm text-green-700 mt-1">
                {bookingFee > 0 ? `Payment received: Rs ${bookingFee.toLocaleString('en-IN')}` : 'No payment was required for this booking.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Choose Date</label>
              <input
                type="date"
                min={today}
                max={maxDate}
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-warli-terra text-sm"
              />
              <p className="text-xs text-gray-400 mt-2">
                Booking window: up to {appointmentSettings.advance_days} days ahead
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">Available Slots</label>
                {status === 'loading-slots' && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Loader2 size={12} className="animate-spin" />
                    Loading
                  </span>
                )}
              </div>

              {slots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">
                  {error || 'No slots available for this date.'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.start === slot.start
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => {
                          setSelectedSlot(slot)
                          setError('')
                        }}
                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                          !slot.available
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                            : isSelected
                            ? 'border-warli-terra bg-warli-light text-warli-terra'
                            : 'border-gray-200 hover:border-warli-sand text-gray-700'
                        }`}
                      >
                        <div className="font-semibold text-sm">{formatSlotLabel(slot)}</div>
                        <div className="text-xs mt-1">
                          {slot.available
                            ? `${slot.remaining} left`
                            : 'Full'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {!isLoggedIn ? (
            <div className="rounded-2xl border border-warli-sand bg-warli-light/60 px-4 py-5 text-center">
              <p className="text-sm text-gray-700 mb-3">Sign in to confirm your appointment.</p>
              <Link
                href={`/login?next=${encodeURIComponent(pathname || `/listings/${listingId}`)}`}
                className="inline-block bg-warli-terra hover:bg-warli-deep text-warli-cream font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
              >
                Sign In to Book
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-warli-terra text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-warli-terra text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    placeholder="Optional notes or questions for the business"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-warli-terra text-sm resize-none"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-warli-light border border-warli-sand p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Booking Summary</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedSlot
                        ? `${formatSelectedDate(selectedDate)} at ${formatSlotLabel(selectedSlot)}`
                        : 'Select a slot to continue'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Fee</p>
                    <p className="text-lg font-bold text-warli-terra">
                      {bookingFee > 0 ? `Rs ${bookingFee.toLocaleString('en-IN')}` : 'Free'}
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={!selectedSlot || status === 'processing' || status === 'loading-slots'}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-warli-terra hover:bg-warli-deep text-warli-cream font-semibold px-5 py-3 rounded-xl transition-colors disabled:opacity-60"
                >
                  {status === 'processing' ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Clock3 size={15} />
                      {bookingFee > 0 ? `Pay and Confirm` : 'Confirm Booking'}
                    </>
                  )}
                </button>

                {bookingFee > 0 && (
                  <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-warli-terra" />
                    Secure payment via Razorpay
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
