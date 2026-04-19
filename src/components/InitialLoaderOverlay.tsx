'use client'

import { useEffect, useState } from 'react'

import OurDahanuLoader from '@/components/OurDahanuLoader'

const LOADER_DURATION_MS = 2200

export default function InitialLoaderOverlay() {
  const [isVisible, setIsVisible] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
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
  }, [])

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
