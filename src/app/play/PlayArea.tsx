'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { checkCompetitionCode } from '@/app/actions/game'
import { setDisplayName } from '@/app/actions/profile'
import type { TodayCompetition } from '@/lib/data/competition'
import type { LeaderboardEntry } from '@/lib/data/game'
import ChikooCatcherGame from './ChikooCatcherGame'
import CompetitionCard from './CompetitionCard'
import {
  browserStorage,
  clearCompetitionCode,
  loadCompetitionCode,
  saveCompetitionCode,
} from './competition-storage'

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

/**
 * Owns the competition code for today and hands it to the game. Without a
 * competition this is just the game, exactly as before.
 */
export default function PlayArea({
  isSignedIn,
  initialBestScore,
  competition,
  board,
  hasDisplayName,
}: {
  isSignedIn: boolean
  initialBestScore: number | null
  competition: TodayCompetition | null
  board: LeaderboardEntry[]
  hasDisplayName: boolean
}) {
  const router = useRouter()
  const day = competition?.day ?? null
  // The saved code is read from storage after hydration (null on the server).
  const storedCode = useSyncExternalStore(
    subscribeToStorage,
    () => (day ? loadCompetitionCode(browserStorage(), day) : null),
    () => null,
  )
  // What this tab decided since loading (joined or rejected); wins over storage,
  // so joining still works when storage is blocked.
  const [override, setOverride] = useState<{ code: string | null } | null>(null)
  const code = override ? override.code : storedCode
  const [message, setMessage] = useState('')
  const [nameSaved, setNameSaved] = useState(false)

  const join = useCallback(
    async (entered: string): Promise<string | null> => {
      if (!day) return null
      const trimmed = entered.trim().toUpperCase()
      if (!trimmed) return 'Enter today’s code.'
      try {
        const result = await checkCompetitionCode(trimmed)
        if (!result.ok) return result.message ?? 'That code did not work.'
      } catch {
        return 'Could not check the code. Check your connection and try again.'
      }
      saveCompetitionCode(browserStorage(), day, trimmed)
      setOverride({ code: trimmed })
      setMessage('')
      return null
    },
    [day],
  )

  const saveName = useCallback(
    async (name: string): Promise<string | null> => {
      try {
        const result = await setDisplayName(name)
        if (result.error) return result.error
      } catch {
        return 'Could not save your name. Check your connection and try again.'
      }
      setNameSaved(true)
      router.refresh()
      return null
    },
    [router],
  )

  const onCompetitionRejected = useCallback(
    (reason: string) => {
      if (day) clearCompetitionCode(browserStorage(), day)
      setOverride({ code: null })
      setMessage(reason)
    },
    [day],
  )

  // The game already calls router.refresh() after every saved round, which
  // reloads this board too; this only clears any stale notice.
  const onCompetitionCounted = useCallback(() => setMessage(''), [])

  const competitionCode = competition && isSignedIn ? code : null

  return (
    <>
      {competition && (
        <CompetitionCard
          competition={competition}
          board={board}
          isSignedIn={isSignedIn}
          hasDisplayName={hasDisplayName || nameSaved}
          joined={competitionCode !== null}
          message={message}
          onJoin={join}
          onSaveName={saveName}
        />
      )}
      <ChikooCatcherGame
        isSignedIn={isSignedIn}
        initialBestScore={initialBestScore}
        competitionCode={competitionCode}
        onCompetitionRejected={onCompetitionRejected}
        onCompetitionCounted={onCompetitionCounted}
      />
    </>
  )
}
