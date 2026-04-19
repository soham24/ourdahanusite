const CACHE_PREFIX = 'ourdahanu-'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key))
      )

      await self.registration.unregister()

      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      await Promise.all(clients.map((client) => client.navigate(client.url)))
    })()
  )
})
