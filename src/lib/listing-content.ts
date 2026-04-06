import { normalizeOptionalUrlOrNull } from '@/lib/url'

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
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

    normalized.push({
      ...(type ? { type } : {}),
      name,
      ...(desc ? { desc } : {}),
      ...(price ? { price } : {}),
      ...(image ? { image } : {}),
    })

    if (normalized.length >= 20) break
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
