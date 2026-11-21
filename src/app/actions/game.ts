'use server'

import { GAME_CONFIG } from '@/app/play/game/config'
import { getIndiaToday } from '@/lib/india-time'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import {
  checkCode,
  CODE_ATTEMPT_LIMIT,
  CODE_ATTEMPT_WINDOW_MS,
  type CompetitionDeps,
} from './game-competition-core'

const GAME_ID = 'chikoo_catcher'
const MAX_SCORE = GAME_CONFIG.maxScore
const COOLDOWN_MS = 20_000

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function competitionDeps(supabase: SupabaseServerClient): CompetitionDeps {
  return {
    today: getIndiaToday,
    async findActive(day) {
      const admin = createAdminClient()
      if (!admin) return null
      const { data } = await admin
        .from('game_competitions')
        .select('id, code')
        .eq('game', GAME_ID)
        .eq('day', day)
        .eq('active', true)
        .maybeSingle()
      return (data as { id: string; code: string } | null) ?? null
    },
    async hasDisplayName(userId) {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle()
      const name = (data as { full_name: string | null } | null)?.full_name
      return typeof name === 'string' && name.trim().length > 0
    },
    allowAttempt: (userId) =>
      rateLimit(`competition-code:${userId}`, CODE_ATTEMPT_LIMIT, CODE_ATTEMPT_WINDOW_MS).ok,
  }
}

export async function checkCompetitionCode(
  code: string,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Please sign in to take part.' }

  const result = await checkCode(user.id, String(code ?? ''), competitionDeps(supabase))
  return result.ok ? { ok: true } : { ok: false, message: result.message }
}

export async function submitGameScore(
  score: number,
  competitionCode?: string,
): Promise<{
  error?: string
  isNewBest?: boolean
  competition?: 'counted' | 'not_counted'
  competitionMessage?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to save your score.' }

  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { error: 'Invalid score.' }
  }

  const { data: recent } = await supabase
    .from('game_scores')
    .select('played_at')
    .eq('user_id', user.id)
    .eq('game', GAME_ID)
    .order('played_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent?.played_at) {
    const elapsed = Date.now() - new Date(recent.played_at as string).getTime()
    if (elapsed < COOLDOWN_MS) {
      return { error: 'Please wait a moment before submitting again.' }
    }
  }

  const { data: best } = await supabase
    .from('game_scores')
    .select('score')
    .eq('user_id', user.id)
    .eq('game', GAME_ID)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle()

  const previousBest = (best as { score: number } | null)?.score ?? 0

  const plainInsert = () =>
    supabase.from('game_scores').insert({ user_id: user.id, game: GAME_ID, score })
  const isNewBest = score > previousBest

  if (!competitionCode) {
    const { error } = await plainInsert()
    if (error) return { error: 'Could not save your score. Please try again.' }
    return { isNewBest }
  }

  const check = await checkCode(user.id, String(competitionCode), competitionDeps(supabase))
  if (!check.ok) {
    const { error } = await plainInsert()
    if (error) return { error: 'Could not save your score. Please try again.' }
    return { isNewBest, competition: 'not_counted', competitionMessage: check.message }
  }

  // Players cannot set competition_id themselves (RLS), so insert as the verified user.
  const admin = createAdminClient()
  if (!admin) {
    const { error } = await plainInsert()
    if (error) return { error: 'Could not save your score. Please try again.' }
    return {
      isNewBest,
      competition: 'not_counted',
      competitionMessage: 'Competition entries are unavailable right now.',
    }
  }
  const { error } = await admin.from('game_scores').insert({
    user_id: user.id,
    game: GAME_ID,
    score,
    competition_id: check.competitionId,
  })
  if (error) return { error: 'Could not save your score. Please try again.' }
  return { isNewBest, competition: 'counted' }
}
