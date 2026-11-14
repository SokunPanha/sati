/// <reference lib="webworker" />
/**
 * Sati service worker (built by @vite-pwa/nuxt, "buildSW" strategy).
 *  - precaches the app shell so the app opens offline
 *  - serves the SPA entry for every in-app navigation
 *  - runtime-caches Google Fonts (Kantumruy Pro, Inter, Space Grotesk)
 *  - handles taps on system notifications (notificationclick)
 */
import { CacheableResponsePlugin } from '@vite-pwa/workbox-swkit/cacheable-response'
import { clientsClaim } from '@vite-pwa/workbox-swkit/core'
import { ExpirationPlugin } from '@vite-pwa/workbox-swkit/expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from '@vite-pwa/workbox-swkit/precaching'
import { NavigationRoute, registerRoute } from '@vite-pwa/workbox-swkit/routing'
import { CacheFirst, StaleWhileRevalidate } from '@vite-pwa/workbox-swkit/strategies'

declare let self: ServiceWorkerGlobalScope

// autoUpdate: a new version takes over as soon as it is installed.
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Offline app shell: any navigation inside the app gets the precached SPA entry.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/'), { denylist: [/^\/sw\.js$/, /\/[^/?]+\.[^/]+$/] }))

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 })]
  })
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 })
    ]
  })
)

// A tap on a system notification: focus the open app and tell it where to go,
// or open a new window at data.url when the app is closed.
self.addEventListener('notificationclick', (event) => {
  const data = (event.notification.data || {}) as { url?: string, notifId?: string | null }
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/'
  event.notification.close()
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of list) {
      if ('focus' in client) {
        client.postMessage({ type: 'sati-navigate', url, notifId: data.notifId || null })
        return client.focus()
      }
    }
    return self.clients.openWindow(url)
  })())
})
