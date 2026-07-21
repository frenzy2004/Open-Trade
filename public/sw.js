/* global caches, self */

const CACHE_PREFIX = 'open-trade-shell-'
const CACHE_NAME = `${CACHE_PREFIX}v1`
const scopeRoot = new URL('./', self.registration.scope).href
const PRECACHE_URLS = [
  scopeRoot,
  new URL('manifest.webmanifest', scopeRoot).href,
  new URL('icons/open-trade-192.png', scopeRoot).href,
  new URL('icons/open-trade-512.png', scopeRoot).href,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
      await cache.put(scopeRoot, response.clone())
    }
    return response
  } catch {
    return (await cache.match(request))
      ?? (await cache.match(scopeRoot))
      ?? Response.error()
  }
}

function isLocalMediaRequest(request, url) {
  return [
    'script',
    'style',
    'font',
    'image',
    'audio',
  ].includes(request.destination)
    || /\.(?:css|js|mjs|woff2?|png|webp|svg|ico|ogg)(?:$|\?)/i.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (!isLocalMediaRequest(request, url)) return

  const refresh = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }
    return response
  })
  event.waitUntil(refresh.then(() => undefined, () => undefined))
  event.respondWith(
    caches.match(request).then((cached) => cached ?? refresh),
  )
})
