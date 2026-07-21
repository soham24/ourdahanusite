'use client'

import { useState } from 'react'
import type { LeaderboardEntry } from '@/lib/data/game'

export default function Leaderboard({
  weekly,
  allTime,
  yourBestWeek,
  yourBestAllTime,
}: {
  weekly: LeaderboardEntry[]
  allTime: LeaderboardEntry[]
  yourBestWeek: number | null
  yourBestAllTime: number | null
}) {
  const [tab, setTab] = useState<'week' | 'all_time'>('week')

  const renderTable = (entries: LeaderboardEntry[], yourBest: number | null) => (
    <div className="od-card overflow-hidden p-3 sm:p-4">
      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--od-muted)]">
          No scores yet — be the first!
        </p>
      ) : (
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
                    i === 0
                      ? 'bg-[#F0C87A] text-[#3D240A] ring-2 ring-[#F0C87A]/35'
                      : i === 1
                        ? 'bg-[#E6B95F] text-[#42270A]'
                        : i === 2
                          ? 'bg-[#D89A4C] text-[#422006]'
                          : 'text-[var(--od-brand)]'
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
      )}
      {yourBest !== null && (
        <p className="mt-3 rounded-xl border border-[#E6B95F]/35 bg-[#FFF4D8] px-3 py-2.5 text-center text-xs text-[#76501D]">
          Your best: <span className="font-bold tabular-nums text-[var(--od-ink)]">{yourBest}</span>
        </p>
      )}
    </div>
  )

  return (
    <div className="w-full max-w-4xl">
      <div className="od-card mb-3 flex gap-1 p-1 md:hidden">
        <button
          type="button"
          onClick={() => setTab('week')}
          aria-pressed={tab === 'week'}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-brand)] ${
            tab === 'week'
              ? 'bg-[var(--od-ink)] text-[#FFF8ED]'
              : 'bg-transparent text-[var(--od-muted)]'
          }`}
        >
          This Week
        </button>
        <button
          type="button"
          onClick={() => setTab('all_time')}
          aria-pressed={tab === 'all_time'}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-brand)] ${
            tab === 'all_time'
              ? 'bg-[var(--od-ink)] text-[#FFF8ED]'
              : 'bg-transparent text-[var(--od-muted)]'
          }`}
        >
          All-Time
        </button>
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-center text-sm font-bold text-[var(--od-ink)]">This Week</h3>
          {renderTable(weekly, yourBestWeek)}
        </div>
        <div>
          <h3 className="mb-2 text-center text-sm font-bold text-[var(--od-ink)]">All-Time</h3>
          {renderTable(allTime, yourBestAllTime)}
        </div>
      </div>

      <div className="md:hidden">
        {tab === 'week' ? renderTable(weekly, yourBestWeek) : renderTable(allTime, yourBestAllTime)}
      </div>
    </div>
  )
}
