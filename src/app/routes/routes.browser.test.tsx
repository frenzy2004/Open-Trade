import { useState } from 'react'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from '../App'
import { RouteErrorBoundary } from './RouteErrorBoundary'

test('loads a game entry from its hash route and can return to the hub', async () => {
  window.location.hash = '#/fanstocks?seed=guest-42&rules=1'
  const screen = await render(<App />)

  await expect.element(
    screen.getByRole('heading', { name: 'FanStocks', level: 1 }),
  ).toBeVisible()
  await expect.element(
    screen.getByText('Challenge seed guest-42 · ruleset 1'),
  ).toBeVisible()

  await screen.getByRole('link', { name: 'Back to all games' }).click()
  await expect.element(
    screen.getByRole('heading', { name: 'Choose your market', level: 1 }),
  ).toBeVisible()
  await expect.element(screen.getByRole('main')).toHaveFocus()
})

test('shows retry and return actions after a route render failure', async () => {
  let shouldThrow = true

  function UnstableRoute() {
    const [, renderAgain] = useState(0)
    if (shouldThrow) {
      throw new Error('route exploded')
    }
    return (
      <button onClick={() => renderAgain((value) => value + 1)}>
        Route recovered
      </button>
    )
  }

  const screen = await render(
    <RouteErrorBoundary>
      <UnstableRoute />
    </RouteErrorBoundary>,
  )

  await expect.element(
    screen.getByRole('heading', { name: 'This game hit a snag' }),
  ).toBeVisible()
  await expect.element(
    screen.getByRole('link', { name: 'Return to games' }),
  ).toHaveAttribute('href', '#/')
  shouldThrow = false
  await screen.getByRole('button', { name: 'Try again' }).click()
  await expect.element(
    screen.getByRole('button', { name: 'Route recovered' }),
  ).toBeVisible()
  await expect.poll(() => document.querySelector('a[href="#/"]')).toBeNull()
})
