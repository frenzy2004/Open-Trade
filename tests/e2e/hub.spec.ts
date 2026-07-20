import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/Open-Trade/#/')
})

test('navigates through a lazy hash route and restores hub focus', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Play FanStocks' }).click()
  await expect(page).toHaveURL(/#\/fanstocks$/)
  await expect(
    page.getByRole('heading', { name: 'FanStocks', level: 1 }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Back to all games' }).click()
  await expect(
    page.getByRole('heading', { name: 'Choose your market', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
})

test('persists shared sound and reduced-motion settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('checkbox', { name: 'Sound' }).uncheck()
  await page.getByRole('checkbox', { name: 'Reduce motion' }).check()
  await page.getByRole('button', { name: 'Close Settings' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()

  await expect(page.getByRole('checkbox', { name: 'Sound' })).not.toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: 'Reduce motion' }),
  ).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute(
    'data-reduced-motion',
    'true',
  )
})

test('resets one game save and leaves another untouched', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('open-trade:game:fanstocks', 'remove')
    localStorage.setItem('open-trade:game:founder-mode', 'keep')
  })

  await page
    .getByRole('button', { name: 'Reset FanStocks progress' })
    .click()
  await page
    .getByRole('button', { name: 'Confirm reset FanStocks' })
    .click()

  await expect(page.getByText('FanStocks progress reset')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('open-trade:game:fanstocks'),
      ),
    )
    .toBeNull()
  expect(
    await page.evaluate(() =>
      localStorage.getItem('open-trade:game:founder-mode'),
    ),
  ).toBe('keep')
})

test('has no horizontal overflow and preserves 44px controls', async ({
  page,
}) => {
  const viewports = [
    { width: 320, height: 720 },
    { width: 375, height: 720 },
    { width: 768, height: 900 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/Open-Trade/#/')

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    const undersizedControls = await page
      .locator('button:visible, a.ui-button:visible')
      .evaluateAll((elements) =>
        elements
          .map((element) => ({
            height: element.getBoundingClientRect().height,
            name: element.getAttribute('aria-label') ?? element.textContent,
          }))
          .filter(({ height }) => height < 44),
      )
    expect(undersizedControls, `viewport ${viewport.width}px`).toEqual([])
  }
})

test('supports keyboard-only access to settings and how-to content', async ({
  page,
}) => {
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()

  await page
    .getByRole('button', { name: 'How Founder Mode works' })
    .focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('dialog', { name: 'How Founder Mode works' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'How Founder Mode works' }),
  ).toBeFocused()
})
