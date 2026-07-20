import { type ReactNode, useState } from 'react'
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

test('retries a rejected lazy game load with a fresh entry', async () => {
  let loadCalls = 0
  let rejectFirstLoad: (reason?: unknown) => void = () => {
    throw new Error('First lazy loader was not initialized')
  }
  let resolveSecondLoad: (value: {
    readonly gameRoute: {
      readonly metadata: typeof FANSTOCKS_METADATA
      readonly Entry: () => ReactNode
      readonly saveKey: string
      readonly reset: () => void
      readonly getProgressBadge: () => {
        readonly label: string
        readonly value: string
        readonly tone: 'neutral'
      }
    }
  }) => void = () => {
    throw new Error('Second lazy loader was not initialized')
  }

  function RecoveredEntry() {
    return <h1>Recovered lazy game</h1>
  }

  const registration: GameRouteRegistration = {
    metadata: FANSTOCKS_METADATA,
    load: () => {
      loadCalls += 1
      if (loadCalls === 1) {
        return new Promise((_, reject) => {
          rejectFirstLoad = reject
        })
      }
      return new Promise((resolve) => {
        resolveSecondLoad = resolve
      })
    },
  }
  const gameRoute = {
    metadata: FANSTOCKS_METADATA,
    Entry: RecoveredEntry,
    saveKey: 'test:fanstocks',
    reset: () => undefined,
    getProgressBadge: () => ({
      label: 'Test',
      value: '0',
      tone: 'neutral' as const,
    }),
  }

  const screen = await render(
    <HashRouter>
      <LazyGameRoute registration={registration} />
    </HashRouter>,
  )

  await expect.element(screen.getByRole('status')).toBeVisible()
  await expect.poll(() => loadCalls).toBe(1)
  rejectFirstLoad(new Error('lazy route unavailable'))
  await expect.element(
    screen.getByRole('heading', { name: 'This game hit a snag' }),
  ).toBeVisible()

  await screen.getByRole('button', { name: 'Try again' }).click()
  await expect.element(screen.getByRole('status')).toBeVisible()
  await expect.poll(() => loadCalls).toBe(2)
  resolveSecondLoad({ gameRoute })
  await expect.element(
    screen.getByRole('heading', { name: 'Recovered lazy game', level: 1 }),
  ).toBeVisible()
})
