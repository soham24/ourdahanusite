import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getGameLeaderboard, getUserBestScore } from '@/lib/data/game'
import ChikooCatcherGame from './ChikooCatcherGame'
import Leaderboard from './Leaderboard'

export const metadata: Metadata = {
  title: 'Chikoo Catcher — A Dahanu Mini-Game',
  description:
    "Catch falling chikoos, dodge the rotten ones, and climb the OurDahanu leaderboard. A quick, fun mini-game themed around Dahanu's signature fruit.",
}

export default async function PlayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [weekly, allTime, yourBestWeek, yourBestAllTime] = await Promise.all([
    getGameLeaderboard('this_week'),
    getGameLeaderboard('all_time'),
    user ? getUserBestScore(user.id, 'this_week') : Promise.resolve(null),
    user ? getUserBestScore(user.id, 'all_time') : Promise.resolve(null),
  ])

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 py-10">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-[var(--od-ink)]">
          🧺 Chikoo Catcher
        </h1>
        <p className="mt-2 text-sm text-[var(--od-muted)]">
          Catch the good chikoos, dodge the rotten ones — a quick Dahanu mini-game.
        </p>
      </div>

      <ChikooCatcherGame
        isSignedIn={Boolean(user)}
        initialBestScore={Math.max(yourBestWeek ?? 0, yourBestAllTime ?? 0) || null}
      />

      <Leaderboard
        weekly={weekly}
        allTime={allTime}
        yourBestWeek={yourBestWeek}
        yourBestAllTime={yourBestAllTime}
      />
    </div>
  )
}
