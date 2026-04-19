'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) => registration.unregister())
        )
      )
      .catch((err) => {
        console.warn('Service worker cleanup failed:', err)
      })

    if ('caches' in window) {
      void caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith('ourdahanu-'))
              .map((key) => caches.delete(key))
          )
        )
        .catch((err) => {
          console.warn('Service worker cache cleanup failed:', err)
        })
    }
  }, [])

  return null
}
