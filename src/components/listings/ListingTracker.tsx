'use client'

import { useEffect } from 'react'

const VISITOR_KEY_STORAGE = 'ourdahanu:visitor-key/v1'

/**
 * A random per-browser identifier, created once and reused.
 *
 * No PII and no fingerprinting: it exists only so the server can answer
 * "have we already counted this person today". A cleared or blocked
 * localStorage yields a fresh key, which slightly over-counts — the correct
 * direction to err, since the alternative is identifying people.
 */
function getVisitorKey(): string | null {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY_STORAGE)
    if (existing && existing.length >= 8) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(VISITOR_KEY_STORAGE, created)
    return created
  } catch {
    // Private mode or blocked storage: skip tracking rather than inventing a
    // new key on every page load, which would inflate every number.
    return null
  }
}

function send(listingId: string, kind: 'view' | 'phone' | 'whatsapp', visitorKey: string): void {
  const body = JSON.stringify({ kind, visitorKey })
  const url = `/api/listings/${listingId}/track`

  // sendBeacon survives the page being unloaded by a tel:/wa.me navigation,
  // which a plain fetch does not. Falling back to keepalive fetch covers the
  // browsers that lack it.
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      return
    }
  } catch {
    // fall through
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

/**
 * Records a view on mount, and contact taps by delegation.
 *
 * Delegation rather than wrapping each button: it catches every `tel:` and
 * `wa.me` link on the page, including ones added later, without threading a
 * prop through the hero, the sidebar and the services list.
 */
export default function ListingTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    const visitorKey = getVisitorKey()
    if (!visitorKey) return

    send(listingId, 'view', visitorKey)

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return

      const href = anchor.getAttribute('href') ?? ''

      if (href.startsWith('tel:')) {
        send(listingId, 'phone', visitorKey)
        return
      }

      // wa.me/<number> is contacting this business. wa.me/?text=… with no
      // number is the "share this listing" link — a different action, and
      // counting it as an enquiry would overstate the number the owner is
      // being asked to trust.
      if (href.includes('wa.me/')) {
        const path = href.split('wa.me/')[1] ?? ''
        const hasNumber = /^\d/.test(path)
        if (hasNumber) send(listingId, 'whatsapp', visitorKey)
      }
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [listingId])

  return null
}
