import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import type { GameRouteRegistration } from './types'

export interface LazyGameRouteProps {
  readonly registration: GameRouteRegistration
  readonly reload?: () => void
}

type LazyGameEntry = LazyExoticComponent<ComponentType>

const lazyEntries = new WeakMap<GameRouteRegistration, LazyGameEntry>()

function getLazyEntry(registration: GameRouteRegistration): LazyGameEntry {
  const existingEntry = lazyEntries.get(registration)
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
  lazyEntries.set(registration, entry)
  return entry
}

function reloadCurrentRoute(): void {
  window.location.reload()
}

/*
 * The registration selects one cached React.lazy component. The static rule
 * cannot infer that dynamic registration identity, so this boundary is kept
 * deliberately small and documented.
 */
/* eslint-disable react-hooks/static-components */
function LazyGameEntry({ registration }: LazyGameRouteProps) {
  const Entry = getLazyEntry(registration)
  return <Entry />
}
/* eslint-enable react-hooks/static-components */

export function LazyGameRoute({
  registration,
  reload = reloadCurrentRoute,
}: LazyGameRouteProps) {
  return (
    <RouteErrorBoundary onRetry={reload}>
      <Suspense fallback={<p role="status">Loading game shell</p>}>
        <LazyGameEntry registration={registration} />
      </Suspense>
    </RouteErrorBoundary>
  )
}
