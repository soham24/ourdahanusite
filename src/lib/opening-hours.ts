/**
 * A business's regular opening hours, and whether it is open at a moment.
 *
 * Same weekly shape as appointment availability ({ mon: [{ start, end }] }).
 * Its own normaliser, because appointment windows may not cross midnight and
 * a shop's hours may. Pure: callers pass the moment, so it is testable and
 * never reads the clock during a prerender.
 * A window whose end is not after its start runs past midnight (18:00-02:00).
 */

import type { AppointmentDayWindow, AppointmentWeekday } from './listing-content'

export type OpeningHours = Record<AppointmentWeekday, AppointmentDayWindow[]>

export const WEEKDAYS: AppointmentWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const WEEKDAY_LABELS: Record<AppointmentWeekday, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

export const MAX_WINDOWS_PER_DAY = 3
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Valid windows for one day, in start order, at most three. */
function dayWindows(value: unknown): AppointmentDayWindow[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((w): w is AppointmentDayWindow =>
      !!w && typeof w === 'object' && TIME.test(String((w as AppointmentDayWindow).start)) &&
      TIME.test(String((w as AppointmentDayWindow).end)) && (w as AppointmentDayWindow).start !== (w as AppointmentDayWindow).end,
    )
    .map((w) => ({ start: w.start, end: w.end }))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, MAX_WINDOWS_PER_DAY)
}

/** Hours from the database or a form, or null when none are set (or none are open). */
export function normalizeOpeningHours(raw: unknown): OpeningHours | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const hours = Object.fromEntries(WEEKDAYS.map((day) => [day, dayWindows(source[day])])) as OpeningHours
  return WEEKDAYS.some((day) => hours[day].length > 0) ? hours : null
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** The weekday and minute of the day in India for a given instant. */
export function indiaMoment(instant: Date): { day: AppointmentWeekday; minute: number } {
  // IST is UTC+5:30 all year, so shifting the instant is exact.
  const shifted = new Date(instant.getTime() + 330 * 60_000)
  const day = WEEKDAYS[(shifted.getUTCDay() + 6) % 7]
  return { day, minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() }
}

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: { day: AppointmentWeekday; time: string } | null }

export function openStatus(hours: OpeningHours, at: { day: AppointmentWeekday; minute: number }): OpenStatus {
  const index = WEEKDAYS.indexOf(at.day)
  const yesterday = WEEKDAYS[(index + 6) % 7]

  for (const window of hours[at.day]) {
    const start = minutes(window.start)
    const end = minutes(window.end)
    const overnight = end <= start
    if (at.minute >= start && (overnight || at.minute < end)) return { open: true, closesAt: window.end }
  }
  // Still inside last night's window that runs past midnight.
  for (const window of hours[yesterday]) {
    const start = minutes(window.start)
    const end = minutes(window.end)
    if (end <= start && at.minute < end) return { open: true, closesAt: window.end }
  }

  // Next opening: later today, then the following days.
  for (let offset = 0; offset < 7; offset++) {
    const day = WEEKDAYS[(index + offset) % 7]
    const next = hours[day]
      .map((w) => w.start)
      .filter((start) => offset > 0 || minutes(start) > at.minute)
      .sort()[0]
    if (next) return { open: false, opensAt: { day, time: next } }
  }
  return { open: false, opensAt: null }
}

/** "9:00 AM" from "09:00". */
export function formatTime(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2))
  const m = hhmm.slice(3, 5)
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'AM' : 'PM'}`
}

/** "Open · closes 9:00 PM" / "Closed · opens 10:00 AM tomorrow". */
export function describeStatus(status: OpenStatus, today: AppointmentWeekday): string {
  if (status.open) return `Open now · closes ${formatTime(status.closesAt)}`
  if (!status.opensAt) return 'Closed'
  const { day, time } = status.opensAt
  const tomorrow = WEEKDAYS[(WEEKDAYS.indexOf(today) + 1) % 7]
  const when = day === today ? '' : day === tomorrow ? ' tomorrow' : ` ${WEEKDAY_LABELS[day]}`
  return `Closed · opens ${formatTime(time)}${when}`
}
