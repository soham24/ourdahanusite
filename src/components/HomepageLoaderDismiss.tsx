'use client'

import { useEffect } from 'react'

const MIN_LOADER_DURATION_MS = 2800
const FADE_DURATION_MS = 300

export default function HomepageLoaderDismiss() {
  useEffect(() => {
    const startedAt = Date.now()
    let fadeTimer: number | undefined
    let removeTimer: number | undefined

    const dismiss = () => {
      const overlay = document.getElementById('homepage-loader-overlay')
      if (!overlay) return

      const delay = Math.max(0, MIN_LOADER_DURATION_MS - (Date.now() - startedAt))

      fadeTimer = window.setTimeout(() => {
        overlay.classList.add('initial-loader-overlay--hidden')
      }, delay)

      removeTimer = window.setTimeout(() => {
        overlay.remove()
      }, delay + FADE_DURATION_MS)
    }

    if (document.readyState === 'complete') {
      dismiss()
    } else {
      window.addEventListener('load', dismiss, { once: true })
    }

    return () => {
      window.removeEventListener('load', dismiss)
      if (fadeTimer) window.clearTimeout(fadeTimer)
      if (removeTimer) window.clearTimeout(removeTimer)
    }
  }, [])

  return null
}
