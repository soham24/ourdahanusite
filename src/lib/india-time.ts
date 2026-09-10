/**
 * Shared "what is today in Asia/Kolkata" helpers.
 *
 * This file exists because the same date logic was copy-pasted into nine
 * different files. One of those copies computed the IST hour with
 * `Intl.DateTimeFormat({ hour12: false })`, which returns hour `"24"`
 * instead of `"00"` during the midnight hour — that bug made every
 * appointment business render as fully closed between 00:00 and 00:59 IST,
 * every night, in production. Fixing it only fixed one of the nine copies.
 * Keeping a single shared implementation means the next such bug is a
 * one-place fix instead of a nine-place hunt.
 *
 * This module must be importable from both server and client components,
 * so it must never import `server-only`, Supabase, or other Node-only
 * modules.
 */

export const INDIA_TIME_ZONE = 'Asia/Kolkata'

/** Today's date in IST as `YYYY-MM-DD`. */
export function getIndiaToday(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

/**
 * Add days to a `YYYY-MM-DD` date, staying in IST.
 *
 * Anchored at midday (`T12:00:00+05:30`) rather than midnight so that a
 * timezone shift during date-math can never push the result to the
 * previous day.
 */
export function addIndiaDays(dateString: string, days: number): string {
  const base = new Date(`${dateString}T12:00:00+05:30`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}
