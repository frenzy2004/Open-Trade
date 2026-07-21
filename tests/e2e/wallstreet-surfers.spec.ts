import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'
import {
  RUNNER_E2E_CHALLENGE,
  runnerChallengeHash,
} from './fixtures/runnerChallenge'

async function debugValue(page: Page, key: string): Promise<string> {
  return page.locator(`[data-runner-debug="${key}"]`).innerText()
}

async function debugNumber(page: Page, key: string): Promise<number> {
  return Number.parseFloat(await debugValue(page, key))
}

async function waitForDistance(page: Page, distanceM: number): Promise<void> {
  await expect.poll(() => debugNumber(page, 'distance'), {
    timeout: 20_000,
  }).toBeGreaterThanOrEqual(distanceM)
}

function isTouch(testInfo: TestInfo): boolean {
  return testInfo.project.name.includes('touch')
}

async function realTouchSwipe(
  page: Page,
  direction: 'left' | 'right' | 'up' | 'down',
): Promise<void> {
  const stage = page.locator('.runner-stage')
  const canvas = page.locator('.runner-canvas-mount canvas')
  await stage.scrollIntoViewIfNeeded()
  const stageBox = await stage.boundingBox()
  const canvasBox = await canvas.boundingBox()
  if (stageBox === null || canvasBox === null) {
    throw new Error('Runner stage and canvas must have layout boxes')
  }
  const topGap = canvasBox.y - stageBox.y
  const bottomGap = stageBox.y + stageBox.height
    - (canvasBox.y + canvasBox.height)
  expect(Math.max(topGap, bottomGap)).toBeGreaterThan(8)
  const startY = topGap >= bottomGap
    ? stageBox.y + topGap / 2
    : canvasBox.y + canvasBox.height + bottomGap / 2
  const startX = stageBox.x + stageBox.width / 2
  const deltaX = direction === 'left' ? -90 : direction === 'right' ? 90 : 0
  const deltaY = direction === 'up' ? -90 : direction === 'down' ? 90 : 0
  const scrollBefore = await page.evaluate(() => window.scrollY)
  const session = await page.context().newCDPSession(page)
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY, id: 1 }],
    })
    for (let step = 1; step <= 4; step += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{
          x: startX + deltaX * (step / 4),
          y: startY + deltaY * (step / 4),
          id: 1,
        }],
      })
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } finally {
    await session.detach()
  }
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
}

async function moveLane(
  page: Page,
  direction: 'left' | 'right',
  testInfo: TestInfo,
): Promise<void> {
  if (isTouch(testInfo)) {
    await realTouchSwipe(page, direction)
  } else {
    await page.keyboard.press(direction === 'left' ? 'ArrowLeft' : 'ArrowRight')
  }
}

async function finishTutorial(page: Page, testInfo: TestInfo): Promise<void> {
  if (isTouch(testInfo)) {
    await realTouchSwipe(page, 'left')
  } else {
    await page.keyboard.press('ArrowLeft')
  }
  await expect(page.getByText(/Nice\. Jump over/i)).toBeVisible()
  if (isTouch(testInfo)) {
    await realTouchSwipe(page, 'up')
    await expect(page.getByText(/Now roll under/i)).toBeVisible()
    await realTouchSwipe(page, 'down')
  } else {
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowDown')
  }
  await expect(page.getByText(/Sample call/i)).toBeVisible()
  await page.getByRole('button', { name: 'LONG', exact: true }).click()
  await expect(page.getByLabel('Runner tutorial')).toHaveCount(0)
}

test('replays coin, train, restart, and market gate on desktop and real touch', async ({
  page,
}, testInfo) => {
  test.setTimeout(80_000)
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

  await finishTutorial(page, testInfo)
  await expect.poll(() => debugValue(page, 'seed')).toBe(
    RUNNER_E2E_CHALLENGE.seed,
  )
  await expect.poll(() => debugValue(page, 'next-entity')).toBe(
    RUNNER_E2E_CHALLENGE.firstEntity,
  )

  if (isTouch(testInfo)) {
    const stageBox = await page.locator('.runner-stage').boundingBox()
    const canvasBox = await page.locator('.runner-canvas-mount canvas').boundingBox()
    if (stageBox === null || canvasBox === null) throw new Error('Expected mobile layout')
    expect(stageBox.height / stageBox.width).toBeLessThanOrEqual(0.8)
    expect(canvasBox.height / stageBox.height).toBeGreaterThan(0.7)
    expect(
      await page.locator('.runner-hud dt:visible').allTextContents(),
    ).toEqual(['Score', 'Distance', 'Coins', 'Streak', 'Powell gap'])
  }

  await page.getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await expect(settings).toBeVisible()
  const distanceAtModalOpen = await debugNumber(page, 'distance')
  await page.waitForTimeout(1_000)
  expect(await debugNumber(page, 'distance')).toBeCloseTo(distanceAtModalOpen, 0)
  await page.keyboard.press('Escape')
  await expect(settings).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused()
  await expect.poll(() => debugNumber(page, 'distance'))
    .toBeGreaterThan(distanceAtModalOpen + 1)

  await expect(page.locator('[data-runner-hud="coins"]')).toHaveText('1', {
    timeout: 15_000,
  })
  await moveLane(page, 'left', testInfo)
  await expect.poll(() => debugValue(page, 'lane')).toBe('-1')

  const gameOver = page.getByRole('alertdialog')
  await expect(gameOver).toBeVisible({ timeout: 10_000 })
  await expect(gameOver).toBeFocused()
  await expect(
    page.getByRole('heading', { name: RUNNER_E2E_CHALLENGE.failure }),
  ).toBeVisible()
  await expect(page.getByText(RUNNER_E2E_CHALLENGE.tip)).toBeVisible()
  await expect.poll(() => debugNumber(page, 'cpu-samples')).toBe(600)
  expect(await debugNumber(page, 'max-step-cpu')).toBeLessThanOrEqual(16.7)

  await page.getByRole('button', { name: 'Run again' }).click()
  await expect.poll(() => debugValue(page, 'next-entity')).toBe(
    RUNNER_E2E_CHALLENGE.firstEntity,
  )
  await expect(page.locator('[data-runner-hud="coins"]')).toHaveText('1', {
    timeout: 15_000,
  })
  await waitForDistance(page, 190)
  await moveLane(page, 'right', testInfo)
  await expect.poll(() => debugValue(page, 'lane')).toBe('1')
  await expect(page.locator('[data-runner-hud="coins"]')).toHaveText('2', {
    timeout: 8_000,
  })
  // Move as soon as the 211m right-lane coin resolves. Waiting until 225m left
  // too little real-time margin before the 243m center coin on a loaded touch
  // browser, even though the gesture itself had already been proven correct.
  await moveLane(page, 'left', testInfo)
  await expect.poll(() => debugValue(page, 'lane')).toBe('0')
  await expect(page.locator('[data-runner-hud="coins"]')).toHaveText('3', {
    timeout: 8_000,
  })

  const gate = page.getByRole('region', { name: 'Make the call' })
  await expect(gate).toBeVisible({ timeout: 15_000 })
  await expect(gate).toContainText(RUNNER_E2E_CHALLENGE.gateTicker)
  await gate.getByRole('button', {
    name: new RegExp(RUNNER_E2E_CHALLENGE.gateAnswer, 'i'),
  }).click()
  const feedback = page.locator('.runner-gate--feedback')
  await expect(feedback).toContainText(/Correct\./)
  await expect(feedback).toHaveCount(0, { timeout: 6_000 })

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
