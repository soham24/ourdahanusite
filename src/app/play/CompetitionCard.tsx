'use client'

import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import type { TodayCompetition } from '@/lib/data/competition'
import type { LeaderboardEntry } from '@/lib/data/game'

const RANK_BADGES = [
  'bg-[#F0C87A] text-[#3D240A] ring-2 ring-[#F0C87A]/35',
  'bg-[#E6B95F] text-[#42270A]',
  'bg-[#D89A4C] text-[#422006]',
]

export function StandingsList({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--od-muted)]">
        No competition scores yet. Be the first!
      </p>
    )
  }
  return (
    <ol>
      {entries.map((entry, i) => (
        <li
          key={`${entry.name}-${i}`}
          className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
            i % 2 === 0 ? 'bg-[#F7F2EB]/70' : 'bg-transparent'
          }`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold tabular-nums ${
                RANK_BADGES[i] ?? 'text-[var(--od-brand)]'
              }`}
            >
              {i + 1}
            </span>
            <span className="truncate font-medium text-[var(--od-ink)]">{entry.name}</span>
          </span>
          <span className="ml-3 font-semibold tabular-nums text-[var(--od-ink)]">{entry.score}</span>
        </li>
      ))}
    </ol>
  )
}

function InlineForm({
  label,
  placeholder,
  button,
  pendingLabel,
  maxLength,
  minLength,
  uppercase,
  onSubmit,
}: {
  label: string
  placeholder: string
  button: string
  pendingLabel: string
  maxLength: number
  minLength: number
  uppercase?: boolean
  onSubmit: (value: string) => Promise<string | null>
}) {
  const id = useId()
  const [value, setValue] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    const failure = await onSubmit(value)
    setPending(false)
    if (failure) setError(failure)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <label htmlFor={id} className="block text-xs font-semibold text-[var(--od-ink)]">
        {label}
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(event) => setValue(uppercase ? event.target.value.toUpperCase() : event.target.value)}
          placeholder={placeholder}
          required
          minLength={minLength}
          maxLength={maxLength}
          autoComplete="off"
          autoCapitalize={uppercase ? 'characters' : 'words'}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="od-input min-w-0 flex-1 px-3 py-2.5 text-base sm:text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="od-button-primary shrink-0 px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {pending ? pendingLabel : button}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-xs font-medium text-[#A63D1F]">
          {error}
        </p>
      )}
    </form>
  )
}

export default function CompetitionCard({
  competition,
  board,
  isSignedIn,
  hasDisplayName,
  joined,
  message,
  onJoin,
  onSaveName,
}: {
  competition: TodayCompetition
  board: LeaderboardEntry[]
  isSignedIn: boolean
  hasDisplayName: boolean
  joined: boolean
  message: string
  onJoin: (code: string) => Promise<string | null>
  onSaveName: (name: string) => Promise<string | null>
}) {
  return (
    <section
      className="od-card w-full max-w-4xl p-4 sm:p-6"
      aria-labelledby="competition-title"
    >
      <p className="od-eyebrow">Daily competition</p>
      <h2
        id="competition-title"
        className="font-display mt-2 break-words text-2xl text-[var(--od-ink)] sm:text-3xl"
      >
        Today&apos;s competition: {competition.title}
      </h2>
      <p className="mt-1 break-words text-sm text-[var(--od-muted)]">Prize: {competition.prize}</p>

      {message && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-[#E6B95F]/35 bg-[#FFF4D8] px-3 py-2.5 text-xs text-[#76501D]"
        >
          {message}
        </p>
      )}

      {!isSignedIn ? (
        <Link href="/login?next=/play" className="od-button-primary mt-4 px-4 py-2.5 text-sm">
          Sign in to take part
        </Link>
      ) : !hasDisplayName ? (
        <InlineForm
          label="Your name on the board"
          placeholder="e.g. Asha P."
          button="Save name"
          pendingLabel={'Saving…'}
          minLength={2}
          maxLength={40}
          onSubmit={onSaveName}
        />
      ) : !joined ? (
        <InlineForm
          label="Today's code"
          placeholder="Enter the code"
          button="Join"
          pendingLabel={'Checking…'}
          minLength={3}
          maxLength={24}
          uppercase
          onSubmit={onJoin}
        />
      ) : (
        <>
          <p className="mt-4 text-sm font-semibold text-[var(--od-ink)]">
            You&apos;re in today&apos;s competition
          </p>
          <p className="mt-1 text-xs text-[var(--od-muted)]">Every round you finish today counts. Your best one is on the board.</p>
          <div className="mt-3">
            <StandingsList entries={board} />
          </div>
        </>
      )}
    </section>
  )
}
