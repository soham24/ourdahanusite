import { ArrowLeft, Trophy } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { getUserRole } from '@/app/actions/admin'
import { getIndiaToday, INDIA_TIME_ZONE } from '@/lib/india-time'
import CompetitionForm, { type CompetitionFormValues } from './CompetitionForm'
import CompetitionRowActions from './CompetitionRowActions'

interface CompetitionRow {
  id: string
  day: string
  title: string
  prize: string
  code: string
  active: boolean
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: INDIA_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${day}T12:00:00+05:30`))
}

function CompetitionList({ title, rows }: { title: string; rows: CompetitionRow[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{title}</h2>
      {rows.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          None.
        </div>
      ) : (
        rows.map(c => (
          <div
            key={c.id}
            className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start justify-between gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-500 mb-1">{formatDay(c.day)}</p>
              <h3 className="font-bold text-gray-900 text-sm mb-1">{c.title}</h3>
              <p className="text-sm text-gray-600 mb-2">Prize: {c.prize}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-mono font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                  {c.code}
                </span>
                <Link
                  href={`/admin/competitions?edit=${c.id}`}
                  className="font-medium text-brand hover:underline"
                >
                  Edit
                </Link>
                <Link
                  href={`/admin/competitions/${c.id}`}
                  className="font-medium text-brand hover:underline"
                >
                  Standings
                </Link>
              </div>
            </div>
            <CompetitionRowActions id={c.id} active={c.active} />
          </div>
        ))
      )}
    </section>
  )
}

export default async function AdminCompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const supabase = await createClient()
  const { user, role } = await getUserRole(supabase)
  if (!user) redirect('/login')
  if (role !== 'admin') redirect('/admin')

  const { edit } = await searchParams
  const today = getIndiaToday()

  let competitions: CompetitionRow[] = []
  let loadError: string | null = null

  const admin = createAdminClient()
  if (!admin) {
    loadError = 'Server configuration error — missing service role key.'
  } else {
    const { data, error } = await admin
      .from('game_competitions')
      .select('id, day, title, prize, code, active')
      .order('day', { ascending: false })
    if (error) loadError = 'Could not load competitions. Please try again.'
    competitions = (data ?? []) as CompetitionRow[]
  }

  const todays = competitions.filter(c => c.day === today)
  const upcoming = competitions.filter(c => c.day > today).reverse()
  const past = competitions.filter(c => c.day < today)

  const editing = edit ? competitions.find(c => c.id === edit) : undefined
  const initial: CompetitionFormValues = editing
    ? { ...editing }
    : { day: today, title: '', prize: '', code: '', active: true }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-brand transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy size={22} className="text-brand" />
            Competitions
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            One-day Chikoo Catcher competitions. Today in India is {formatDay(today)}.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {loadError}
        </div>
      )}

      <div className="max-w-3xl space-y-10">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">
            {editing ? 'Edit competition' : 'New competition'}
          </h2>
          {edit && !editing && !loadError && (
            <p className="mb-3 text-sm text-gray-500">That competition was not found. Create a new one instead.</p>
          )}
          <CompetitionForm key={editing?.id ?? 'new'} initial={initial} />
        </div>

        <CompetitionList title="Today" rows={todays} />
        <CompetitionList title="Upcoming" rows={upcoming} />
        <CompetitionList title="Past" rows={past} />
      </div>
    </div>
  )
}
