import type { PollWithResults } from '@/lib/data/polls'
import { createClient } from '@/lib/supabase/server'

import PollCard from '@/components/PollCard'

export function HomepagePollCardFallback() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-warm overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-24 rounded skeleton-shimmer" />
          <div className="h-5 w-3/4 rounded skeleton-shimmer" />
        </div>
        <div className="h-6 w-24 rounded-full skeleton-shimmer" />
      </div>
      <div className="px-6 pb-2 space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-12 rounded-xl skeleton-shimmer" />
        ))}
      </div>
      <div className="px-6 py-3 border-t border-gray-50">
        <div className="h-3 w-20 rounded skeleton-shimmer" />
      </div>
    </div>
  )
}

export default async function HomepagePollCard({ poll }: { poll: PollWithResults }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userVote: string | null = null
  if (user) {
    const { data: vote } = await supabase
      .from('poll_votes')
      .select('option_id')
      .eq('poll_id', poll.id)
      .eq('user_id', user.id)
      .maybeSingle()

    userVote = vote?.option_id ?? null
  }

  return (
    <PollCard
      poll={poll}
      userVote={userVote}
      isLoggedIn={!!user}
      loginNextPath="/"
    />
  )
}
