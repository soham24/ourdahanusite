import 'server-only'

import { getIndiaToday } from '@/lib/india-time'
import { createPublicClient } from '@/lib/supabase/public'
import type { LeaderboardEntry } from './game'

const GAME_ID = 'chikoo_catcher'
const ANONYMOUS = 'Anonymous Player'

export interface TodayCompetition {
  id: string
  title: string
  prize: string
  day: string
}

export interface PastCompetition extends TodayCompetition {
  top: LeaderboardEntry[]
}

/**
 * The competition functions are newer than the generated database types, so
 * the typed public client is narrowed to just the RPC call shape we use.
 */
type CompetitionRpcClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

function client(): CompetitionRpcClient {
  return createPublicClient() as unknown as CompetitionRpcClient
}

type StandingRow = { full_name: string | null; best_score: number }

function toEntries(rows: unknown): LeaderboardEntry[] {
  if (!Array.isArray(rows)) return []
  return (rows as StandingRow[]).map((r) => ({
    name: r.full_name?.trim() || ANONYMOUS,
    score: r.best_score,
  }))
}

export async function getTodayCompetition(): Promise<TodayCompetition | null> {
  try {
    const { data, error } = await client().rpc('get_today_competition', {
      p_game: GAME_ID,
      p_day: getIndiaToday(),
    })
    if (error || !data || typeof data !== 'object') return null
    const row = data as Partial<TodayCompetition>
    if (!row.id || !row.title || !row.prize || !row.day) return null
    return { id: row.id, title: row.title, prize: row.prize, day: row.day }
  } catch {
    return null
  }
}

export async function getCompetitionLeaderboard(id: string, limit = 10): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await client().rpc('get_competition_leaderboard', {
      p_competition: id,
      p_limit: limit,
    })
    if (error) return []
    return toEntries(data)
  } catch {
    return []
  }
}

export async function getPastCompetitions(limit = 5): Promise<PastCompetition[]> {
  try {
    const { data, error } = await client().rpc('get_past_competitions', {
      p_game: GAME_ID,
      p_before: getIndiaToday(),
      p_limit: limit,
    })
    if (error || !Array.isArray(data)) return []
    return (data as (TodayCompetition & { top: unknown })[]).map((c) => ({
      id: c.id,
      title: c.title,
      prize: c.prize,
      day: c.day,
      top: toEntries(c.top),
    }))
  } catch {
    return []
  }
}
