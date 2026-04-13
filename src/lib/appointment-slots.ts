import {
  type AppointmentSettings,
  type AppointmentWeekday,
} from '@/lib/listing-content'

export type AppointmentSlot = {
  start: string
  end: string
  available: boolean
  remaining: number
}

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
    hour12: false,
  })

  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    today: `${lookup.year}-${lookup.month}-${lookup.day}`,
    nowMinutes: Number.parseInt(lookup.hour, 10) * 60 + Number.parseInt(lookup.minute, 10),
  }
}

export function generateAvailableSlots(
  settings: AppointmentSettings | null,
  bookingDate: string,
  bookingCounts: Record<string, number>,
): AppointmentSlot[] {
  if (!settings) return []

  const dayIndex = new Date(`${bookingDate}T12:00:00+05:30`).getUTCDay()
  const weekday = WEEKDAY_MAP[dayIndex]
  const window = settings.availability[weekday]
  if (!window) return []

  const startMinutes = timeToMinutes(window.start)
  const endMinutes = timeToMinutes(window.end)
  const stepMinutes = settings.slot_duration + settings.buffer_minutes
  const { today, nowMinutes } = getIndiaTodayInfo()

  const slots: AppointmentSlot[] = []

  for (
    let cursor = startMinutes;
    cursor + settings.slot_duration <= endMinutes;
    cursor += stepMinutes
  ) {
    if (bookingDate === today && cursor <= nowMinutes) {
      continue
    }

    const start = minutesToTime(cursor)
    const end = minutesToTime(cursor + settings.slot_duration)
    const count = bookingCounts[start] ?? 0
    const remaining = Math.max(settings.capacity - count, 0)

    slots.push({
      start,
      end,
      available: remaining > 0,
      remaining,
    })
  }

  return slots
}
