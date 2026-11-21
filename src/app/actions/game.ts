'use server'

import { GAME_CONFIG } from '@/app/play/game/config'
import { readPlayMe } from '@/lib/data/play'
import { getIndiaToday } from '@/lib/india-time'
import { isBlocked, recordWrong } from '@/lib/game/wrong-attempts'
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

const COMPETITION_UNAVAILABLE = 'Competition entries are unavailable right now.'

/** `hasName` comes from the player's stats read, so the check costs no extra query. */
function competitionDeps(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  hasName: boolean,
): CompetitionDeps {
  return {
    today: getIndiaToday,
    async findActive(day) {
      const { data } = await admin
        .from('game_competitions')
        .select('id, code')
        .eq('game', GAME_ID)
        .eq('day', day)
        .eq('active', true)
        .maybeSingle()
      return (data as { id: string; code: string } | null) ?? null
    },
    hasDisplayName: async () => hasName,
    attemptsBlocked: (userId) => isBlocked(`competition-code:${userId}`, CODE_ATTEMPT_LIMIT),
    recordWrongAttempt: (userId) => recordWrong(`competition-code:${userId}`, CODE_ATTEMPT_WINDOW_MS),
  }
}

export async function checkCompetitionCode(
  code: string,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient()
  // Full session check (not the lighter token check): competition entries win
  // real prizes, so a banned or signed-out account must be refused at once.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Please sign in to take part.' }

  const admin = createAdminClient()
  if (!admin) return { ok: false, message: COMPETITION_UNAVAILABLE }

  const me = await readPlayMe(supabase).catch(() => null)
  const result = await checkCode(user.id, String(code ?? ''), competitionDeps(admin, me?.hasName ?? false))
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
  // Full session check (not the lighter token check): competition entries win
  // real prizes, so a banned or signed-out account must be refused at once.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to save your score.' }

  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { error: 'Invalid score.' }
  }

  // One read gives the cooldown, the previous best and the display-name check.
  let me
  try {
    me = await readPlayMe(supabase)
  } catch {
    return { error: 'Could not save your score. Please try again.' }
  }

  if (me?.lastPlayedAt) {
    const elapsed = Date.now() - new Date(me.lastPlayedAt).getTime()
    if (elapsed < COOLDOWN_MS) {
      return { error: 'Please wait a moment before submitting again.' }
    }
  }

  const previousBest = me?.bestAll ?? 0

  const plainInsert = () =>
    supabase.from('game_scores').insert({ user_id: user.id, game: GAME_ID, score })
  const isNewBest = score > previousBest

  if (!competitionCode) {
    const { error } = await plainInsert()
    if (error) return { error: 'Could not save your score. Please try again.' }
    return { isNewBest }
  }

  const admin = createAdminClient()
  if (!admin) {
    const { error } = await plainInsert()
    if (error) return { error: 'Could not save your score. Please try again.' }
    return { isNewBest, competition: 'not_counted', competitionMessage: COMPETITION_UNAVAILABLE }
  }

  const check = await checkCode(user.id, String(competitionCode), competitionDeps(admin, me?.hasName ?? false))
  if (!check.ok) {
    const { error } = await plainInsert()
    if (error) return { error: 'Could not save your score. Please try again.' }
    return { isNewBest, competition: 'not_counted', competitionMessage: check.message }
  }

  // Players cannot set competition_id themselves (RLS), so insert as the verified user.
  const { error } = await admin.from('game_scores').insert({
    user_id: user.id,
    game: GAME_ID,
    score,
    competition_id: check.competitionId,
  })
  // Deliberately no fallback to a plain insert here: the player can retry and still be counted.
  if (error) return { error: 'Could not save your score. Please try again.' }
  return { isNewBest, competition: 'counted' }
}
