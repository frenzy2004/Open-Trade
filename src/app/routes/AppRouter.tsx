import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from '../AppShell'
import { HubPage } from '../hub/HubPage'
import { LazyGameRoute } from './LazyGameRoute'
import { GAME_ROUTES } from './registry'
import { RouteErrorBoundary } from './RouteErrorBoundary'

const SeasonRoute = lazy(async () => {
  const module = await import('../../season/SeasonRoute')
  return { default: module.SeasonRoute }
})

function SeasonEntry() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<p role="status">Loading OpenTrade Season…</p>}>
        <SeasonRoute />
      </Suspense>
    </RouteErrorBoundary>
  )
}

function NotFoundPage() {
  return (
    <section>
      <h1>Market not found</h1>
      <a className="text-link" href="#/">
        Return to games
      </a>
    </section>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HubPage />} />
        <Route path="season" element={<SeasonEntry />} />
        {GAME_ROUTES.map((registration) => (
          <Route
            key={registration.metadata.id}
            path={registration.metadata.id}
            element={<LazyGameRoute registration={registration} />}
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
