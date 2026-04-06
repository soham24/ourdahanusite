const SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//

export function normalizeOptionalUrl(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''

  // Reject pasted prose or whitespace-heavy values before we try to coerce them into a URL.
  if (/\s/.test(trimmed)) return ''

  const candidate = SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(candidate)
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    const hasValidHost = parsed.hostname === 'localhost' || parsed.hostname.includes('.')

    if (!isHttp || !hasValidHost) return ''

    return parsed.toString()
  } catch {
    return ''
  }
}

export function normalizeOptionalUrlOrNull(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalUrl(value)
  return normalized || null
}
