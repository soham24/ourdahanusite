import { normalizeOptionalUrlOrNull } from '@/lib/url'
import { siteConfig } from '@/lib/site'

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
  min_notice_minutes: number
  availability: Record<AppointmentWeekday, AppointmentDayWindow[]>
}

const APPOINTMENT_WEEKDAYS: AppointmentWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** Morning / afternoon / evening is the realistic ceiling for a local clinic. */
export const MAX_WINDOWS_PER_DAY = 3

export const DEFAULT_APPOINTMENT_SETTINGS: AppointmentSettings = {
  slot_duration: 30,
  capacity: 1,
  buffer_minutes: 0,
  advance_days: 30,
  min_notice_minutes: 0,
  availability: {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
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

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${normalizedAddress}, ${siteConfig.town}, ${siteConfig.region}`)}` // fall back to a safe search query
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

/**
 * One weekday's windows, from either shape, cleaned into a sorted, disjoint,
 * capped array. Invalid entries are dropped rather than throwing — a bad row
 * should render as "closed", never as a crash.
 */
export function normalizeDayWindows(value: unknown): AppointmentDayWindow[] {
  if (!value) return []

  const entries = Array.isArray(value) ? value : [value]
  const parsed: AppointmentDayWindow[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const start = normalizeTimeString(record.start)
    const end = normalizeTimeString(record.end)
    if (!start || !end) continue
    if (timeStringToMinutes(end) <= timeStringToMinutes(start)) continue
    parsed.push({ start, end })
  }

  parsed.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start))

  const disjoint: AppointmentDayWindow[] = []
  for (const window of parsed) {
    const previous = disjoint[disjoint.length - 1]
    if (previous && timeStringToMinutes(window.start) < timeStringToMinutes(previous.end)) continue
    disjoint.push(window)
    if (disjoint.length === MAX_WINDOWS_PER_DAY) break
  }

  return disjoint
}

/**
 * Accepts both the legacy single-window shape (`{start, end} | null`) and the
 * current array shape. Legacy rows upgrade to a one-element array, so this
 * needs no data migration and a stale row can never break rendering.
 *
 * Windows are sorted by start and any window overlapping its predecessor is
 * dropped, so downstream slot generation can assume disjoint, ordered windows.
 */
export function normalizeAppointmentSettings(value: unknown): AppointmentSettings | null {
  if (!value || typeof value !== 'object') return null

  const source = value as Record<string, unknown>
  const rawAvailability =
    source.availability && typeof source.availability === 'object'
      ? (source.availability as Record<string, unknown>)
      : {}

  const availability = APPOINTMENT_WEEKDAYS.reduce<Record<AppointmentWeekday, AppointmentDayWindow[]>>(
    (result, day) => {
      result[day] = normalizeDayWindows(rawAvailability[day])
      return result
    },
    {} as Record<AppointmentWeekday, AppointmentDayWindow[]>,
  )

  return {
    slot_duration: clampInteger(source.slot_duration, 15, 240, DEFAULT_APPOINTMENT_SETTINGS.slot_duration),
    capacity: clampInteger(source.capacity, 1, 20, DEFAULT_APPOINTMENT_SETTINGS.capacity),
    buffer_minutes: clampInteger(source.buffer_minutes, 0, 60, DEFAULT_APPOINTMENT_SETTINGS.buffer_minutes),
    advance_days: clampInteger(source.advance_days, 1, 90, DEFAULT_APPOINTMENT_SETTINGS.advance_days),
    min_notice_minutes: clampInteger(
      source.min_notice_minutes,
      0,
      1440,
      DEFAULT_APPOINTMENT_SETTINGS.min_notice_minutes,
    ),
    availability,
  }
}
