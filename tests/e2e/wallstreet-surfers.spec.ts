import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'
import {
  RUNNER_E2E_CHALLENGE,
  runnerChallengeHash,
} from './fixtures/runnerChallenge'

async function debugValue(page: Page, key: string): Promise<string> {
  return page.locator(`[data-runner-debug="${key}"]`).innerText()
}

async function finishTutorial(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Move left' }).click()
  await page.getByRole('button', { name: 'Jump or LONG' }).click()
  await page.getByRole('button', { name: 'Roll or SHORT' }).click()
  await page.getByRole('button', { name: 'LONG', exact: true }).click()
  await expect(page.getByLabel('Runner tutorial')).toHaveCount(0)
}

async function moveLeft(page: Page, testInfo: TestInfo): Promise<void> {
  if (testInfo.project.name.includes('touch')) {
    await page.getByRole('button', { name: 'Move left' }).click()
  } else {
    await page.locator('.runner-canvas-mount').focus()
    await page.keyboard.press('ArrowLeft')
  }
}

test('replays the deterministic coin-to-train loop on desktop and touch', async ({
  page,
}, testInfo) => {
  test.setTimeout(45_000)
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  await page.goto(`/Open-Trade/${runnerChallengeHash()}`)
  await expect(
    page.getByRole('heading', { name: 'Wallstreet Surfers', level: 1 }),
  ).toBeVisible()
  await expect(page.locator('.runner-canvas-mount canvas')).toBeVisible()
  await expect(page.locator('.runner-stage')).toHaveCSS(
    'background-image',
    /runner-street/,
  )

  await finishTutorial(page)
  await expect.poll(() => debugValue(page, 'seed')).toBe(
    RUNNER_E2E_CHALLENGE.seed,
  )
  await expect.poll(() => debugValue(page, 'next-entity')).toBe(
    RUNNER_E2E_CHALLENGE.firstEntity,
  )

  const distanceBeforeDialog = Number.parseFloat(
    await debugValue(page, 'distance'),
  )
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Settings' })).not.toBeVisible()
  await expect.poll(async () => Number.parseFloat(
    await debugValue(page, 'distance'),
  ))
    .toBeGreaterThan(distanceBeforeDialog)

  await expect(page.locator('[data-runner-hud="coins"]')).toHaveText('1', {
    timeout: 15_000,
  })
  await moveLeft(page, testInfo)

  await expect(
    page.getByRole('heading', { name: RUNNER_E2E_CHALLENGE.failure }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(RUNNER_E2E_CHALLENGE.tip)).toBeVisible()
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect.poll(() => debugValue(page, 'next-entity')).toBe(
    RUNNER_E2E_CHALLENGE.firstEntity,
  )

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  const undersizedControls = await page
    .locator('.runner-touch-controls button:visible')
    .evaluateAll((buttons) => buttons.filter((button) => {
      const bounds = button.getBoundingClientRect()
      return bounds.width < 44 || bounds.height < 44
    }).length)
  expect(undersizedControls).toBe(0)

  await testInfo.attach(`wallstreet-surfers-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
  expect(runtimeErrors).toEqual([])
})
