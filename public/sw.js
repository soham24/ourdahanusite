const CACHE_NAME = 'ourdahanu-v2'
const PRECACHE_URLS = ['/offline.html']
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest'])

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

function shouldCacheAsset(request, url) {
  if (request.method !== 'GET') return false
  if (url.origin !== self.location.origin) return false
  return STATIC_DESTINATIONS.has(request.destination)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    return
  }

  if (!shouldCacheAsset(request, url)) {
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }

        return response
      })
    })
  )
})
