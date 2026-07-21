import { expect, test, type Page } from '@playwright/test'

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

async function draftFirstCandidate(page: Page, round: number) {
  await expect(
    page.getByRole('heading', { name: `Round ${round} of 3 · Pick 1 stock` }),
  ).toBeVisible()
  await page.locator('.stock-card').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /^Draft [A-Z]{1,5}$/u }).click()
}

async function yieldToPage(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(undefined)
  }))
}

async function currentMarketTick(page: Page): Promise<number> {
  return page.evaluate(() => {
    if (document.querySelector('.results-screen') !== null) return 60
    const points = document
      .querySelector(".portfolio-race polyline[data-participant='player']")
      ?.getAttribute('points')
      ?.trim()
    return points === undefined || points === '' ? -1 : points.split(/\s+/u).length - 1
  })
}

async function advanceMarketToTick(page: Page, target: number) {
  let current = await currentMarketTick(page)
  const attemptLimit = Math.max(1, (target - current) * 4)
  for (let attempt = 0; current < target && attempt < attemptLimit; attempt += 1) {
    await yieldToPage(page)
    await page.clock.runFor(1_250)
    await yieldToPage(page)
    current = await currentMarketTick(page)
  }
  expect(current).toBe(target)
}

test('complete league drafts, trades, closes, persists, and rematches', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  await page.clock.install()
  await page.goto('/Open-Trade/#/fanstocks?seed=e2e-fanstocks&rules=1')
  await page.getByRole('button', { name: 'Start drafting' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  await draftFirstCandidate(page, 1)
  await draftFirstCandidate(page, 2)
  await draftFirstCandidate(page, 3)
  await expect(
    page.getByText('AI opponents are building their portfolios.'),
  ).toBeVisible()
  await page.clock.runFor(650)
  await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Current portfolio standings' }),
  ).toContainText('$50.00')

  await page.getByRole('button', { name: 'Set market speed to 4x' }).click()
  await advanceMarketToTick(page, 10)
  expect(await currentMarketTick(page)).toBe(10)
  await expect(page.getByText('You receive')).toBeVisible()
  await page.getByRole('button', { name: /^Accept: receive /u }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Trade complete:' })).toBeVisible()

  await page.getByRole('button', { name: 'Offer Balanced a trade' }).click()
  await page.getByRole('group', { name: 'You give' }).getByRole('radio').first().check()
  await page.getByRole('group', { name: 'You receive' }).getByRole('radio').first().check()
  await page.getByRole('button', { name: 'Send trade offer' }).click()
  await expect(page.getByText(/Trade (accepted|rejected):/u).last()).toBeVisible()

  await advanceMarketToTick(page, 25)
  await page.getByRole('button', { name: 'Pass on trade' }).press('Enter')
  await advanceMarketToTick(page, 40)
  await page.getByRole('button', { name: 'Pass on trade' }).press('Enter')
  await advanceMarketToTick(page, 60)
  await expect(page.getByText('Friday close', { exact: true })).toBeVisible()
  await expect(page.locator('.results-ranking > li')).toHaveCount(4)

  await page.getByRole('button', { name: 'Rematch same table' }).click()
  await expect(
    page.getByRole('heading', { name: 'Round 1 of 3 · Pick 1 stock' }),
  ).toBeVisible()
  await expect(page).toHaveURL(/seed=rematch-1-[a-z0-9]+&rules=1/u)
  await page.goto('/Open-Trade/#/fanstocks')
  await expect(
    page.getByRole('heading', { name: 'Round 1 of 3 · Pick 1 stock' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Round 1 of 3 · Pick 1 stock' }),
  ).toBeVisible()
  expect(browserErrors).toEqual([])
})
