import { expect, test } from '@playwright/test'

const ROUTES = [
  { hash: '/', heading: 'Choose your market' },
  { hash: '/fanstocks', heading: 'Fantasy Stock Leagues' },
  { hash: '/founder-mode', heading: 'Founder Mode' },
  { hash: '/wallstreet-surfers', heading: 'Wallstreet Surfers' },
] as const

async function waitForServiceWorkerControl() {
  await navigator.serviceWorker.ready
  if (navigator.serviceWorker.controller !== null) return
  await new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
      once: true,
    })
  })
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

  await page.goto('/Open-Trade/#/')
  await page.evaluate(waitForServiceWorkerControl)

  for (const route of ROUTES) {
    await page.goto(`/Open-Trade/#${route.hash}`)
    await expect(
      page.getByRole('heading', { name: route.heading, level: 1 }),
    ).toBeVisible()
  }

  const manifestResponse = await page.request.get('/Open-Trade/manifest.webmanifest')
  expect(manifestResponse.status()).toBe(200)
  const serviceWorkerResponse = await page.request.get('/Open-Trade/sw.js')
  expect(serviceWorkerResponse.status()).toBe(200)

  await context.setOffline(true)
  for (const route of ROUTES) {
    await page.goto(`/Open-Trade/#${route.hash}`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(
      page.getByRole('heading', { name: route.heading, level: 1 }),
    ).toBeVisible()
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
