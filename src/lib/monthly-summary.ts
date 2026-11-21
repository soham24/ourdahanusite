/**
 * Pure shaping for the owner's monthly summary.
 *
 * Runs on the 1st (IST) and reports the month that just ended against the
 * month before it. Kept free of I/O so the date edges are testable.
 */

import { monthWindows, type ListingEventRow } from './listing-stats'

export type SummaryMonth = {
  /** `YYYY-MM` of the month being reported, stored in listings.last_summary_month. */
  key: string
  /** "October 2026". */
  label: string
  start: string
  end: string
  /** The month before it, for the comparison. */
  priorStart: string
  priorEnd: string
}

export type MonthTotals = {
  views: number
  phone: number
  whatsapp: number
  priorViews: number
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** The month that ended before `today` (an IST `YYYY-MM-DD`). */
export function summaryMonth(today: string): SummaryMonth {
  const last = monthWindows(today)
  // Windows anchored inside last month give its own bounds and the one before.
  const prior = monthWindows(last.previousStart)
  const year = Number.parseInt(last.previousStart.slice(0, 4), 10)
  const month = Number.parseInt(last.previousStart.slice(5, 7), 10)
  return {
    key: last.previousStart.slice(0, 7),
    label: `${MONTHS[month - 1]} ${year}`,
    start: last.previousStart,
    end: last.previousEnd,
    priorStart: prior.previousStart,
    priorEnd: prior.previousEnd,
  }
}

/** Per-listing totals for the reported month, plus last month's views. */
export function monthTotals(rows: ListingEventRow[], month: SummaryMonth): Record<string, MonthTotals> {
  const out: Record<string, MonthTotals> = Object.create(null)
  for (const row of rows) {
    const inMonth = row.day >= month.start && row.day <= month.end
    const inPrior = row.day >= month.priorStart && row.day <= month.priorEnd
    if (!inMonth && !inPrior) continue
    const totals = out[row.listing_id] ?? (out[row.listing_id] = { views: 0, phone: 0, whatsapp: 0, priorViews: 0 })
    if (inPrior) {
      if (row.kind === 'view') totals.priorViews += 1
      continue
    }
    if (row.kind === 'view') totals.views += 1
    else if (row.kind === 'phone') totals.phone += 1
    else if (row.kind === 'whatsapp') totals.whatsapp += 1
  }
  return out
}
