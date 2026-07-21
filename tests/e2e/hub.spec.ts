import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const GAMES = [
  { path: 'fanstocks', title: 'FanStocks' },
  { path: 'founder-mode', title: 'Founder Mode' },
  { path: 'wallstreet-surfers', title: 'Wallstreet Surfers' },
] as const

const INTERACTIVE_TARGETS = [
  'a[href]:visible',
  'button:visible',
  'input:visible',
  'select:visible',
  'textarea:visible',
  '[role="button"]:visible',
  '[tabindex]:not([tabindex="-1"]):visible',
].join(', ')

async function expectKeyboardFocus(locator: Locator) {
  await expect(locator).toBeFocused()
  await expect(locator).toHaveCSS('outline-style', 'solid')
  await expect(locator).toHaveCSS('outline-width', '3px')
}

async function expectAccessibleViewport(
  page: Page,
  viewportWidth: number,
  state: string,
) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow, `${state} at ${viewportWidth}px`).toBeLessThanOrEqual(0)

  const undersizedTargets = await page
    .locator(INTERACTIVE_TARGETS)
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const target =
            element instanceof HTMLInputElement
              ? element.closest('label') ?? element
              : element
          const bounds = target.getBoundingClientRect()
          return {
            height: bounds.height,
            name: element.getAttribute('aria-label') ?? element.textContent,
            tag:
              target === element
                ? element.tagName.toLowerCase()
                : 'label>' + element.tagName.toLowerCase(),
            width: bounds.width,
          }
        })
        .filter(({ height, width }) => height < 44 || width < 44),
    )
  expect(undersizedTargets, `${state} at ${viewportWidth}px`).toEqual([])
}

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

for (const game of GAMES) {
  test(`loads the lazy ${game.title} production route`, async ({ page }) => {
    await page.getByRole('link', { name: `Play ${game.title}` }).click()
    await expect(page).toHaveURL(new RegExp(`#/${game.path}$`))
    await expect(
      page.getByRole('heading', { name: game.title, level: 1 }),
    ).toBeVisible()
  })
}

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

test('has no horizontal overflow and preserves 44px targets', async ({
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
    await expectAccessibleViewport(page, viewport.width, 'hub')

    await page.getByRole('button', { name: 'Settings' }).click()
    await expectAccessibleViewport(page, viewport.width, 'settings dialog')
    await page.getByRole('button', { name: 'Close Settings' }).click()

    await page.getByRole('link', { name: 'Play FanStocks' }).click()
    await expectAccessibleViewport(page, viewport.width, 'lazy game route')
    await page.getByRole('link', { name: 'Back to all games' }).click()

    await page
      .getByRole('button', { name: 'Reset Founder Mode progress' })
      .click()
    await expectAccessibleViewport(page, viewport.width, 'reset dialog')
    await page.getByRole('button', { name: 'Keep progress' }).click()
  }
})

test('supports keyboard-only access to settings and how-to content', async ({
  page,
}) => {
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()

  await page.keyboard.press('Shift+Tab')
  const settingsTrigger = page.getByRole('button', { name: 'Settings' })
  await expectKeyboardFocus(settingsTrigger)
  await page.keyboard.press('Enter')
  const settingsDialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(settingsDialog).toBeVisible()
  const closeSettings = page.getByRole('button', { name: 'Close Settings' })
  await expectKeyboardFocus(closeSettings)
  await expect(settingsDialog.locator(':focus')).toHaveCount(1)

  const soundCheckbox = page.getByRole('checkbox', { name: 'Sound' })
  const motionCheckbox = page.getByRole('checkbox', {
    name: 'Reduce motion',
  })
  await page.keyboard.press('Tab')
  await expectKeyboardFocus(soundCheckbox)
  await expect(settingsDialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Tab')
  await expectKeyboardFocus(motionCheckbox)
  await expect(settingsDialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Shift+Tab')
  await expectKeyboardFocus(soundCheckbox)
  await expect(settingsDialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Shift+Tab')
  await expectKeyboardFocus(closeSettings)
  await expect(settingsDialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Shift+Tab')
  await expectKeyboardFocus(motionCheckbox)
  await expect(settingsDialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(settingsDialog).not.toBeVisible()
  await expectKeyboardFocus(settingsTrigger)

  const tabOrder = [
    page.getByRole('link', { name: 'Play FanStocks' }),
    page.getByRole('button', { name: 'How FanStocks works' }),
    page.getByRole('button', { name: 'Reset FanStocks progress' }),
    page.getByRole('link', { name: 'Play Founder Mode' }),
  ]
  for (const target of tabOrder) {
    await page.keyboard.press('Tab')
    await expectKeyboardFocus(target)
  }

  await page.keyboard.press('Tab')
  const howToTrigger = page.getByRole('button', {
    name: 'How Founder Mode works',
  })
  await expectKeyboardFocus(howToTrigger)
  await page.keyboard.press('Space')
  const howToDialog = page.getByRole('dialog', {
    name: 'How Founder Mode works',
  })
  await expect(
    howToDialog,
  ).toBeVisible()
  await expectKeyboardFocus(
    page.getByRole('button', { name: 'Close How Founder Mode works' }),
  )
  await expect(howToDialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(howToDialog).not.toBeVisible()
  await expectKeyboardFocus(howToTrigger)
})
