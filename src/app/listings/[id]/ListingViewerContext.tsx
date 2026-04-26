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

/**
 * Quick client-side check for a Supabase auth cookie. We can skip the
 * /viewer fetch entirely when there's no session — the response would
 * just be DEFAULT_VIEWER anyway, and skipping saves one Vercel function
 * invocation per anonymous detail-page view.
 */
function hasSupabaseSessionCookie(): boolean {
  if (typeof document === 'undefined') return false
  // Supabase SSR cookies are named `sb-<project-ref>-auth-token` (sometimes
  // chunked into `.0`, `.1`). A simple substring check on `sb-` + `auth-token`
  // is enough — false positives are harmless (we just hit the route).
  return /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/.test(document.cookie)
}

export function ListingViewerProvider({
  listingId,
  children,
}: {
  listingId: string
  children: React.ReactNode
}) {
  const [viewer, setViewer] = useState<ListingViewer>(DEFAULT_VIEWER)

  useEffect(() => {
    if (!hasSupabaseSessionCookie()) {
      // Anonymous visit — server would return DEFAULT_VIEWER. Skip the
      // network round-trip and the matching server function invocation.
      return
    }

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
