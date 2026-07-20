import { Route, Routes } from 'react-router-dom'
import { AppShell } from '../AppShell'
import { HubFoundationPage } from '../hub/HubFoundationPage'
import { LazyGameRoute } from './LazyGameRoute'
import { GAME_ROUTES } from './registry'

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
        <Route index element={<HubFoundationPage />} />
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
