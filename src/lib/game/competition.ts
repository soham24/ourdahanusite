import { timingSafeEqual } from 'node:crypto'

const CODE_PATTERN = /^[A-Z0-9]{3,24}$/
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function normalizeCompetitionCode(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

export function codesMatch(entered: string, stored: string): boolean {
  const normalized = normalizeCompetitionCode(entered)
  if (normalized === null) return false
  const a = Buffer.from(normalized)
  const b = Buffer.from(stored)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

type CompetitionInput = { day: string; title: string; prize: string; code: string; active: boolean }

function isRealDay(day: string): boolean {
  if (!DAY_PATTERN.test(day)) return false
  const d = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day
}

export function validateCompetitionInput(
  input: CompetitionInput,
  today: string,
): { ok: true; value: CompetitionInput } | { ok: false; error: string } {
  if (!isRealDay(input.day)) return { ok: false, error: 'Pick a valid day.' }
  if (input.day < today) return { ok: false, error: 'The day cannot be in the past.' }
  const title = input.title.trim()
  if (title.length < 1 || title.length > 80) return { ok: false, error: 'Title must be 1 to 80 characters.' }
  const prize = input.prize.trim()
  if (prize.length < 1 || prize.length > 200) return { ok: false, error: 'Prize must be 1 to 200 characters.' }
  const code = normalizeCompetitionCode(input.code)
  if (code === null) return { ok: false, error: 'Code must be 3 to 24 letters or digits.' }
  return { ok: true, value: { day: input.day, title, prize, code, active: input.active } }
}

export type Standing = { userId: string; best: number; reachedAt: string; rounds: number; excluded: boolean }

export function rankStandings<T extends { userId: string; score: number; playedAt: string }>(
  rows: T[],
  excluded: Set<string>,
): Standing[] {
  const byUser = new Map<string, Standing>()
  for (const row of rows) {
    const cur = byUser.get(row.userId)
    if (!cur) {
      byUser.set(row.userId, {
        userId: row.userId,
        best: row.score,
        reachedAt: row.playedAt,
        rounds: 1,
        excluded: excluded.has(row.userId),
      })
      continue
    }
    cur.rounds += 1
    if (row.score > cur.best) {
      cur.best = row.score
      cur.reachedAt = row.playedAt
    } else if (row.score === cur.best && Date.parse(row.playedAt) < Date.parse(cur.reachedAt)) {
      cur.reachedAt = row.playedAt
    }
  }
  return [...byUser.values()].sort((x, y) => {
    if (x.excluded !== y.excluded) return x.excluded ? 1 : -1
    if (x.best !== y.best) return y.best - x.best
    const t = Date.parse(x.reachedAt) - Date.parse(y.reachedAt)
    if (t !== 0) return t
    return x.userId < y.userId ? -1 : x.userId > y.userId ? 1 : 0
  })
}
