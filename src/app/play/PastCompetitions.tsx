import type { PastCompetition } from '@/lib/data/competition'
import type { LeaderboardEntry } from '@/lib/data/game'

const dayFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})

const MEDALS = [
  'bg-[#F0C87A] text-[#3D240A]',
  'bg-[#E6B95F] text-[#42270A]',
  'bg-[#D89A4C] text-[#422006]',
]

const PODIUM = 3

function ResultRow({ entry, place }: { entry: LeaderboardEntry; place: number }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold tabular-nums ${
            MEDALS[place - 1] ?? 'text-[var(--od-brand)]'
          }`}
        >
          {place}
        </span>
        <span className="truncate font-medium text-[var(--od-ink)]">{entry.name}</span>
      </span>
      <span className="font-semibold tabular-nums text-[var(--od-ink)]">{entry.score}</span>
    </li>
  )
}

/** `YYYY-MM-DD` as e.g. "21 Nov 2026". Noon UTC keeps it on the same India day. */
export function formatCompetitionDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? day : dayFormatter.format(date)
}

export default function PastCompetitions({ competitions }: { competitions: PastCompetition[] }) {
  if (competitions.length === 0) return null

  return (
    <section className="w-full max-w-4xl" aria-labelledby="past-competitions-title">
      <div className="mb-4 text-center">
        <p className="od-eyebrow">Daily competition</p>
        <h2 id="past-competitions-title" className="font-display mt-2 text-3xl text-[var(--od-ink)]">
          Final results
        </h2>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {competitions.map((competition, index) => (
          <li key={competition.id} className="od-card min-w-0 p-4">
            <p className="text-xs font-semibold text-[var(--od-muted)]">
              <time dateTime={competition.day}>{formatCompetitionDay(competition.day)}</time>
            </p>
            <h3 className="mt-1 break-words text-base font-bold text-[var(--od-ink)]">{competition.title}</h3>
            <p className="mt-0.5 break-words text-xs text-[var(--od-muted)]">Prize: {competition.prize}</p>
            {competition.top.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--od-muted)]">No one played this one.</p>
            ) : (
              <>
                <ol className="mt-3 space-y-1.5">
                  {competition.top.slice(0, PODIUM).map((entry, i) => (
                    <ResultRow key={`${entry.name}-${i}`} entry={entry} place={i + 1} />
                  ))}
                </ol>
                {competition.top.length > PODIUM && (
                  // The latest result is shown in full; older ones fold away so
                  // the page stays short.
                  <details className="group mt-2" open={index === 0}>
                    <summary className="cursor-pointer select-none text-xs font-semibold text-[var(--od-brand)]">
                      <span className="group-open:hidden">Show places 4 to {competition.top.length}</span>
                      <span className="hidden group-open:inline">Hide places 4 to {competition.top.length}</span>
                    </summary>
                    <ol className="mt-2 space-y-1.5" start={PODIUM + 1}>
                      {competition.top.slice(PODIUM).map((entry, i) => (
                        <ResultRow key={`${entry.name}-${i + PODIUM}`} entry={entry} place={i + PODIUM + 1} />
                      ))}
                    </ol>
                  </details>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
