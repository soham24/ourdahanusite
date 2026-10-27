/**
 * The newest item from each business, newest first, up to `limit`.
 *
 * Expects rows already ordered newest first. One busy shop editing its whole
 * catalog would otherwise fill every slot, so only the first (most recent)
 * row per business is kept.
 */
export function latestPerBusiness<T extends { listing_id: string }>(rows: readonly T[], limit: number): T[] {
  const seen = new Set<string>()
  const picked: T[] = []
  for (const row of rows) {
    if (picked.length >= limit) break
    if (seen.has(row.listing_id)) continue
    seen.add(row.listing_id)
    picked.push(row)
  }
  return picked
}
