import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, ArrowLeft } from 'lucide-react'

import { getAllPolls } from '@/lib/data/polls'
import { createClient } from '@/lib/supabase/server'
import PollCard from '@/components/PollCard'

export const metadata: Metadata = {
  title: 'Community Polls — OurDahanu',
  description: 'Vote on community polls and see what Dahanu thinks.',
}

export default async function PollsPage() {
  const polls = await getAllPolls()

  // Check auth + fetch user votes
  let userId: string | null = null
  const userVotes: Record<string, string> = {}

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null

    if (userId && polls.length > 0) {
      const { data: votes } = await supabase
        .from('poll_votes')
        .select('poll_id, option_id')
        .eq('user_id', userId)
        .in('poll_id', polls.map(p => p.id))

      for (const v of votes ?? []) {
        userVotes[v.poll_id] = v.option_id
      }
    }
  } catch { /* auth error — treat as logged out */ }

  const isLoggedIn = !!userId
  const now = new Date()
  const activePolls = polls.filter(p => new Date(p.ends_at) > now)
  const endedPolls = polls.filter(p => new Date(p.ends_at) <= now)

  return (
    <div className="min-h-screen bg-[#FDFAF6]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-gray-400 hover:text-warli-terra transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-chikoo-bark flex items-center gap-2">
              <BarChart3 size={22} className="text-warli-terra" />
              Community Polls
            </h1>
            <p className="text-sm text-chikoo-brown mt-0.5">
              Vote and see what Dahanu thinks
            </p>
          </div>
        </div>

        {polls.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <BarChart3 size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No polls yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Active polls */}
            {activePolls.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wide text-warli-terra">
                  Active Polls
                </h2>
                {activePolls.map(poll => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    userVote={userVotes[poll.id] ?? null}
                    isLoggedIn={isLoggedIn}
                  />
                ))}
              </div>
            )}

            {/* Ended polls */}
            {endedPolls.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Past Polls
                </h2>
                {endedPolls.map(poll => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    userVote={userVotes[poll.id] ?? null}
                    isLoggedIn={isLoggedIn}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
