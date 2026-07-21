import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  FOUNDER_SAVE_KEY,
  NETFLIX_BRAINROT_PATH,
} from './fixtures/founder-mode'

const browserErrorsByPage = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrorsByPage.set(page, errors)
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
})

test.afterEach(async ({ page }) => {
  expect(browserErrorsByPage.get(page) ?? []).toEqual([])
})

const INTERACTIVE_TARGETS = [
  'a[href]:visible',
  'button:visible',
  'select:visible',
  'textarea:visible',
  'label:has(input[type="radio"]):visible',
  '[role="button"]:visible',
  '[tabindex]:not([tabindex="-1"]):visible',
].join(', ')

async function openFreshFounderMode(page: Page) {
  await page.goto('/Open-Trade/#/founder-mode')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Founder Mode', level: 1 }),
  ).toBeVisible()
}

async function expectAccessibleViewport(page: Page, state: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow, `${state} has horizontal overflow`).toBeLessThanOrEqual(0)

  const undersizedTargets = await page
    .locator(INTERACTIVE_TARGETS)
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const bounds = element.getBoundingClientRect()
          return {
            height: bounds.height,
            name: element.getAttribute('aria-label') ?? element.textContent,
            width: bounds.width,
          }
        })
        .filter(({ height, width }) => height < 44 || width < 44),
    )
  expect(undersizedTargets, `${state} has undersized controls`).toEqual([])
}

async function expectRadioSelected(locator: Locator) {
  if ((await locator.getAttribute('role')) === 'radio') {
    await expect(locator).toHaveAttribute('aria-checked', 'true')
  } else {
    await expect(locator).toBeChecked()
  }
}

async function expectDecisionFitsDesktopViewport(page: Page, state: string) {
  const result = await page.locator('.founder-choice-card').evaluateAll(
    (cards) => ({
      count: cards.length,
      outside: cards
        .map((card) => {
          const bounds = card.getBoundingClientRect()
          return {
            bottom: bounds.bottom,
            label: card.textContent,
            top: bounds.top,
          }
        })
        .filter(({ bottom, top }) => top < 0 || bottom > window.innerHeight),
    }),
  )
  expect(result.count, `${state} choice count`).toBe(3)
  expect(result.outside, `${state} choices outside viewport`).toEqual([])
}

