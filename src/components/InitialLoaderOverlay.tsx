'use client'

import { useEffect, useState } from 'react'

import OurDahanuLoader from '@/components/OurDahanuLoader'

const LOADER_SEEN_KEY = 'ourdahanu:loader-seen'
const LOADER_DURATION_MS = 2200

export default function InitialLoaderOverlay() {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    if (window.sessionStorage.getItem(LOADER_SEEN_KEY) === '1') {
      return false
    }

    window.sessionStorage.setItem(LOADER_SEEN_KEY, '1')
    return true
  })
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    if (!isVisible) {
      return
    }

    const fadeTimer = window.setTimeout(() => {
      setIsFadingOut(true)
    }, LOADER_DURATION_MS - 300)

    const hideTimer = window.setTimeout(() => {
      setIsVisible(false)
    }, LOADER_DURATION_MS)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(hideTimer)
    }
  }, [isVisible])

  if (!isVisible) {
    return null
  }

  return (
    <div
      className={`initial-loader-overlay ${isFadingOut ? 'initial-loader-overlay--hidden' : ''}`}
      aria-hidden="true"
    >
      <OurDahanuLoader fullScreen />
    </div>
  )
}
