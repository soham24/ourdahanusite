'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toggleFavourite } from '@/app/actions/listing-interactions'
import { useListingViewer } from './ListingViewerContext'
import { loginHref, currentPathForLogin } from '@/lib/login-redirect'

interface Props {
  listingId: string
  subdomain?: string | null
  initialFavourited?: boolean
  isLoggedIn?: boolean
}

export default function FavouriteButton({ listingId, subdomain, initialFavourited, isLoggedIn }: Props) {
  const viewer = useListingViewer()
  const router = useRouter()
  const [optimisticFavourited, setOptimisticFavourited] = useState<boolean | null>(null)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const signedIn = isLoggedIn ?? viewer.isLoggedIn
  const isFavourited = hasInteracted
    ? optimisticFavourited ?? false
    : viewer.isFavourited || initialFavourited === true

  const handle = () => {
    if (!signedIn) {
      router.push(loginHref(currentPathForLogin(window.location)))
      return
    }
    setError('')
    setHasInteracted(true)
    startTransition(async () => {
      const res = await toggleFavourite(listingId, subdomain)
      if (res.error) { setError(res.error); return }
      setOptimisticFavourited(res.isFavourited)
    })
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handle}
        disabled={isPending}
        title={isFavourited ? 'Remove from favourites' : 'Save to favourites'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
          isFavourited
            ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500'
        } disabled:opacity-50`}
      >
        <Heart size={14} className={isFavourited ? 'fill-red-500 text-red-500' : ''} />
        {isFavourited ? 'Saved' : 'Save'}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
