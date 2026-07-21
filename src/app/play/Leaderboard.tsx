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
    <div className="rounded-2xl border border-[var(--od-border)] bg-white p-4">
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--od-muted)]">
          No scores yet — be the first!
        </p>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((entry, i) => (
            <li
              key={`${entry.name}-${i}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="w-5 text-right font-bold text-[var(--od-brand)]">{i + 1}</span>
                <span className="font-medium text-[var(--od-ink)]">{entry.name}</span>
              </span>
              <span className="font-semibold">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
      {yourBest !== null && (
        <p className="mt-3 border-t border-[var(--od-border)] pt-3 text-center text-xs text-[var(--od-muted)]">
          Your best: <span className="font-semibold text-[var(--od-ink)]">{yourBest}</span>
        </p>
      )}
    </div>
  )

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-3 flex gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setTab('week')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
            tab === 'week' ? 'bg-[var(--od-ink)] text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          This Week
        </button>
        <button
          type="button"
          onClick={() => setTab('all_time')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
            tab === 'all_time' ? 'bg-[var(--od-ink)] text-white' : 'bg-gray-100 text-gray-700'
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
