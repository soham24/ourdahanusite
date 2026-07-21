import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getGameLeaderboard, getUserBestScore } from '@/lib/data/game'
import ChikooCatcherGame from './ChikooCatcherGame'
import Leaderboard from './Leaderboard'

const TITLE = 'Chikoo Catcher — A Dahanu Mini-Game'
const DESCRIPTION =
  "Catch falling chikoos, dodge the rotten ones, and climb the OurDahanu leaderboard. A quick, fun mini-game themed around Dahanu's signature fruit."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
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
    <div className="od-page min-h-screen">
      <div className="od-shell flex flex-col items-center gap-10 py-8 sm:py-12">
        <header className="max-w-2xl text-center">
          <p className="od-eyebrow">OurDahanu Arcade</p>
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-[var(--od-ink)] sm:text-5xl">
            Chikoo Catcher
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--od-muted)] sm:text-base">
            Race through a sunlit Dahanu orchard. Catch the ripe harvest, avoid rotten fruit, and keep your combo alive.
          </p>
        </header>
        <ChikooCatcherGame
          isSignedIn={Boolean(user)}
          initialBestScore={Math.max(yourBestWeek ?? 0, yourBestAllTime ?? 0) || null}
        />
        <section className="w-full max-w-4xl" aria-labelledby="leaderboard-title">
          <div className="mb-4 text-center">
            <p className="od-eyebrow">Community challenge</p>
            <h2 id="leaderboard-title" className="font-display mt-2 text-3xl text-[var(--od-ink)]">
              Orchard champions
            </h2>
          </div>
          <Leaderboard
            weekly={weekly}
            allTime={allTime}
            yourBestWeek={yourBestWeek}
            yourBestAllTime={yourBestAllTime}
          />
        </section>
      </div>
    </div>
  )
}
