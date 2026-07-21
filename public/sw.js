/* global caches, self */

const CACHE_PREFIX = 'open-trade-shell-'
const CACHE_VERSION = '__OPEN_TRADE_CACHE_VERSION__'
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`
const scopeRoot = new URL('./', self.registration.scope).href
const INJECTED_PRECACHE_PATHS = /* __OPEN_TRADE_PRECACHE__ */ []
const PRECACHE_URLS = [
  '',
  'manifest.webmanifest',
  'icons/open-trade-192.png',
  'icons/open-trade-512.png',
  ...INJECTED_PRECACHE_PATHS,
].map((path) => new URL(path, scopeRoot).href)

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS)),
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
      )),
  )
})

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.status === 200) {
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
    || /\.(?:css|js|mjs|woff2?|png|webp|svg|ico|ogg|webmanifest)(?:$|\?)/i
      .test(url.pathname)
}

function parseByteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value.trim())
  if (match === null || size <= 0) return null
  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return null

  if (rawStart === '') {
    const suffixLength = Number(rawEnd)
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null
    return {
      start: Math.max(0, size - suffixLength),
      end: size - 1,
    }
  }

  const start = Number(rawStart)
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return null
  if (rawEnd === '') return { start, end: size - 1 }

  const requestedEnd = Number(rawEnd)
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return null
  return { start, end: Math.min(requestedEnd, size - 1) }
}

async function matchCachedResponse(request) {
  const cached = await caches.match(request, { ignoreVary: true })
  if (cached === undefined) return undefined

  const rangeHeader = request.headers.get('range')
  if (rangeHeader === null || cached.status !== 200) return cached

  const body = await cached.arrayBuffer()
  const range = parseByteRange(rangeHeader, body.byteLength)
  const headers = new Headers(cached.headers)
  headers.set('Accept-Ranges', 'bytes')
  if (range === null) {
    headers.set('Content-Range', `bytes */${body.byteLength}`)
    headers.set('Content-Length', '0')
    return new Response(null, { status: 416, headers })
  }

  const partial = body.slice(range.start, range.end + 1)
  headers.set(
    'Content-Range',
    `bytes ${range.start}-${range.end}/${body.byteLength}`,
  )
  headers.set('Content-Length', String(partial.byteLength))
  return new Response(partial, {
    status: 206,
    statusText: 'Partial Content',
    headers,
  })
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
    // CacheStorage rejects partial (206) audio responses. Return those live,
    // then cache the first complete 200 response when the browser requests it.
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }
    return response
  })
  event.waitUntil(refresh.then(() => undefined, () => undefined))
  event.respondWith(
    matchCachedResponse(request)
      .then((cached) => cached ?? refresh),
  )
})
