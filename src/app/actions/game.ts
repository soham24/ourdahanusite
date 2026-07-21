'use server'

import { createClient } from '@/lib/supabase/server'

const GAME_ID = 'chikoo_catcher'
const MAX_SCORE = 500
const COOLDOWN_MS = 20_000

export async function submitGameScore(
  score: number,
): Promise<{ error?: string; isNewBest?: boolean }> {
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

  const { error } = await supabase.from('game_scores').insert({
    user_id: user.id,
    game: GAME_ID,
    score,
  })

  if (error) return { error: 'Could not save your score. Please try again.' }

  return { isNewBest: score > previousBest }
}
