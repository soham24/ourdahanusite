'use client'

import { useEffect, useState } from 'react'

import OurDahanuLoader from '@/components/OurDahanuLoader'

const MIN_LOADER_DURATION_MS = 1200
const FADE_DURATION_MS = 300

export default function InitialLoaderOverlay() {
  const [isVisible, setIsVisible] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    const startedAt = Date.now()
    let fadeTimer: number | undefined
    let hideTimer: number | undefined

    const dismiss = () => {
      const elapsed = Date.now() - startedAt
      const delay = Math.max(0, MIN_LOADER_DURATION_MS - elapsed)

      fadeTimer = window.setTimeout(() => {
        setIsFadingOut(true)
      }, delay)

      hideTimer = window.setTimeout(() => {
        setIsVisible(false)
      }, delay + FADE_DURATION_MS)
    }

    if (document.readyState === 'complete') {
      dismiss()
    } else {
      window.addEventListener('load', dismiss, { once: true })
    }

    return () => {
      window.removeEventListener('load', dismiss)
      if (fadeTimer) {
        window.clearTimeout(fadeTimer)
      }
      if (hideTimer) {
        window.clearTimeout(hideTimer)
      }
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
