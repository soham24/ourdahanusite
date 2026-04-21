'use client'

import { useEffect } from 'react'

// The loader exists to cover the first-paint flash while the streamed
// homepage HTML is still arriving. Once `window.load` fires, the content is
// in the DOM and the overlay can fade away — no artificial floor needed.
// (The 300ms fade itself still gives the transition a smooth feel.)
const MIN_LOADER_DURATION_MS = 0
const FADE_DURATION_MS = 300

export default function HomepageLoaderDismiss() {
  useEffect(() => {
    // Mark the document as "fonts ready" as soon as Noto Sans Devanagari
    // is actually loaded. The curved Marathi text in the loader SVG is
    // hidden via CSS until this class lands — Safari doesn't re-lay-out
    // textPath when a webfont swaps in, so showing a fallback-font
    // render first leaves the curve permanently broken.
    let cancelled = false
    const markFontsReady = () => {
      if (cancelled) return
      document.documentElement.classList.add('loader-fonts-ready')
    }

    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts
        .load('500 6.5px "Noto Sans Devanagari"')
        .then(markFontsReady)
        .catch(markFontsReady) // fail-open so the text isn't invisible forever
      // Safety net: if the font still hasn't loaded after 2s, reveal anyway.
      const safetyTimer = window.setTimeout(markFontsReady, 2000)
      // Also mark ready once document.fonts.ready resolves, whichever first.
      document.fonts.ready.then(markFontsReady).catch(markFontsReady)

      // Track the safety timer so it can be cleared on unmount.
      return () => {
        cancelled = true
        window.clearTimeout(safetyTimer)
      }
    }

    // Older browsers without the CSS Font Loading API: reveal immediately.
    markFontsReady()
  }, [])

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
