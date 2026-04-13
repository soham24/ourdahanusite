import { normalizeOptionalUrlOrNull } from '@/lib/url'
import {
  DEFAULT_SERVICE_IMAGE_ASPECT,
  normalizeServiceImageAspect,
  type ServiceImageAspect,
} from '@/lib/service-image'

export const MAX_SERVICE_ITEMS = 30

export type AppointmentWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type AppointmentDayWindow = {
  start: string
  end: string
}

export type AppointmentSettings = {
  slot_duration: number
  capacity: number
  buffer_minutes: number
  advance_days: number
  availability: Record<AppointmentWeekday, AppointmentDayWindow | null>
}

const APPOINTMENT_WEEKDAYS: AppointmentWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const DEFAULT_APPOINTMENT_SETTINGS: AppointmentSettings = {
  slot_duration: 30,
  capacity: 1,
  buffer_minutes: 0,
  advance_days: 30,
  availability: {
    mon: null,
    tue: null,
    wed: null,
    thu: null,
    fri: null,
    sat: null,
    sun: null,
  },
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

function normalizeTimeString(value: unknown): string | null {
  const normalized = String(value ?? '').trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized) ? normalized : null
}

function timeStringToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((segment) => Number.parseInt(segment, 10))
  return hours * 60 + minutes
}

export function normalizeInlineText(
  value: string | null | undefined,
  maxLength?: number,
): string | null {
  const normalized = collapseSpaces(value ?? '')
  if (!normalized) return null
  return maxLength ? normalized.slice(0, maxLength).trim() : normalized
}

export function normalizeMultilineText(
  value: string | null | undefined,
  maxLength?: number,
): string | null {
  const source = (value ?? '').replace(/\r\n?/g, '\n')
  if (!source.trim()) return null

  const lines = source.split('\n').map((line) => collapseSpaces(line))
  const normalizedLines: string[] = []
  let previousBlank = true

  for (const line of lines) {
    if (!line) {
      if (!previousBlank) {
        normalizedLines.push('')
      }
      previousBlank = true
      continue
    }

    normalizedLines.push(line)
    previousBlank = false
  }

  while (normalizedLines[normalizedLines.length - 1] === '') {
    normalizedLines.pop()
  }

  const normalized = normalizedLines.join('\n').trim()
  if (!normalized) return null
  return maxLength ? normalized.slice(0, maxLength).trim() : normalized
}

export function normalizePhoneOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  return trimmed.startsWith('+') ? `+${digits}` : digits
}

export function formatPhoneForDisplay(value: string | null | undefined): string {
  const normalized = normalizePhoneOrNull(value)
  if (!normalized) return ''

  const digits = normalized.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }

  return normalized
}

export function formatAddressForDisplay(value: string | null | undefined): string {
  const normalized = normalizeInlineText(value, 220)
  if (!normalized) return ''

  return normalized
    .split(',')
    .map((part) => collapseSpaces(part))
    .filter(Boolean)
    .join(', ')
}

export function summarizeAddress(
  value: string | null | undefined,
  maxParts = 2,
): string {
  const normalized = formatAddressForDisplay(value)
  if (!normalized) return ''

  return normalized
    .split(',')
    .map((part) => collapseSpaces(part))
    .filter(Boolean)
    .slice(0, maxParts)
    .join(', ')
}

export function buildDirectionsUrl(
  mapUrl: string | null | undefined,
  address: string | null | undefined,
): string | null {
  const normalizedMapUrl = normalizeOptionalUrlOrNull(mapUrl)
  if (normalizedMapUrl) {
    return normalizedMapUrl
  }

  const normalizedAddress = normalizeInlineText(address, 220)
  if (!normalizedAddress) return null

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${normalizedAddress}, Dahanu, Maharashtra`)}` // fall back to a safe search query
}

export function normalizeStringArray(
  values: unknown,
  maxItems = 12,
  maxLength = 60,
): string[] {
  if (!Array.isArray(values)) return []

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const entry of values) {
    const value = normalizeInlineText(typeof entry === 'string' ? entry : '', maxLength)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(value)
    if (normalized.length >= maxItems) break
  }

  return normalized
}

export function normalizeUrlArray(
  values: unknown,
  maxItems = 12,
): string[] {
  if (!Array.isArray(values)) return []

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const entry of values) {
    const value = normalizeOptionalUrlOrNull(typeof entry === 'string' ? entry : '')
    if (!value || seen.has(value)) continue
    seen.add(value)
    normalized.push(value)
    if (normalized.length >= maxItems) break
  }

  return normalized
}

