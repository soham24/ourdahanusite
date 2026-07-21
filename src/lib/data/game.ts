import 'server-only'

import { createPublicClient } from '@/lib/supabase/public'

export type LeaderboardScope = 'this_week' | 'all_time'

export interface LeaderboardEntry {
  name: string
  score: number
}

const GAME_ID = 'chikoo_catcher'

export async function getGameLeaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]> {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase.rpc('get_game_leaderboard', {
      p_game: GAME_ID,
      p_scope: scope,
    })
    const rows = (data ?? []) as { full_name: string | null; best_score: number }[]
    return rows.map((r) => ({
      name: r.full_name?.trim() || 'Anonymous Player',
      score: r.best_score,
    }))
  } catch {
    return []
  }
}

function startOfThisWeekUtc(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  const diffToMonday = (day + 6) % 7
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - diffToMonday)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

export async function getUserBestScore(userId: string, scope: LeaderboardScope): Promise<number | null> {
  try {
    const supabase = createPublicClient()
    let query = supabase
      .from('game_scores')
      .select('score')
      .eq('user_id', userId)
      .eq('game', GAME_ID)
      .order('score', { ascending: false })
      .limit(1)

    if (scope === 'this_week') {
      query = query.gte('played_at', startOfThisWeekUtc().toISOString())
    }

    const { data } = await query.maybeSingle()
    return (data as { score: number } | null)?.score ?? null
  } catch {
    return null
  }
}
