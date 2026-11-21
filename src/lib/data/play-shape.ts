import type { PastCompetition, TodayCompetition } from './competition'
import type { LeaderboardEntry } from './game'

// Pure shaping of the /play bundle results, kept free of server imports so it can be unit tested.
const ANONYMOUS = 'Anonymous Player'

/**
 * Everything public on /play. One database call, cached for 30 seconds and
 * shared by every visitor, so traffic spikes do not reach the database.
 */
export interface PlayPublic {
  weekly: LeaderboardEntry[]
  allTime: LeaderboardEntry[]
  today: (TodayCompetition & { board: LeaderboardEntry[] }) | null
  past: PastCompetition[]
}

/** The signed-in player's own numbers, also one call. */
export interface PlayMe {
  bestWeek: number | null
  bestAll: number | null
  lastPlayedAt: string | null
  hasName: boolean
}

export const EMPTY_PLAY_PUBLIC: PlayPublic = { weekly: [], allTime: [], today: null, past: [] }

type StandingRow = { full_name: string | null; best_score: number }

function toEntries(rows: unknown): LeaderboardEntry[] {
  if (!Array.isArray(rows)) return []
  return (rows as StandingRow[]).map((r) => ({
    name: r.full_name?.trim() || ANONYMOUS,
    score: r.best_score,
  }))
}

type RawCompetition = { id?: string; title?: string; prize?: string; day?: string }

function toCompetition(raw: unknown): TodayCompetition | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as RawCompetition
  if (!c.id || !c.title || !c.prize || !c.day) return null
  return { id: c.id, title: c.title, prize: c.prize, day: c.day }
}

/** Shapes the raw `get_play_public` result. Exported for tests. */
export function toPlayPublic(raw: unknown): PlayPublic {
  if (!raw || typeof raw !== 'object') return EMPTY_PLAY_PUBLIC
  const r = raw as { weekly?: unknown; all_time?: unknown; today?: unknown; past?: unknown }
  const today = toCompetition(r.today)
  const past = Array.isArray(r.past)
    ? r.past.flatMap((p) => {
      const c = toCompetition(p)
      return c ? [{ ...c, top: toEntries((p as { top?: unknown }).top) }] : []
    })
    : []
  return {
    weekly: toEntries(r.weekly),
    allTime: toEntries(r.all_time),
    today: today ? { ...today, board: toEntries((r.today as { board?: unknown }).board) } : null,
    past,
  }
}

/** Shapes the raw `get_play_me` result; null means nobody is signed in. Exported for tests. */
export function toPlayMe(raw: unknown): PlayMe | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { best_week?: unknown; best_all?: unknown; last_played_at?: unknown; has_name?: unknown }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return {
    bestWeek: num(r.best_week),
    bestAll: num(r.best_all),
    lastPlayedAt: typeof r.last_played_at === 'string' ? r.last_played_at : null,
    hasName: r.has_name === true,
  }
}
