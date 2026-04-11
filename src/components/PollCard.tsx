'use client'

import Link from 'next/link'
import { useState, useTransition, useEffect } from 'react'
import { BarChart3, Clock, CheckCircle, Lock } from 'lucide-react'
import { castVote } from '@/app/actions/polls'

interface PollOption {
  id: string
  label: string
}

interface Props {
  poll: {
    id: string
    title: string
    options: PollOption[]
    ends_at: string
    vote_counts: Record<string, number>
    total_votes: number
  }
  userVote: string | null
  isLoggedIn: boolean
  loginNextPath?: string
  pollHref?: string | null
}

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h left`
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${mins}m left`
  return `${mins}m left`
}

export default function PollCard({
  poll,
  userVote,
  isLoggedIn,
  loginNextPath = '/polls',
  pollHref = `/polls/${poll.id}`,
}: Props) {
  const [selected, setSelected] = useState<string | null>(userVote)
  const [hasVoted, setHasVoted] = useState(!!userVote)
  const [voteCounts, setVoteCounts] = useState(poll.vote_counts)
  const [totalVotes, setTotalVotes] = useState(poll.total_votes)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [timeLeftStr, setTimeLeftStr] = useState(() => timeLeft(poll.ends_at))

  const hasEnded = new Date(poll.ends_at) < new Date()
  const showResults = hasVoted || hasEnded

  // Update countdown every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftStr(timeLeft(poll.ends_at))
    }, 60_000)
    return () => clearInterval(timer)
  }, [poll.ends_at])

  const handleVote = (optionId: string) => {
    if (hasEnded) return
    if (!isLoggedIn) {
      window.location.assign(`/login?next=${encodeURIComponent(loginNextPath)}`)
      return
    }

    setError('')
    const prevSelected = selected
    const prevCounts = { ...voteCounts }
    const prevTotal = totalVotes

    // Optimistic update
    const newCounts = { ...voteCounts }
    if (prevSelected && newCounts[prevSelected] !== undefined) {
      newCounts[prevSelected] = Math.max(0, newCounts[prevSelected] - 1)
    }
    newCounts[optionId] = (newCounts[optionId] ?? 0) + 1
    const newTotal = hasVoted ? totalVotes : totalVotes + 1

    setSelected(optionId)
    setHasVoted(true)
    setVoteCounts(newCounts)
    setTotalVotes(newTotal)

    startTransition(async () => {
      const res = await castVote(poll.id, optionId)
      if (res.error) {
        // Rollback
        setSelected(prevSelected)
        setHasVoted(!!prevSelected)
        setVoteCounts(prevCounts)
        setTotalVotes(prevTotal)
        setError(res.error)
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-warm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-warli-light flex items-center justify-center shrink-0">
            <BarChart3 size={16} className="text-warli-terra" />
          </div>
          <h3 className="text-base font-bold text-gray-900 leading-snug">{poll.title}</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
            hasEnded
              ? 'bg-gray-100 text-gray-500'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {hasEnded ? <Lock size={10} /> : <Clock size={10} />}
          {timeLeftStr}
        </span>
      </div>

      {/* Options */}
      <div className="px-6 pb-2 space-y-2">
        {poll.options.map(opt => {
          const count = voteCounts[opt.id] ?? 0
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isSelected = selected === opt.id
          const isWinning =
            showResults && count === Math.max(...Object.values(voteCounts)) && count > 0

          return (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.id)}
              disabled={isPending || hasEnded}
              className={`relative w-full text-left rounded-xl border transition-all overflow-hidden ${
                isSelected
                  ? 'border-warli-terra bg-warli-light/50 ring-1 ring-warli-terra/30'
                  : hasEnded
                    ? 'border-gray-100 bg-gray-50 cursor-default'
                    : 'border-gray-200 hover:border-warli-sand hover:bg-warli-light/30 cursor-pointer'
              } ${isPending ? 'opacity-70' : ''}`}
            >
              {/* Progress bar background */}
              {showResults && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out rounded-xl ${
                    isWinning ? 'bg-warli-terra/15' : 'bg-gray-100/80'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              )}

              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Radio / check indicator */}
                  <div
                    className={`w-4.5 h-4.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      isSelected
                        ? 'border-warli-terra bg-warli-terra'
                        : 'border-gray-300'
                    }`}
                    style={{ width: 18, height: 18 }}
                  >
                    {isSelected && <CheckCircle size={12} className="text-white" />}
                  </div>
                  <span
                    className={`text-sm leading-snug ${
                      isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </span>
                </div>

                {/* Vote count / percentage */}
                {showResults && (
                  <span
                    className={`text-xs font-bold shrink-0 ml-2 ${
                      isWinning ? 'text-warli-terra' : 'text-gray-400'
                    }`}
                  >
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
          </span>
          {pollHref && (
            <Link href={pollHref} className="text-xs text-warli-terra hover:underline">
              Standalone page
            </Link>
          )}
        </div>
        {!isLoggedIn && !hasEnded && (
          <a
            href={`/login?next=${encodeURIComponent(loginNextPath)}`}
            className="text-xs text-warli-terra hover:underline"
          >
            Sign in to vote
          </a>
        )}
        {hasEnded && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Lock size={10} /> Results locked
          </span>
        )}
      </div>

      {error && (
        <div className="px-6 pb-3">
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        </div>
      )}
    </div>
  )
}
