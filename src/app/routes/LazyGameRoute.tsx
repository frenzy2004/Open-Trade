import { lazy, Suspense, type ReactNode } from 'react'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { getGameRoute } from './registry'
import type { GameRouteRegistration } from './types'

export interface LazyGameRouteProps {
  readonly registration: GameRouteRegistration
}

function createLazyEntry(registration: GameRouteRegistration) {
  return lazy(async () => {
    const module = await registration.load()
    if (module.gameRoute.metadata.id !== registration.metadata.id) {
      throw new Error('Loaded game route metadata does not match registry')
    }
    return { default: module.gameRoute.Entry }
  })
}

const FanStocksEntry = createLazyEntry(getGameRoute('fanstocks'))
const FounderModeEntry = createLazyEntry(getGameRoute('founder-mode'))
const WallstreetSurfersEntry = createLazyEntry(
  getGameRoute('wallstreet-surfers'),
)

export function LazyGameRoute({ registration }: LazyGameRouteProps) {
  let entry: ReactNode
  switch (registration.metadata.id) {
    case 'fanstocks':
      entry = <FanStocksEntry />
      break
    case 'founder-mode':
      entry = <FounderModeEntry />
      break
    case 'wallstreet-surfers':
      entry = <WallstreetSurfersEntry />
      break
  }

  return (
    <RouteErrorBoundary>
      <Suspense fallback={<p role="status">Loading game shell</p>}>
        {entry}
      </Suspense>
    </RouteErrorBoundary>
  )
}
