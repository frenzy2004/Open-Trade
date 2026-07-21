import { expect, test } from '@playwright/test'

const BASE_PATH = process.env.PLAYWRIGHT_BASE_PATH ?? '/Open-Trade/'
const ROUTES = [
  { hash: '/', heading: 'Choose your market' },
  { hash: '/fanstocks', heading: 'Fantasy Stock Leagues' },
  { hash: '/founder-mode', heading: 'Founder Mode' },
  { hash: '/wallstreet-surfers', heading: 'Wallstreet Surfers' },
] as const

async function waitForServiceWorkerReady() {
  await navigator.serviceWorker.ready
}

test('replays the cached hub and every game route after the network is removed', async ({
  context,
  page,
}) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const missingResponses: string[] = []
  const failedRequests: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() === 404) missingResponses.push(response.url())
  })
  page.on('requestfailed', (request) => {
    failedRequests.push(
      `${request.resourceType()} ${request.url()} ${request.failure()?.errorText ?? 'unknown failure'}`,
    )
  })

  await page.goto(`${BASE_PATH}#/`)
  await page.evaluate(waitForServiceWorkerReady)
  await page.reload()
  await expect(
    page.getByRole('heading', {
      name: 'Choose your market',
      level: 1,
    }),
  ).toBeVisible()
  await expect.poll(
    () => page.evaluate(() => navigator.serviceWorker.controller !== null),
  ).toBe(true)

  const manifestResponse = await page.request.get(
    `${BASE_PATH}manifest.webmanifest`,
  )
  expect(manifestResponse.status()).toBe(200)
  const manifest = await manifestResponse.json() as { id?: unknown }
  expect(manifest.id).toBeUndefined()
  const serviceWorkerResponse = await page.request.get(`${BASE_PATH}sw.js`)
  expect(serviceWorkerResponse.status()).toBe(200)
  const cachedRuntimeUrls = await page.evaluate(async () => {
    const cacheNames = await caches.keys()
    const requests = await Promise.all(
      cacheNames.map(async (cacheName) => (await caches.open(cacheName)).keys()),
    )
    return requests.flat().map(({ url }) => url)
  })
  expect(cachedRuntimeUrls.some((url) => /\/assets\/route-.*\.css$/u.test(url)))
    .toBe(true)
  expect(cachedRuntimeUrls.filter((url) => /\/assets\/.*\.js$/u.test(url)).length)
    .toBeGreaterThanOrEqual(6)
  const cachedAudioUrl = cachedRuntimeUrls.find((url) => url.endsWith('.ogg'))
  expect(cachedAudioUrl).toBeDefined()

  await context.setOffline(true)
  const offlineManifestStatus = await page.evaluate(async () => {
    try {
      return (await fetch('./manifest.webmanifest')).status
    } catch {
      return 0
    }
  })
  expect(offlineManifestStatus).toBe(200)
  const audioRange = await page.evaluate(async (url) => {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-99' },
    })
    return {
      acceptRanges: response.headers.get('Accept-Ranges'),
      bodyLength: (await response.arrayBuffer()).byteLength,
      contentRange: response.headers.get('Content-Range'),
      status: response.status,
    }
  }, cachedAudioUrl as string)
  expect(audioRange).toEqual({
    acceptRanges: 'bytes',
    bodyLength: 100,
    contentRange: expect.stringMatching(/^bytes 0-99\/\d+$/u),
    status: 206,
  })

  for (const route of ROUTES) {
    await page.goto(
      `${BASE_PATH}?offline-route=${encodeURIComponent(route.hash)}#${route.hash}`,
      {
        waitUntil: 'domcontentloaded',
      },
    )
    const expectedHeading = page.getByRole('heading', {
      name: route.heading,
      level: 1,
    })
    const routeError = page.getByRole('heading', {
      name: 'This game hit a snag',
      level: 1,
    })
    await expect.poll(async () => {
      if (await expectedHeading.isVisible()) return 'ready'
      if (await routeError.isVisible()) {
        return [
          'route-error',
          ...pageErrors,
          ...consoleErrors,
          ...missingResponses,
          ...failedRequests,
        ].join('\n')
      }
      return 'loading'
    }).toBe('ready')
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
  }

  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Close Settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).not.toBeVisible()

  expect(pageErrors).toEqual([])
  expect(consoleErrors, failedRequests.join('\n')).toEqual([])
  expect(missingResponses).toEqual([])
})
