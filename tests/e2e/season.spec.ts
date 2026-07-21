import { expect, test, type Locator, type Page } from '@playwright/test'

async function selectCall(
  page: Page,
  ticker: string,
  confidence: string,
): Promise<void> {
  const reasons: Readonly<Record<string, string>> = {
    NVDA: 'Accelerator demand and hyperscaler capex keep the backlog growing.',
    TSLA: 'Inventory discounts and incentives will reset automotive margin.',
    XLE: 'Producer discipline and constrained supply will tighten inventory.',
  }
  await page.getByRole('button', {
    name: new RegExp(`Add ${ticker} to your draft`, 'i'),
  }).click()
  const editor: Locator = page.getByRole('group', { name: `${ticker} call` })
  await editor.getByRole('radio', { name: 'LONG' }).check()
  await editor.getByRole('slider', { name: `${ticker} confidence` }).fill(confidence)
  await editor.getByRole('textbox', { name: `${ticker} reason` }).fill(
    reasons[ticker] ?? `${ticker} has a measurable, falsifiable catalyst.`,
  )
  await editor.getByRole('textbox', {
    name: `Evidence that changes your ${ticker} call`,
  }).fill('Guidance falls and demand contracts for two consecutive updates.')
}

test('completes the Season draft, invite, updates, receipt, and rematch loop', async ({
  page,
}) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.goto('/Open-Trade/#/season')
  await expect(
    page.getByRole('heading', { name: 'Draft your three calls', level: 1 }),
  ).toBeVisible()

  await selectCall(page, 'NVDA', '78')
  await selectCall(page, 'TSLA', '64')
  await selectCall(page, 'XLE', '70')
  await page.getByRole('button', { name: 'Commit three calls' }).click()

  await expect(
    page.getByRole('heading', { name: 'Invite your league', level: 1 }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Create league' }).click()
  await expect(page.getByText(/League code [A-Z0-9]{6}/)).toBeVisible()
  await page.getByRole('button', { name: 'Open Tuesday update' }).click()

  for (const day of ['Tuesday', 'Wednesday', 'Thursday']) {
    await expect(
      page.getByRole('heading', { name: `${day} evidence`, level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('Original commitment', { exact: true }).first()).toBeVisible()
    if (day === 'Tuesday') {
      const nvdaCard = page.locator('.season-update-card').filter({ hasText: 'NVDA' })
      await nvdaCard.getByText('Revise this call', { exact: true }).click()
      const revision = nvdaCard.getByRole('group', { name: 'NVDA revision' })
      await revision.getByRole('slider').fill('84')
      await revision.getByRole('textbox', { name: 'Response to this evidence' }).fill(
        'The larger order is direct evidence, so I am raising confidence.',
      )
      expect(pageErrors).toEqual([])
      expect(consoleErrors).toEqual([])
      await revision.getByRole('button', { name: 'Save revision for NVDA' }).click()
      await expect(nvdaCard.getByRole('heading', { name: 'Current revised call' })).toBeVisible()
    }
    await page.getByRole('button', { name: `Lock ${day} response` }).click()
  }

  await expect(
    page.getByRole('heading', { name: 'Friday settlement', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'League table', level: 2 })).toBeVisible()
  await expect(page.getByText('You', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Score my week' }).click()

  await expect(
    page.getByRole('heading', { name: 'Your weekly receipt', level: 1 }),
  ).toBeVisible()
  await expect(page.getByText(/Decision quality score/i)).toBeVisible()
  await expect(page.getByText(
    'Direction · 35 max · Calibration · 25 max · Reasoning · 15 max · Evidence response · 15 max · Benchmark · 10 max',
    { exact: true },
  )).toBeVisible()

  await page.getByRole('button', { name: 'Rematch next Monday' }).click()
  await expect(
    page.getByRole('heading', { name: 'Draft your three calls', level: 1 }),
  ).toBeVisible()
  await expect(page.getByText('OpenTrade Season · Week 2', { exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('makes Season canonical on the hub while preserving Market Lab games', async ({
  page,
}) => {
  await page.goto('/Open-Trade/#/')
  await expect(
    page.getByRole('heading', { name: 'One market week. One complete loop.', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Start OpenTrade Season' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Market Lab', level: 2 })).toBeVisible()
  for (const game of ['FanStocks', 'Founder Mode', 'Wallstreet Surfers']) {
    await expect(page.getByRole('link', { name: `Play ${game}` })).toBeVisible()
  }
})

test('joins a shared local league code without exposing call notes in the URL', async ({
  page,
}) => {
  await page.goto('/Open-Trade/#/season?league=abcd23')
  await selectCall(page, 'NVDA', '72')
  await selectCall(page, 'TSLA', '68')
  await selectCall(page, 'XLE', '66')
  await page.getByRole('button', { name: 'Commit three calls' }).click()

  await expect(page.getByText('League code ABCD23', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create league' })).toHaveCount(0)
  await expect(page).toHaveURL(/league=abcd23$/)
  expect(page.url()).not.toContain('Accelerator')
  await page.getByRole('button', { name: 'Open Tuesday update' }).click()
  await expect(page.getByRole('heading', { name: 'Tuesday evidence', level: 1 })).toBeVisible()
})

test('keeps the Monday draft within a 320px viewport with full-size tap targets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/Open-Trade/#/season')
  await expect(page.getByRole('heading', { name: 'Draft your three calls', level: 1 })).toBeVisible()
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)

  const firstAdd = page.getByRole('button', { name: /Add NVDA to your draft/i })
  const box = await firstAdd.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.height).toBeGreaterThanOrEqual(44)
})

test('speedruns Monday with suggested notes instead of required typing', async ({
  page,
}) => {
  await page.goto('/Open-Trade/#/season')
  for (const ticker of ['NVDA', 'TSLA', 'XLE']) {
    await page.getByRole('button', {
      name: new RegExp(`Add ${ticker} to your draft`, 'i'),
    }).click()
  }

  const manualReason = 'Demand still looks stronger than consensus.'
  await page.getByRole('textbox', { name: 'NVDA reason' }).fill(manualReason)

  await page.getByRole('button', {
    name: 'Skip writing — use suggested notes',
  }).click()
  for (const ticker of ['NVDA', 'TSLA', 'XLE']) {
    await expect(page.getByRole('textbox', { name: `${ticker} reason` })).not.toHaveValue('')
    await expect(page.getByRole('textbox', {
      name: `Evidence that changes your ${ticker} call`,
    })).not.toHaveValue('')
  }
  await expect(page.getByRole('textbox', { name: 'NVDA reason' })).toHaveValue(manualReason)
  await expect(page.getByRole('button', { name: 'Commit three calls' })).toBeEnabled()
  await page.getByRole('button', { name: 'Commit three calls' }).click()
  await expect(page.getByRole('heading', { name: 'Invite your league', level: 1 })).toBeVisible()
})