test('plays, persists, replays, and archives the complete Netflix episode', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000)
  await page.setViewportSize(
    testInfo.project.name === 'chromium-touch'
      ? { width: 375, height: 812 }
      : { width: 1280, height: 720 },
  )
  await openFreshFounderMode(page)

  await page.getByRole('button', { name: 'Play episode' }).click()
  await expect(
    page.getByText(/Streaming is accelerating, DVDs still finance/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Exit episode' }).click()

  const classic = page.getByRole('radio', { name: 'Classic' })
  const brainrot = page.getByRole('radio', { name: 'Brainrot' })
  await classic.focus()
  await page.keyboard.press('ArrowRight')
  await expectRadioSelected(brainrot)
  await expect(brainrot).toHaveJSProperty('tagName', 'INPUT')
  await expectAccessibleViewport(page, 'landing')

  await page.getByRole('button', { name: 'Play episode' }).click()
  await expect(page.getByText(/Streaming is speed-running the future/)).toBeVisible()
  await page.getByRole('button', { name: 'Take the chair' }).click()

  for (const step of NETFLIX_BRAINROT_PATH) {
    await expect(
      page.getByText(`Decision ${step.decision} of 5`),
    ).toBeVisible()
    await expect(
      page.locator('.founder-dilemma').getByText(step.promptExcerpt, {
        exact: false,
      }),
    ).toBeVisible()
    await expectAccessibleViewport(page, `decision ${step.decision}`)
    if (testInfo.project.name === 'chromium-desktop') {
      await expectDecisionFitsDesktopViewport(
        page,
        `decision ${step.decision}`,
      )
    }
    await page.getByRole('button', { name: step.choice }).click()
    await expect(
      page.getByText(`Matched history: ${step.matchedHistory}`),
    ).toBeVisible()
    await expect(page.getByText(`Outcome: ${step.outcome}`)).toBeVisible()
    await expect(page.getByText(step.outcomeExcerpt, { exact: false })).toBeVisible()
    await expect(page.getByText(step.value)).toBeVisible()
    await expectAccessibleViewport(page, `outcome ${step.decision}`)
    if (step.decision < 5) {
      await page
        .getByRole('button', {
          name: `Continue to decision ${step.decision + 1}`,
        })
        .click()
    }
  }

  await page.getByRole('button', { name: 'See your result' }).click()
  await expect(
    page.getByRole('heading', { name: 'You built your Netflix', level: 1 }),
  ).toBeVisible()
  await expect(page.getByText('Founder streak: 1 day')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Review decision \d:/ }),
  ).toHaveCount(5)
  await page
    .getByRole('button', {
      name: 'Review decision 1: Unbundle and reprice immediately',
    })
    .click()
  const recap = page.getByRole('dialog', { name: 'Decision 1 recap' })
  await expect(recap.getByText(/spreadsheet gets clean/)).toBeVisible()
  await expect(
    recap.getByRole('link', {
      name: 'Netflix Q1 2011 Letter to Shareholders',
    }),
  ).toBeVisible()
  await recap.getByRole('button', { name: 'Close Decision 1 recap' }).click()
  await expectAccessibleViewport(page, 'ending')

  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'You built your Netflix', level: 1 }),
  ).toBeVisible()
  await expect(page.getByText('Founder streak: 1 day')).toBeVisible()
  await page.getByRole('button', { name: 'Replay episode' }).click()
  await expect(page.getByText(/Streaming is speed-running the future/)).toBeVisible()
  await page.getByRole('button', { name: 'Exit episode' }).click()
  await page.getByRole('button', { name: 'Past episodes' }).click()
  await expectAccessibleViewport(page, 'episode archive')
  await page
    .getByRole('button', { name: 'Select Episode 2: Apple Computer' })
    .click()
  await expect(page.getByText('Episode 2')).toBeVisible()
  await expect(page.getByText('Apple Computer')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Apple Computer')).toBeVisible()
  await expectRadioSelected(page.getByRole('radio', { name: 'Brainrot' }))
  await expect(page.getByText('Founder streak: 1 day')).toBeVisible()
  await page.getByRole('link', { name: 'Back to all games' }).click()
  await expect(page.getByLabel('Founder streak: 1 day')).toBeVisible()
})

test('preserves malformed save data until recovery is explicitly accepted', async ({
  page,
}) => {
  await page.goto('/Open-Trade/#/founder-mode')
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [FOUNDER_SAVE_KEY, '{broken'] as const,
  )
  await page.reload()

  await expect(page.getByRole('alert')).toContainText('Save recovery required')
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), FOUNDER_SAVE_KEY))
    .toBe('{broken')
  await page
    .getByRole('button', { name: 'Start fresh and replace save' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Founder Mode', level: 1 }),
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), FOUNDER_SAVE_KEY))
    .not.toBe('{broken')
})

test('stays usable at 320px and disables boardroom parallax for reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 720 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openFreshFounderMode(page)
  await expect(page.locator('.founder-mode')).toHaveCSS(
    'background-attachment',
    /scroll/,
  )
  await page.setViewportSize({ width: 320, height: 640 })
  await expectAccessibleViewport(page, '320px landing')
  await page.getByRole('button', { name: 'Play episode' }).click()
  await page.getByRole('button', { name: 'Take the chair' }).click()
  await expectAccessibleViewport(page, '320px decision')
  await expect(
    page.getByRole('button', { name: 'Unbundle and reprice immediately' }),
  ).toBeVisible()
})
