import {
  lazy,
  Suspense,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import type { GameRouteRegistration } from './types'

export interface LazyGameRouteProps {
  readonly registration: GameRouteRegistration
}

type LazyGameEntry = LazyExoticComponent<ComponentType>

const lazyEntries = new WeakMap<
  GameRouteRegistration,
  Map<number, LazyGameEntry>
>()

function getLazyEntry(
  registration: GameRouteRegistration,
  attempt: number,
): LazyGameEntry {
  let attempts = lazyEntries.get(registration)
  if (attempts === undefined) {
    attempts = new Map()
    lazyEntries.set(registration, attempts)
  }

  const existingEntry = attempts.get(attempt)
  if (existingEntry !== undefined) {
    return existingEntry
  }

  const entry = lazy(async () => {
    const module = await registration.load()
    if (module.gameRoute.metadata.id !== registration.metadata.id) {
      throw new Error('Loaded game route metadata does not match registry')
    }
    return { default: module.gameRoute.Entry }
  })
  attempts.set(attempt, entry)
  return entry
}

interface LazyGameEntryProps {
  readonly registration: GameRouteRegistration
  readonly attempt: number
}

/*
 * A retry deliberately selects a different React.lazy component identity. The
 * static-components rule cannot model this cache-backed recovery boundary.
 */
/* eslint-disable react-hooks/static-components */
function LazyGameEntry({ registration, attempt }: LazyGameEntryProps) {
  const Entry = getLazyEntry(registration, attempt)
  return <Entry />
}
/* eslint-enable react-hooks/static-components */

export function LazyGameRoute({ registration }: LazyGameRouteProps) {
  const [attempt, setAttempt] = useState(0)

  return (
    <RouteErrorBoundary onRetry={() => setAttempt((value) => value + 1)}>
      <Suspense fallback={<p role="status">Loading game shell</p>}>
        <LazyGameEntry registration={registration} attempt={attempt} />
      </Suspense>
    </RouteErrorBoundary>
  )
}
