import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from '../App'

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
