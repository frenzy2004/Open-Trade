import { expect, test, type Page } from '@playwright/test'

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true)
}

async function enterMarket(page: Page) {
  await page.getByRole('button', { name: 'Start drafting' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  for (let round = 1; round <= 3; round += 1) {
    await page.locator('.stock-card').first().click()
    await page.getByRole('button', { name: /^Draft /u }).click()
  }
}

async function advanceMarketTicks(page: Page, count: number) {
  for (let tick = 0; tick < count; tick += 1) {
    await page.clock.runFor(1_250)
  }
}

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`FanStocks has no page overflow at ${width}px`, async ({ page }) => {
    const browserErrors = captureBrowserErrors(page)
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 })
    await page.goto(`/Open-Trade/#/fanstocks?seed=responsive-${width}&rules=1`)
    await expect(
      page.getByRole('heading', { name: 'Fantasy Stock Leagues' }),
    ).toBeVisible()
    await expectNoPageOverflow(page)
    expect(browserErrors).toEqual([])
  })
}

test('card detail supports keyboard entry, wrapped navigation, Escape, and focus return', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  await page.goto('/Open-Trade/#/fanstocks?seed=keyboard&rules=1')
  await page.getByRole('button', { name: 'Start drafting' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  const first = page.locator('.stock-card').first()
  await first.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Previous stock' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(first).toBeFocused()
  expect(browserErrors).toEqual([])
})

test.describe('touch table', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

  test('uses a scroll-snap opponent strip and pinned player hand', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page)
    await page.clock.install()
    await page.goto('/Open-Trade/#/fanstocks?seed=touch&rules=1')
    await page.getByRole('button', { name: 'Start drafting' }).tap()
    await page.getByRole('button', { name: 'Got it' }).tap()
    for (let round = 1; round <= 3; round += 1) {
      await page.locator('.stock-card').first().tap()
      await page.getByRole('button', { name: /^Draft /u }).tap()
    }
    await page.clock.runFor(650)
    await expect(page.locator('.opponent-table')).toHaveCSS('scroll-snap-type', 'x mandatory')
    await expect(page.locator('.league-screen__player')).toHaveCSS('position', 'fixed')
    await expectNoPageOverflow(page)
    expect(browserErrors).toEqual([])
  })
})

test('reduced motion keeps trade status but never mounts card flight', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  await page.clock.install()
  await page.goto('/Open-Trade/#/fanstocks?seed=reduced&rules=1')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('checkbox', { name: 'Reduce motion' }).check()
  await page.getByRole('button', { name: 'Close Settings' }).click()
  await enterMarket(page)
  await page.clock.runFor(1)
  await page.getByRole('button', { name: 'Set market speed to 4x' }).click()
  await advanceMarketTicks(page, 10)
  await page.getByRole('button', { name: /^Accept: receive /u }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Trade complete:' })).toBeVisible()
  await expect(page.locator('.trade-flight')).toHaveCount(0)
  expect(browserErrors).toEqual([])
})

test('corrupt FanStocks storage offers isolated reset and hub recovery', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  await page.goto('/Open-Trade/#/')
  await page.evaluate(() => {
    localStorage.setItem('opentrade.fanstocks', '{broken')
    localStorage.setItem('unrelated', 'keep')
  })
  await page.goto('/Open-Trade/#/fanstocks')
  await expect(
    page.getByRole('dialog', { name: 'FanStocks progress could not be loaded' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Reset FanStocks progress' }).click()
  await page.getByRole('button', { name: 'Confirm reset' }).click()
  expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep')
  await expect(
    page.getByRole('heading', { name: 'Fantasy Stock Leagues' }),
  ).toBeVisible()
  expect(browserErrors).toEqual([])
})
