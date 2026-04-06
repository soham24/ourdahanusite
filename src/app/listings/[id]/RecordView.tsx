'use client'

import { useEffect } from 'react'
import { incrementListingView } from '@/app/actions/listings'

export default function RecordView({ listingId }: { listingId: string }) {
  useEffect(() => {
    incrementListingView(listingId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
