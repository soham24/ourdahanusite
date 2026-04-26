'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ListingViewer = {
  isLoggedIn: boolean
  isOwner: boolean
  userId: string | null
  email: string
  name: string
  phone: string
  isFavourited: boolean
  isRecommended: boolean
}

const DEFAULT_VIEWER: ListingViewer = {
  isLoggedIn: false,
  isOwner: false,
  userId: null,
  email: '',
  name: '',
  phone: '',
  isFavourited: false,
  isRecommended: false,
}

const ListingViewerContext = createContext<ListingViewer>(DEFAULT_VIEWER)

export function ListingViewerProvider({
  listingId,
  children,
}: {
  listingId: string
  children: React.ReactNode
}) {
  const [viewer, setViewer] = useState<ListingViewer>(DEFAULT_VIEWER)

  useEffect(() => {
    let active = true

    async function loadViewer() {
      try {
        const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}/viewer`, {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        if (!active || !response.ok) return

        const data = (await response.json()) as Partial<ListingViewer>
        setViewer({
          ...DEFAULT_VIEWER,
          ...data,
          isLoggedIn: data.isLoggedIn === true,
          isOwner: data.isOwner === true,
          isFavourited: data.isFavourited === true,
          isRecommended: data.isRecommended === true,
        })
      } catch {
        if (active) setViewer(DEFAULT_VIEWER)
      }
    }

    void loadViewer()
    return () => {
      active = false
    }
  }, [listingId])

  const value = useMemo(() => viewer, [viewer])
  return (
    <ListingViewerContext.Provider value={value}>
      {children}
    </ListingViewerContext.Provider>
  )
}

export function useListingViewer() {
  return useContext(ListingViewerContext)
}
