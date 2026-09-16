'use client'

export default function AppointmentError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-md py-12 text-center">
    <h1 className="text-2xl font-bold">We couldn’t check availability</h1>
    <p className="mt-3 text-sm text-[var(--od-muted)]">Please try again before choosing a slot, or contact the business directly.</p>
    <button type="button" onClick={reset} className="od-button-primary mt-6 px-5 py-3">Try again</button>
  </div>
}
