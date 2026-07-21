import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from './App'

test('renders the routed product shell and disclaimer', async () => {
  window.location.hash = '#/'
  const screen = await render(<App />)

  await expect.element(
    screen.getByRole('link', { name: 'OpenTrade games' }),
  ).toBeVisible()
  await expect.element(
    screen.getByRole('heading', { name: 'Choose your market', level: 1 }),
  ).toBeVisible()
  await expect.element(
    screen
      .getByRole('main')
      .getByText('Simulated game — not investment advice'),
  ).toBeVisible()
  await expect.poll(() => document.activeElement).toBe(document.body)
})

test('skip link preserves the hash route and focuses the current page main', async () => {
  window.location.hash = '#/fanstocks?seed=guest-42&rules=1'
  const screen = await render(<App />)

  await expect.element(
    screen.getByRole('heading', { name: 'Fantasy Stock Leagues', level: 1 }),
  ).toBeVisible()
  const hashBeforeSkip = window.location.hash

  await screen.getByRole('link', { name: 'Skip to content' }).click()

  await expect.poll(() => window.location.hash).toBe(hashBeforeSkip)
  await expect.element(
    screen.getByRole('heading', { name: 'Fantasy Stock Leagues', level: 1 }),
  ).toBeVisible()
  await expect.element(screen.getByRole('main')).toHaveFocus()
})