type NormalizedService = {
  type?: 'service' | 'product'
  name: string
  desc?: string
  price?: string
  image?: string
  imageAspect?: ServiceImageAspect
}

export function normalizeServiceItems(values: unknown): NormalizedService[] {
  if (!Array.isArray(values)) return []

  const normalized: NormalizedService[] = []

  for (const entry of values) {
    if (!entry || typeof entry !== 'object') continue

    const name = normalizeInlineText('name' in entry ? String(entry.name) : '', 80)
    if (!name) continue

    const type =
      'type' in entry && (entry.type === 'service' || entry.type === 'product')
        ? entry.type
        : undefined
    const desc = normalizeMultilineText('desc' in entry ? String(entry.desc ?? '') : '', 280) ?? undefined
    const price = normalizeInlineText('price' in entry ? String(entry.price ?? '') : '', 32) ?? undefined
    const image = normalizeOptionalUrlOrNull('image' in entry ? String(entry.image ?? '') : '') ?? undefined
    const imageAspect =
      'imageAspect' in entry || image
        ? normalizeServiceImageAspect('imageAspect' in entry ? entry.imageAspect : undefined, DEFAULT_SERVICE_IMAGE_ASPECT)
        : undefined

    normalized.push({
      ...(type ? { type } : {}),
      name,
      ...(desc ? { desc } : {}),
      ...(price ? { price } : {}),
      ...(image ? { image } : {}),
      ...(imageAspect ? { imageAspect } : {}),
    })

    if (normalized.length >= MAX_SERVICE_ITEMS) break
  }

  return normalized
}

export function normalizeHighlightItems(values: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(values)) return []

  const normalized: Array<{ label: string; value: string }> = []

  for (const entry of values) {
    if (!entry || typeof entry !== 'object') continue

    const label = normalizeInlineText('label' in entry ? String(entry.label) : '', 40)
    const value = normalizeInlineText('value' in entry ? String(entry.value) : '', 80)
    if (!label || !value) continue

    normalized.push({ label, value })
    if (normalized.length >= 8) break
  }

  return normalized
}

export function normalizeDeliveryInfo(
  value: unknown,
): { areas?: string; note?: string } | null {
  if (!value || typeof value !== 'object') return null

  const areas = normalizeInlineText('areas' in value ? String(value.areas ?? '') : '', 120) ?? undefined
  const note = normalizeMultilineText('note' in value ? String(value.note ?? '') : '', 220) ?? undefined

  if (!areas && !note) return null
  return {
    ...(areas ? { areas } : {}),
    ...(note ? { note } : {}),
  }
}

export function normalizeBeforeAfter(
  value: unknown,
): { before: string; after: string } | null {
  if (!value || typeof value !== 'object') return null

  const before = normalizeOptionalUrlOrNull('before' in value ? String(value.before ?? '') : '')
  const after = normalizeOptionalUrlOrNull('after' in value ? String(value.after ?? '') : '')

  if (!before || !after) return null
  return { before, after }
}

export function normalizeAppointmentSettings(value: unknown): AppointmentSettings | null {
  if (!value || typeof value !== 'object') return null

  const source = value as Record<string, unknown>
  const rawAvailability =
    source.availability && typeof source.availability === 'object'
      ? (source.availability as Record<string, unknown>)
      : {}

  const availability = APPOINTMENT_WEEKDAYS.reduce<Record<AppointmentWeekday, AppointmentDayWindow | null>>(
    (result, day) => {
      const entry = rawAvailability[day]
      if (!entry || typeof entry !== 'object') {
        result[day] = null
        return result
      }

      const start = normalizeTimeString((entry as Record<string, unknown>).start)
      const end = normalizeTimeString((entry as Record<string, unknown>).end)
      if (!start || !end || timeStringToMinutes(end) <= timeStringToMinutes(start)) {
        result[day] = null
        return result
      }

      result[day] = { start, end }
      return result
    },
    { ...DEFAULT_APPOINTMENT_SETTINGS.availability },
  )

  return {
    slot_duration: clampInteger(source.slot_duration, 15, 240, DEFAULT_APPOINTMENT_SETTINGS.slot_duration),
    capacity: clampInteger(source.capacity, 1, 20, DEFAULT_APPOINTMENT_SETTINGS.capacity),
    buffer_minutes: clampInteger(source.buffer_minutes, 0, 60, DEFAULT_APPOINTMENT_SETTINGS.buffer_minutes),
    advance_days: clampInteger(source.advance_days, 1, 90, DEFAULT_APPOINTMENT_SETTINGS.advance_days),
    availability,
  }
}
