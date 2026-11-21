import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getPlayMe, getPlayPublic } from '@/lib/data/play'
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

export default function PlayPage() {
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
        <Suspense fallback={<PlaySkeleton />}>
          <PlayContent />
        </Suspense>
      </div>
    </div>
  )
}

/** Holds the game's place while its data arrives, so the page does not jump. */
function PlaySkeleton() {
  return (
    <div className="flex w-full flex-col items-center gap-10" aria-busy="true" aria-label="Loading the game">
      <div className="aspect-[9/16] w-full max-w-[420px] animate-pulse rounded-[2rem] bg-[#2E5A35]/15" />
      <div className="h-64 w-full max-w-4xl animate-pulse rounded-3xl bg-[#F7F2EB]" />
    </div>
  )
}

async function PlayContent() {
  // Two reads at most: the public bundle (cached, shared by every visitor) and,
  // only with a sign-in cookie, the player's own numbers.
  const [pub, me] = await Promise.all([getPlayPublic(), getPlayMe()])
  const yourBestWeek = me?.bestWeek ?? null
  const yourBestAllTime = me?.bestAll ?? null

  return (
    <>
      <PlayArea
        isSignedIn={me !== null}
        initialBestScore={Math.max(yourBestWeek ?? 0, yourBestAllTime ?? 0) || null}
        competition={pub.today}
        board={pub.today?.board ?? []}
        hasDisplayName={me?.hasName ?? false}
      />
      <section className="w-full max-w-4xl" aria-labelledby="leaderboard-title">
        <div className="mb-4 text-center">
          <p className="od-eyebrow">Community challenge</p>
          <h2 id="leaderboard-title" className="font-display mt-2 text-3xl text-[var(--od-ink)]">
            Orchard champions
          </h2>
        </div>
        <Leaderboard
          weekly={pub.weekly}
          allTime={pub.allTime}
          yourBestWeek={yourBestWeek}
          yourBestAllTime={yourBestAllTime}
        />
      </section>
      <PastCompetitions competitions={pub.past} />
    </>
  )
}
