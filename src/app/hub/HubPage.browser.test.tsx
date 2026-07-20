import { afterEach, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from '../App'
import { GAME_ROUTES } from '../routes/registry'

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
  window.localStorage.setItem('open-trade:game:fanstocks', 'saved')
  window.localStorage.setItem('open-trade:game:founder-mode', 'keep')
  const screen = await render(<App />)

  await screen.getByRole('button', {
    name: 'Reset FanStocks progress',
  }).click()
  await screen.getByRole('button', {
    name: 'Confirm reset FanStocks',
  }).click()

  await expect.element(screen.getByText('FanStocks progress reset')).toBeVisible()
  expect(window.localStorage.getItem('open-trade:game:fanstocks')).toBeNull()
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
