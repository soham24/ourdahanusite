'use client'

import { useState, useTransition } from 'react'
import { ThumbsUp } from 'lucide-react'
import { toggleRecommendation } from '@/app/actions/listing-interactions'
import { useListingViewer } from './ListingViewerContext'

interface Props {
  listingId: string
  subdomain?: string | null
  initialRecommended: boolean
  initialCount: number
  isLoggedIn: boolean
}

export default function RecommendButton({
  listingId, subdomain, initialRecommended, initialCount, isLoggedIn,
}: Props) {
  const viewer = useListingViewer()
  const [optimisticRecommended, setOptimisticRecommended] = useState<boolean | null>(null)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()
  const signedIn = isLoggedIn || viewer.isLoggedIn
  const isRecommended = hasInteracted
    ? optimisticRecommended ?? false
    : viewer.isRecommended || initialRecommended

  const handle = () => {
    if (!signedIn) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; return }
    setHasInteracted(true)
    startTransition(async () => {
      const res = await toggleRecommendation(listingId, subdomain)
      if (res.error) return
      setOptimisticRecommended(res.isRecommended)
      setCount(c => res.isRecommended ? c + 1 : c - 1)
    })
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
        isRecommended
          ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600'
      } disabled:opacity-50`}
    >
      <ThumbsUp size={14} className={isRecommended ? 'fill-amber-500 text-amber-500' : ''} />
      <span>{count > 0 ? `${count} Recommend${count === 1 ? '' : 's'}` : 'Recommend'}</span>
    </button>
  )
}
