'use client'

import { useEffect } from 'react'

// Mirrors what `HomepageLoaderDismiss` used to do for the homepage overlay
// only — now runs once globally so every OurDahanuLoader instance (rendered
// by any route-level `loading.tsx`) gets the correctly-rendered Marathi
// text "आपले डहाणू" in its SVG logo.
//
// Background: iOS Safari does NOT re-lay-out an SVG <textPath> when a
// webfont swaps in after layout, so the curve positioning breaks forever
// if the text is visible with a fallback font first. We keep the Marathi
// text `display: none` via CSS until this component adds
// `loader-fonts-ready` on <html>. That lets Safari measure the textPath
// using the correct Noto Sans Devanagari glyphs on first layout.
export default function LoaderFontsReady() {
  useEffect(() => {
    if (typeof document === 'undefined') return

    // Already set? no-op (e.g. after client navigation).
    if (document.documentElement.classList.contains('loader-fonts-ready')) return

    let cancelled = false
    const markReady = () => {
      if (cancelled) return
      document.documentElement.classList.add('loader-fonts-ready')
    }

    if ('fonts' in document) {
      document.fonts
        .load('500 6.5px "Noto Sans Devanagari"')
        .then(markReady)
        .catch(markReady) // fail-open so the text isn't invisible forever
      document.fonts.ready.then(markReady).catch(markReady)

      // Safety net: reveal after 2s even if the font never resolves.
      const safetyTimer = window.setTimeout(markReady, 2000)

      return () => {
        cancelled = true
        window.clearTimeout(safetyTimer)
      }
    }

    // Older browsers without the CSS Font Loading API: reveal immediately.
    markReady()
  }, [])

  return null
}
