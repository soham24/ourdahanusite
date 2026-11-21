import type { Metadata } from 'next'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompetitionLeaderboard, getPastCompetitions, getTodayCompetition } from '@/lib/data/competition'
import { getGameLeaderboard, getUserBestScore } from '@/lib/data/game'
import Leaderboard from './Leaderboard'
import PastCompetitions from './PastCompetitions'
import PlayArea from './PlayArea'
import { siteConfig } from '@/lib/site'

const TITLE = `Chikoo Catcher — A ${siteConfig.town} Mini-Game`
const DESCRIPTION =
  `Catch falling chikoos, dodge the rotten ones, and climb the ${siteConfig.name} leaderboard. A quick, fun mini-game themed around ${siteConfig.town}'s signature fruit.`

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

type ServerClient = Awaited<ReturnType<typeof createClient>>

async function userHasDisplayName(supabase: ServerClient, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
    const name = (data as { full_name: string | null } | null)?.full_name
    return typeof name === 'string' && name.trim().length > 0
  } catch {
    return false
  }
}

async function getTodayWithBoard() {
  const competition = await getTodayCompetition()
  const board = competition ? await getCompetitionLeaderboard(competition.id, 10) : []
  return { competition, board }
}

export default async function PlayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Today's competition depends on the current India date, so render per request.
  await connection()

  const [weekly, allTime, yourBestWeek, yourBestAllTime, today, past, hasDisplayName] = await Promise.all([
    getGameLeaderboard('this_week'),
    getGameLeaderboard('all_time'),
    user ? getUserBestScore(user.id, 'this_week') : Promise.resolve(null),
    user ? getUserBestScore(user.id, 'all_time') : Promise.resolve(null),
    getTodayWithBoard(),
    getPastCompetitions(5),
    user ? userHasDisplayName(supabase, user.id) : Promise.resolve(false),
  ])

  return (
    <div className="od-page min-h-screen">
      <div className="od-shell flex flex-col items-center gap-10 py-8 sm:py-12">
        <header className="max-w-2xl text-center">
          <p className="od-eyebrow">{siteConfig.name} Arcade</p>
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-[var(--od-ink)] sm:text-5xl">
            Chikoo Catcher
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--od-muted)] sm:text-base">
            Race through a sunlit {siteConfig.town} orchard. Catch the ripe harvest, avoid rotten fruit, and keep your combo alive.
          </p>
        </header>
        <PlayArea
          isSignedIn={Boolean(user)}
          initialBestScore={Math.max(yourBestWeek ?? 0, yourBestAllTime ?? 0) || null}
          competition={today.competition}
          board={today.board}
          hasDisplayName={hasDisplayName}
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
        <PastCompetitions competitions={past} />
      </div>
    </div>
  )
}
