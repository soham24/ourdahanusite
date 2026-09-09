import {
  type AppointmentDayWindow,
  type AppointmentSettings,
  type AppointmentWeekday,
} from '@/lib/listing-content'

/**
 * Why a slot cannot be booked. `full` and `too_soon` slots are still returned
 * so the UI can show them greyed with a reason — a sparse grid and a busy
 * clinic looked identical when unbookable slots were simply omitted.
 */
export type AppointmentSlotReason = 'open' | 'full' | 'too_soon'

export type AppointmentSlot = {
  start: string
  end: string
  available: boolean
  remaining: number
  reason: AppointmentSlotReason
}

export type AppointmentDateOverride = {
  override_date: string
  closed: boolean
  windows: AppointmentDayWindow[] | null
}

export type AppointmentNowInfo = { today: string; nowMinutes: number }

const INDIA_TIME_ZONE = 'Asia/Kolkata'
const WEEKDAY_MAP: AppointmentWeekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((segment) => Number.parseInt(segment, 10))
  return hours * 60 + minutes
}

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function getIndiaTodayInfo() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    today: `${lookup.year}-${lookup.month}-${lookup.day}`,
    nowMinutes: Number.parseInt(lookup.hour, 10) * 60 + Number.parseInt(lookup.minute, 10),
  }
}

export function getWeekdayForDate(bookingDate: string): AppointmentWeekday {
  const dayIndex = new Date(`${bookingDate}T12:00:00+05:30`).getUTCDay()
  return WEEKDAY_MAP[dayIndex]
}

/**
 * The windows that actually apply to one date. An override replaces the
 * weekday's normal windows completely rather than merging with them — a
 * business closing for a festival means closed, not "closed plus whatever
 * Monday usually is".
 */
export function resolveWindowsForDate(
  settings: AppointmentSettings,
  bookingDate: string,
  override?: AppointmentDateOverride | null,
): AppointmentDayWindow[] {
  if (override && override.override_date === bookingDate) {
    if (override.closed) return []
    return override.windows ?? []
  }

  return settings.availability[getWeekdayForDate(bookingDate)] ?? []
}

export function generateAvailableSlots(
  settings: AppointmentSettings | null,
  bookingDate: string,
  bookingCounts: Record<string, number>,
  override?: AppointmentDateOverride | null,
  now?: AppointmentNowInfo,
): AppointmentSlot[] {
  if (!settings) return []

  const windows = resolveWindowsForDate(settings, bookingDate, override)
  if (windows.length === 0) return []

  const stepMinutes = settings.slot_duration + settings.buffer_minutes
  const { today, nowMinutes } = now ?? getIndiaTodayInfo()
  const isToday = bookingDate === today
  const earliestBookable = nowMinutes + settings.min_notice_minutes

  const slots: AppointmentSlot[] = []

  for (const window of windows) {
    const startMinutes = timeToMinutes(window.start)
    const endMinutes = timeToMinutes(window.end)

    for (
      let cursor = startMinutes;
      cursor + settings.slot_duration <= endMinutes;
      cursor += stepMinutes
    ) {
      // Slots already in the past are dropped entirely. Only slots between now
      // and the notice threshold are surfaced as "too soon" — listing every
      // past slot of the day would be noise, not information.
      if (isToday && cursor <= nowMinutes) continue

      const start = minutesToTime(cursor)
      const count = bookingCounts[start] ?? 0
      const remaining = Math.max(settings.capacity - count, 0)
      const tooSoon = isToday && cursor < earliestBookable

      const reason: AppointmentSlotReason =
        remaining <= 0 ? 'full' : tooSoon ? 'too_soon' : 'open'

      slots.push({
        start,
        end: minutesToTime(cursor + settings.slot_duration),
        available: reason === 'open',
        remaining,
        reason,
      })
    }
  }

  return slots
}
