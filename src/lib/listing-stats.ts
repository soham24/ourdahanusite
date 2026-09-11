/**
 * Pure shaping for the owner-facing listing numbers.
 *
 * Kept free of Supabase and `server-only` so the whole of the actual logic
 * in this feature is unit-testable — everything else (the beacon route, the
 * server action, the dashboard line) is I/O around these two functions.
 *
 * All dates are `YYYY-MM-DD` strings in IST. String comparison is safe and
 * intentional: ISO dates sort lexicographically, so `day >= start` is a
 * correct range test without constructing a single Date object.
 */

export type ListingEventKind = 'view' | 'phone' | 'whatsapp'

export type MonthWindows = {
  /** First day of the current month, inclusive. */
  currentStart: string
  /** First day of the previous month, inclusive. */
  previousStart: string
  /** Last day of the previous month, inclusive. */
  previousEnd: string
}

export type ListingEventRow = {
  listing_id: string
  kind: ListingEventKind
  day: string
}

export type ListingStats = {
  views: number
  phone: number
  whatsapp: number
  previousViews: number
}

export const EMPTY_LISTING_STATS: ListingStats = {
  views: 0,
  phone: 0,
  whatsapp: 0,
  previousViews: 0,
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * The current and previous calendar month, derived from a `YYYY-MM-DD` day.
 *
 * Computed by arithmetic on the parts rather than with Date, so it cannot be
 * perturbed by the server's timezone. The caller supplies the IST day.
 */
export function monthWindows(today: string): MonthWindows {
  const year = Number.parseInt(today.slice(0, 4), 10)
  const month = Number.parseInt(today.slice(5, 7), 10)

  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1

  // Day 0 of a month is the last day of the month before it, which handles
  // 28/29/30/31 without a table. Built in UTC so no local offset applies.
  const lastDayOfPrev = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()

  return {
    currentStart: `${year}-${pad(month)}-01`,
    previousStart: `${prevYear}-${pad(prevMonth)}-01`,
    previousEnd: `${prevYear}-${pad(prevMonth)}-${pad(lastDayOfPrev)}`,
  }
}

/**
 * Fold raw event rows into per-listing totals. Listings with no events in
 * either window are simply absent from the result — the caller substitutes
 * EMPTY_LISTING_STATS so the dashboard can render "no views yet" rather than
 * a row of zeroes.
 */
export function summariseListingEvents(
  rows: ListingEventRow[],
  windows: MonthWindows,
): Record<string, ListingStats> {
  const out: Record<string, ListingStats> = Object.create(null)

  for (const row of rows) {
    const inCurrent = row.day >= windows.currentStart
    const inPrevious = row.day >= windows.previousStart && row.day <= windows.previousEnd
    if (!inCurrent && !inPrevious) continue

    const stats = out[row.listing_id] ?? (out[row.listing_id] = { ...EMPTY_LISTING_STATS })

    if (inCurrent) {
      if (row.kind === 'view') stats.views += 1
      else if (row.kind === 'phone') stats.phone += 1
      else stats.whatsapp += 1
    } else if (row.kind === 'view') {
      stats.previousViews += 1
    }
  }

  return out
}
