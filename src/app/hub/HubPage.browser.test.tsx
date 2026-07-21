import { afterEach, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { App } from '../App'
import { GAME_ROUTES } from '../routes/registry'

const FANSTOCKS_SAVE_KEY = 'opentrade.fanstocks'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

function getFanStocksRegistration() {
  const registration = GAME_ROUTES.find(
    (candidate) => candidate.metadata.id === 'fanstocks',
  )
  if (registration === undefined) {
    throw new Error('FanStocks registration is missing')
  }
  return registration
}

test('renders three complete game cards and opens the how-to dialog', async () => {
  window.location.hash = '#/'
  const screen = await render(<App />)

  await expect.element(
    screen.getByRole('heading', { name: 'Choose your market', level: 1 }),
  ).toBeVisible()
  await expect.element(
    screen.getByRole('heading', { name: 'FanStocks', level: 2 }),
  ).toBeVisible()
  await expect.element(
    screen.getByRole('heading', { name: 'Founder Mode', level: 2 }),
  ).toBeVisible()
  await expect.element(
    screen.getByRole('heading', { name: 'Wallstreet Surfers', level: 2 }),
  ).toBeVisible()

  await screen.getByRole('button', {
    name: 'How FanStocks works',
  }).click()
  await expect.element(
    screen.getByRole('dialog', { name: 'How FanStocks works' }),
  ).toBeVisible()
  await expect.element(
    screen.getByText(
      'Draft one stock from each of three candidate groups.',
    ),
  ).toBeVisible()
})

test('resets one game and announces success without touching other saves', async () => {
  window.location.hash = '#/'
  window.localStorage.setItem(FANSTOCKS_SAVE_KEY, 'saved')
  window.localStorage.setItem('open-trade:game:founder-mode', 'keep')
  const screen = await render(<App />)

  await screen.getByRole('button', {
    name: 'Reset FanStocks progress',
  }).click()
  await screen.getByRole('button', {
    name: 'Confirm reset FanStocks',
  }).click()

  await expect.element(screen.getByText('FanStocks progress reset')).toBeVisible()
  expect(window.localStorage.getItem(FANSTOCKS_SAVE_KEY)).toBeNull()
  expect(window.localStorage.getItem('open-trade:game:founder-mode')).toBe(
    'keep',
  )
})

test('keeps reset confirmation usable when the lazy game route rejects', async () => {
  let rejectLoad: (reason?: unknown) => void = () => {
    throw new Error('Lazy loader was not initialized')
  }
  const registration = getFanStocksRegistration()
  const load = vi.spyOn(registration, 'load').mockImplementation(
    () =>
      new Promise((_, reject) => {
        rejectLoad = reject
      }),
  )
  window.location.hash = '#/'
  const screen = await render(<App />)

  await screen.getByRole('button', {
    name: 'Reset FanStocks progress',
  }).click()
  const confirm = screen.getByRole('button', {
    name: 'Confirm reset FanStocks',
  })
  await confirm.click()
  await expect.element(confirm).toBeDisabled()
  expect(load).toHaveBeenCalledTimes(1)

  rejectLoad(new Error('Lazy game route unavailable'))
  await expect.element(
    screen.getByText('FanStocks progress reset failed'),
  ).toBeVisible()
  await expect.element(
    screen.getByRole('dialog', { name: 'Reset FanStocks progress' }),
  ).toBeVisible()
  await expect.element(confirm).not.toBeDisabled()
})

test('keeps reset confirmation usable when the game reset throws', async () => {
  const registration = getFanStocksRegistration()
  const originalLoad = registration.load
  vi.spyOn(registration, 'load').mockImplementation(async () => {
    const module = await originalLoad()
    return {
      ...module,
      gameRoute: {
        ...module.gameRoute,
        reset: () => {
          throw new Error('Game storage failed')
        },
      },
    }
  })
  window.location.hash = '#/'
  const screen = await render(<App />)

  await screen.getByRole('button', {
    name: 'Reset FanStocks progress',
  }).click()
  const confirm = screen.getByRole('button', {
    name: 'Confirm reset FanStocks',
  })
  await confirm.click()

  await expect.element(
    screen.getByText('FanStocks progress reset failed'),
  ).toBeVisible()
  await expect.element(
    screen.getByRole('dialog', { name: 'Reset FanStocks progress' }),
  ).toBeVisible()
  await expect.element(confirm).not.toBeDisabled()
})

test('cancels a pending reset on Escape without allowing its stale load to reset later', async () => {
  let releaseFirstLoad: () => void = () => {
    throw new Error('Pending loader was not initialized')
  }
  const firstLoad = new Promise<void>((resolve) => {
    releaseFirstLoad = resolve
  })
  const registration = getFanStocksRegistration()
  const originalLoad = registration.load
  let loadCount = 0
  vi.spyOn(registration, 'load').mockImplementation(async () => {
    loadCount += 1
    if (loadCount === 1) {
      await firstLoad
    }
    return originalLoad()
  })
  window.location.hash = '#/'
  window.localStorage.setItem(FANSTOCKS_SAVE_KEY, 'saved')
  const screen = await render(<App />)
  const resetButton = screen.getByRole('button', {
    name: 'Reset FanStocks progress',
  })

  await resetButton.click()
  const confirm = screen.getByRole('button', {
    name: 'Confirm reset FanStocks',
  })
  await confirm.click()
  await expect.element(confirm).toBeDisabled()

  await userEvent.keyboard('{Escape}')
  await expect.poll(() => document.querySelector('dialog[open]')).toBeNull()
  await expect.element(resetButton).toHaveFocus()

  releaseFirstLoad()
  await expect.poll(() => loadCount).toBe(1)
  expect(window.localStorage.getItem(FANSTOCKS_SAVE_KEY)).toBe('saved')
  await expect.poll(() => document.body.textContent).not.toContain(
    'FanStocks progress reset',
  )

  await resetButton.click()
  await screen.getByRole('button', { name: 'Confirm reset FanStocks' }).click()
  await expect.element(screen.getByText('FanStocks progress reset')).toBeVisible()
  expect(window.localStorage.getItem(FANSTOCKS_SAVE_KEY)).toBeNull()
  expect(loadCount).toBe(2)
})

test('invalidates a pending reset when navigation unmounts the hub', async () => {
  let releaseLoad: () => void = () => {
    throw new Error('Pending loader was not initialized')
  }
  const pendingLoad = new Promise<void>((resolve) => {
    releaseLoad = resolve
  })
  const registration = getFanStocksRegistration()
  const originalLoad = registration.load
  let completedLoads = 0
  let resetCalls = 0
  vi.spyOn(registration, 'load').mockImplementation(async () => {
    await pendingLoad
    const module = await originalLoad()
    completedLoads += 1
    return {
      ...module,
      gameRoute: {
        ...module.gameRoute,
        reset: () => {
          resetCalls += 1
          module.gameRoute.reset()
        },
      },
    }
  })
  window.location.hash = '#/'
  window.localStorage.setItem(FANSTOCKS_SAVE_KEY, 'saved')
  const screen = await render(<App />)

  await screen.getByRole('button', {
    name: 'Reset FanStocks progress',
  }).click()
  await screen.getByRole('button', {
    name: 'Confirm reset FanStocks',
  }).click()

  window.location.hash = '#/missing'
  await expect.element(
    screen.getByRole('heading', { name: 'Market not found', level: 1 }),
  ).toBeVisible()

  releaseLoad()
  await expect.poll(() => completedLoads).toBe(1)
  await Promise.resolve()
  await Promise.resolve()
  expect(resetCalls).toBe(0)
  expect(window.localStorage.getItem(FANSTOCKS_SAVE_KEY)).toBe('saved')
  await expect.poll(() => document.body.textContent).not.toContain(
    'FanStocks progress reset',
  )
  await expect.poll(() => document.body.textContent).not.toContain(
    'FanStocks progress reset failed',
  )
})
