import { useState } from 'react'
import { HashRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from '../App'
import { FANSTOCKS_METADATA } from './metadata'
import { LazyGameRoute } from './LazyGameRoute'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import type { GameRouteRegistration } from './types'

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

test('reloads after a rejected lazy game load instead of reusing its import', async () => {
  let loadCalls = 0
  let rejectFirstLoad: (reason?: unknown) => void = () => {
    throw new Error('First lazy loader was not initialized')
  }
  let reloadCalls = 0

  const registration: GameRouteRegistration = {
    metadata: FANSTOCKS_METADATA,
    load: () => {
      loadCalls += 1
      return new Promise((_, reject) => {
        rejectFirstLoad = reject
      })
    },
  }
  window.location.hash = '#/fanstocks?seed=retry-42&rules=1'
  const hashBeforeRetry = window.location.hash

  const screen = await render(
    <HashRouter>
      <LazyGameRoute
        registration={registration}
        reload={() => {
          reloadCalls += 1
        }}
      />
    </HashRouter>,
  )

  await expect.element(screen.getByRole('status')).toBeVisible()
  await expect.poll(() => loadCalls).toBe(1)
  rejectFirstLoad(new Error('lazy route unavailable'))
  await expect.element(
    screen.getByRole('heading', { name: 'This game hit a snag' }),
  ).toBeVisible()

  await screen.getByRole('button', { name: 'Try again' }).click()
  await expect.poll(() => reloadCalls).toBe(1)
  await expect.poll(() => loadCalls).toBe(1)
  await expect.element(
    screen.getByRole('heading', { name: 'This game hit a snag' }),
  ).toBeVisible()
  await expect.poll(() => window.location.hash).toBe(hashBeforeRetry)
})
