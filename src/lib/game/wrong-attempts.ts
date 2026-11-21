// In-memory (per server instance) counter of WRONG competition codes per user.
// Correct codes never touch it, so only guessing is throttled.
type Entry = { count: number; resetAt: number }

const entries = new Map<string, Entry>()

function live(key: string, now: number): Entry | undefined {
  const e = entries.get(key)
  if (e && e.resetAt <= now) {
    entries.delete(key)
    return undefined
  }
  return e
}

export function isBlocked(key: string, limit: number, now = Date.now()): boolean {
  return (live(key, now)?.count ?? 0) >= limit
}

export function recordWrong(key: string, windowMs: number, now = Date.now()): void {
  if (entries.size >= 5000) {
    for (const [k, e] of entries) if (e.resetAt <= now) entries.delete(k)
  }
  const e = live(key, now)
  if (e) e.count += 1
  else entries.set(key, { count: 1, resetAt: now + windowMs })
}
