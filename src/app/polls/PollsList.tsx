'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'

import PollCard from '@/components/PollCard'
import type { PollWithResults } from '@/lib/data/polls'

export default function PollsList({ polls }: { polls: PollWithResults[] }) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const updateNow = () => setNow(Date.now())
    const initialTimer = window.setTimeout(updateNow, 0)
    const intervalTimer = window.setInterval(updateNow, 60_000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(intervalTimer)
    }
  }, [])

  const { activePolls, endedPolls } = useMemo(() => {
    const currentTime = now ?? 0

    return {
      activePolls: polls.filter((poll) => new Date(poll.ends_at).getTime() > currentTime),
      endedPolls: polls.filter((poll) => new Date(poll.ends_at).getTime() <= currentTime),
    }
  }, [now, polls])

  if (polls.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
        <BarChart3 size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">No polls yet. Check back soon!</p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {activePolls.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-brand">
            Active Polls
          </h2>
          {activePolls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              userVote={null}
              isLoggedIn={false}
              loginNextPath="/polls"
            />
          ))}
        </div>
      )}

      {endedPolls.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">
            Past Polls
          </h2>
          {endedPolls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              userVote={null}
              isLoggedIn={false}
              loginNextPath="/polls"
            />
          ))}
        </div>
      )}
    </div>
  )
}
