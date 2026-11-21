'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { Clock } from 'lucide-react'

import { describeStatus, indiaMoment, normalizeOpeningHours, openStatus } from '@/lib/opening-hours'

// The current minute, as a store: the server snapshot is null, so the page
// prerenders without reading the clock and the badge appears once in the
// browser, then follows the minute.
function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 30_000)
  return () => clearInterval(timer)
}
const currentMinute = () => Math.floor(Date.now() / 60_000)
const noMinute = () => null

export function useCurrentMinute(): number | null {
  return useSyncExternalStore(subscribe, currentMinute, noMinute)
}

/** "Open now · closes 9:00 PM" or "Closed · opens 10:00 AM tomorrow". Nothing when hours are not set. */
export default function OpenNowBadge({ hours, className = '' }: { hours: unknown; className?: string }) {
  const minute = useCurrentMinute()
  const normalized = useMemo(() => normalizeOpeningHours(hours), [hours])
  if (minute === null || !normalized) return null

  const moment = indiaMoment(new Date(minute * 60_000))
  const status = openStatus(normalized, moment)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        status.open ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      } ${className}`}
    >
      <Clock size={11} aria-hidden />
      {describeStatus(status, moment.day)}
    </span>
  )
}
