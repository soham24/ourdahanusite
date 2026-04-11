import { ArrowLeft, BarChart3, Clock } from 'lucide-react'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin-client'
import CreatePollForm from './CreatePollForm'
import DeletePollButton from './DeletePollButton'

interface PollOption {
  id: string
  label: string
}

interface PollRow {
  id: string
  title: string
  options: PollOption[]
  ends_at: string
  created_at: string
  active: boolean
}

function timeLabel(dateStr: string): { text: string; ended: boolean } {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return { text: 'Ended', ended: true }
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(hours / 24)
  if (days > 0) return { text: `${days}d ${hours % 24}h left`, ended: false }
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return { text: `${hours}h ${mins}m left`, ended: false }
  return { text: `${mins}m left`, ended: false }
}

export default async function AdminPollsPage() {
  let polls: PollRow[] = []
  const voteCounts: Record<string, number> = {}

  try {
    const admin = createAdminClient()
    if (admin) {
      const { data } = await admin
        .from('polls')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })

      polls = (data ?? []) as PollRow[]

      if (polls.length > 0) {
        const { data: votes } = await admin
          .from('poll_votes')
          .select('poll_id')
          .in('poll_id', polls.map(p => p.id))

        for (const v of votes ?? []) {
          voteCounts[v.poll_id] = (voteCounts[v.poll_id] ?? 0) + 1
        }
      }
    }
  } catch { /* DB error */ }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-warli-terra transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={22} className="text-warli-terra" />
            Community Polls
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {polls.length} active poll{polls.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* ── Existing Polls ──────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Active Polls</h2>

          {polls.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
              No polls yet. Create one to engage the community.
            </div>
          ) : (
            polls.map(poll => {
              const { text: timeText, ended } = timeLabel(poll.ends_at)
              const votes = voteCounts[poll.id] ?? 0

              return (
                <div
                  key={poll.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900 text-sm mb-1">{poll.title}</h3>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {poll.options.map(opt => (
                        <span
                          key={opt.id}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                        >
                          {opt.label}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <BarChart3 size={11} /> {votes} vote{votes !== 1 ? 's' : ''}
                      </span>
                      <Link
                        href={`/polls/${poll.id}`}
                        className="font-medium text-warli-terra hover:underline"
                      >
                        Standalone page
                      </Link>
                      <span
                        className={`flex items-center gap-1 font-semibold ${
                          ended ? 'text-gray-400' : 'text-amber-600'
                        }`}
                      >
                        <Clock size={11} /> {timeText}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          ended ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {ended ? 'Ended' : 'Active'}
                      </span>
                    </div>
                  </div>

                  <DeletePollButton pollId={poll.id} />
                </div>
              )
            })
          )}
        </div>

        {/* ── Create New Poll ─────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">Create New Poll</h2>
          <CreatePollForm />
        </div>
      </div>
    </div>
  )
}
