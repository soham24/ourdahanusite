import { ArrowLeft, Trophy } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { getUserRole } from '@/app/actions/admin'
import { rankStandings } from '@/lib/game/competition'
import { INDIA_TIME_ZONE } from '@/lib/india-time'
import ExcludeButton from './ExcludeButton'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAGE_SIZE = 1000
const MAX_SCORE_ROWS = 50000
const PROFILE_CHUNK = 100

type Profile = { id: string; full_name: string | null; email: string | null; phone: string | null }

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: INDIA_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: INDIA_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${day}T12:00:00+05:30`))
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{message}</div>
  )
}

export default async function CompetitionStandingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { user, role } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin') redirect('/admin')

  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const back = (
    <Link href="/admin/competitions" className="text-sm text-gray-500 hover:text-brand transition-colors">
      <ArrowLeft size={15} />
    </Link>
  )

  const admin = createAdminClient()
  if (!admin) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorBox message="Server configuration error — missing service role key." />
      </div>
    )
  }

  const { data: competition, error: competitionError } = await admin
    .from('game_competitions')
    .select('id, day, title, prize, code, active')
    .eq('id', id)
    .maybeSingle()

  if (competitionError) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorBox message="Could not load this competition. Please try again." />
      </div>
    )
  }
  if (!competition) notFound()

  // Read every round in pages (PostgREST caps a single response).
  const scores: { userId: string; score: number; playedAt: string }[] = []
  let loadError: string | null = null
  for (let from = 0; from < MAX_SCORE_ROWS; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from('game_scores')
      .select('user_id, score, played_at')
      .eq('competition_id', id)
      .order('played_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      loadError = 'Could not load the scores. Please try again.'
      break
    }
    for (const row of data ?? []) {
      scores.push({ userId: row.user_id as string, score: row.score as number, playedAt: row.played_at as string })
    }
    if (!data || data.length < PAGE_SIZE) break
  }

  const { data: exclusionRows, error: exclusionError } = await admin
    .from('game_competition_exclusions')
    .select('user_id')
    .eq('competition_id', id)
  if (exclusionError) loadError = loadError ?? 'Could not load the disqualifications. Please try again.'
  const excluded = new Set((exclusionRows ?? []).map(r => r.user_id as string))

  const standings = rankStandings(scores, excluded)

  const profiles = new Map<string, Profile>()
  const userIds = standings.map(s => s.userId)
  for (let i = 0; i < userIds.length; i += PROFILE_CHUNK) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, full_name, email, phone')
      .in('id', userIds.slice(i, i + PROFILE_CHUNK))
    if (error) {
      loadError = loadError ?? 'Could not load player details. Please try again.'
      break
    }
    for (const p of (data ?? []) as Profile[]) profiles.set(p.id, p)
  }

  let counted = 0
  const ranks = standings.map(s => (s.excluded ? null : ++counted))

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        {back}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy size={22} className="text-brand" />
            {competition.title}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {formatDay(competition.day as string)} · Prize: {competition.prize} · Code{' '}
            <span className="font-mono font-bold text-gray-700">{competition.code}</span> ·{' '}
            {competition.active ? 'On' : 'Off'}
          </p>
        </div>
      </div>

      {loadError && (
        <div className="mb-6">
          <ErrorBox message={loadError} />
        </div>
      )}

      {standings.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          No rounds played yet.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-right">Best</th>
                <th className="px-4 py-3 text-right">Rounds</th>
                <th className="px-4 py-3">Best scored at</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {standings.map((s, index) => {
                const profile = profiles.get(s.userId)
                const name = profile?.full_name?.trim() || 'Unnamed player'
                return (
                  <tr
                    key={s.userId}
                    className={`border-b border-gray-50 last:border-0 ${s.excluded ? 'bg-gray-50 text-gray-400' : ''}`}
                  >
                    <td className="px-4 py-3 font-bold">{ranks[index] ?? 'DQ'}</td>
                    <td className="px-4 py-3">{name}</td>
                    <td className="px-4 py-3">{profile?.email ?? '—'}</td>
                    <td className="px-4 py-3">{profile?.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{s.best}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.rounds}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{timeFormatter.format(new Date(s.reachedAt))}</td>
                    <td className="px-4 py-3 text-right">
                      <ExcludeButton
                        competitionId={id}
                        userId={s.userId}
                        excluded={s.excluded}
                        name={name}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
