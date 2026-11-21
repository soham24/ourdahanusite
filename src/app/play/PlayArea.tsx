'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
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
  indiaTodayInBrowser,
  loadCompetitionCode,
  saveCompetitionCode,
  savedCodeNoLongerValid,
} from './competition-storage'

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

/**
 * Saved codes already re-checked during this page load ("day:code"), so a
 * router refresh after each round does not ask the server again.
 */
const recheckedCodes = new Set<string>()

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

  // A code saved on an earlier visit is checked once when the page loads, so a
  // player whose code the owner has since changed finds out before playing a
  // round, not after it. One call, and only for players with a saved code.
  useEffect(() => {
    if (!day || override || !isSignedIn || storedCode === null) return
    const key = `${day}:${storedCode}`
    if (recheckedCodes.has(key)) return
    recheckedCodes.add(key)
    checkCompetitionCode(storedCode)
      .then((result) => {
        // Skip if the player has joined with another code in the meantime.
        if (loadCompetitionCode(browserStorage(), day) !== storedCode) return
        if (!result.ok && savedCodeNoLongerValid(result.reason)) {
          onCompetitionRejected(result.message ?? 'Your saved code no longer works. Enter today’s code again.')
        }
      })
      .catch(() => {
        // Offline or a server hiccup: keep the code; the round check still runs.
      })
  }, [day, override, isSignedIn, storedCode, onCompetitionRejected])

  // Read when a round is saved: a tab left open past India midnight must not
  // send yesterday's code (the server would log it as a wrong guess).
  const getCompetitionCode = useCallback(
    () => (competitionCode !== null && day === indiaTodayInBrowser() ? competitionCode : null),
    [competitionCode, day],
  )

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
        competitionCode={getCompetitionCode}
        onCompetitionRejected={onCompetitionRejected}
        onCompetitionCounted={onCompetitionCounted}
      />
    </>
  )
}
