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

async function holdingLayoutViolations(
  page: Page,
  visibleOpponentIndex: number,
): Promise<string[]> {
  return page.evaluate((visibleIndex) => {
    const tolerance = 1
    const viewport = { left: 0, right: document.documentElement.clientWidth }
    const violations: string[] = []
    const owners = document.querySelectorAll<HTMLElement>(
      '.opponent-seat, .league-screen__player',
    )

    const opponentSeats = Array.from(document.querySelectorAll('.opponent-seat'))
    for (let leftIndex = 0; leftIndex < opponentSeats.length; leftIndex += 1) {
      const left = opponentSeats[leftIndex]?.getBoundingClientRect()
      if (left === undefined) continue
      for (let rightIndex = leftIndex + 1; rightIndex < opponentSeats.length; rightIndex += 1) {
        const right = opponentSeats[rightIndex]?.getBoundingClientRect()
        if (right === undefined) continue
        const overlaps = left.left < right.right - tolerance
          && left.right > right.left + tolerance
          && left.top < right.bottom - tolerance
          && left.bottom > right.top + tolerance
        if (overlaps) {
          violations.push(`opponent seats ${leftIndex + 1} and ${rightIndex + 1} overlap`)
        }
      }
    }
    for (const owner of owners) {
      const ownerRect = owner.getBoundingClientRect()
      const cards = Array.from(owner.querySelectorAll<HTMLElement>('.portfolio-hand li'))
      const ownerName = owner.getAttribute('aria-label')
        ?? owner.querySelector('h2, h3')?.textContent
        ?? owner.className

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect()
        if (
          rect.left < ownerRect.left - tolerance
          || rect.right > ownerRect.right + tolerance
        ) {
          violations.push(`${ownerName} card ${index + 1} escapes its container`)
        }
        const shouldBeInViewport = owner.matches('.league-screen__player')
          || owner === opponentSeats[visibleIndex]
        if (
          shouldBeInViewport
          && (rect.left < viewport.left - tolerance || rect.right > viewport.right + tolerance)
        ) {
          violations.push(`${ownerName} card ${index + 1} escapes the viewport`)
        }
        const previous = cards[index - 1]?.getBoundingClientRect()
        if (previous !== undefined && rect.left < previous.right - tolerance) {
          violations.push(`${ownerName} cards ${index} and ${index + 1} overlap`)
        }
      })
    }

    const playerRect = document.querySelector<HTMLElement>('.league-screen__player')
      ?.getBoundingClientRect()
    if (
      playerRect !== undefined
      && (playerRect.left < viewport.left - tolerance || playerRect.right > viewport.right + tolerance)
    ) {
      violations.push('player portfolio escapes the viewport')
    }
    return violations
  }, visibleOpponentIndex)
}

async function enterMarket(page: Page) {
  await page.getByRole('button', { name: 'Start drafting' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  for (let round = 1; round <= 3; round += 1) {
    await page.locator('.stock-card').first().click()
    await page.getByRole('button', { name: /^Draft /u }).click()
  }
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

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`FanStocks has no page overflow at ${width}px`, async ({ page }) => {
    const browserErrors = captureBrowserErrors(page)
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 })
    await page.clock.install()
    await page.goto(`/Open-Trade/#/fanstocks?seed=responsive-${width}&rules=1`)
    await enterMarket(page)
    await page.clock.runFor(650)
    await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible()

    const seats = await page.locator('.opponent-seat').all()
    for (let seatIndex = 0; seatIndex < seats.length; seatIndex += 1) {
      const seat = seats[seatIndex]
      if (seat === undefined) continue
      await seat.scrollIntoViewIfNeeded()
      expect(await holdingLayoutViolations(page, seatIndex)).toEqual([])
    }
    await expectNoPageOverflow(page)
    expect(browserErrors).toEqual([])
  })
}

test('desktop deck stays clear and every opponent trade opens', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  await page.setViewportSize({ width: 1265, height: 720 })
  await page.clock.install()
  await page.goto('/Open-Trade/#/fanstocks?seed=trade-hit-targets&rules=1')
  await enterMarket(page)
  await page.clock.runFor(650)
  await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible()
  await page.getByRole('button', { name: 'Pause market' }).click()

  const overlaps = await page.evaluate(() => {
    const deck = document.querySelector('.league-screen__deck')
      ?.getBoundingClientRect()
    if (deck === undefined) return ['deck missing']
    return Array.from(document.querySelectorAll<HTMLElement>('.opponent-seat > button'))
      .flatMap((button) => {
        const rect = button.getBoundingClientRect()
        const overlapsDeck = rect.left < deck.right
          && rect.right > deck.left
          && rect.top < deck.bottom
          && rect.bottom > deck.top
        return overlapsDeck ? [button.getAttribute('aria-label') ?? 'trade button'] : []
      })
  })
  expect(overlaps).toEqual([])

  for (const opponent of ['Momentum', 'Contrarian', 'Balanced']) {
    await page.getByRole('button', { name: `Offer ${opponent} a trade` }).click()
    await expect(
      page.getByRole('dialog', { name: `Offer ${opponent} a trade` }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
  }
  expect(browserErrors).toEqual([])
})

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

  await first.click()
  await page.getByRole('button', { name: /^Draft /u }).click()
  await expect(
    page.getByRole('heading', { name: 'Round 2 of 3 · Pick 1 stock' }),
  ).toBeFocused()
  expect(browserErrors).toEqual([])
})

test('incoming trade Escape and pass restore focus to the market control', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  await page.clock.install()
  await page.goto('/Open-Trade/#/fanstocks?seed=focus-trades&rules=1')
  await enterMarket(page)
  await page.clock.runFor(650)

  const speed = page.getByRole('button', { name: 'Set market speed to 4x' })
  await speed.click()
  await speed.focus()
  await advanceMarketToTick(page, 10)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(speed).toBeFocused()

  await advanceMarketToTick(page, 25)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Pass on trade' }).click()
  await expect(speed).toBeFocused()
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
  await advanceMarketToTick(page, 10)
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
