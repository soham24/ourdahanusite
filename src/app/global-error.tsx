'use client'

import { useEffect } from 'react'

// global-error replaces the root layout (including <html>/<body>) when an
// error is thrown in the layout itself, so globals.css/theme vars are NOT
// available here — styles are inlined to stay self-contained.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app/global-error]', error.message, error.digest)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAFAF7',
          color: '#1C0D05',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#7B6658', margin: '0 0 1.5rem' }}>
            The site hit an unexpected error. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#C0582E',
              color: '#fff',
              fontWeight: 600,
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
