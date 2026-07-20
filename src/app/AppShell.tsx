import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { SettingsPanel } from '../shared/settings/SettingsPanel'
import { Button } from '../shared/ui'
import { APP_DISCLAIMER, APP_NAME } from './appMeta'
import { RouteFocusManager } from './routes/RouteFocusManager'

export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
      >
        Skip to content
      </a>
      <RouteFocusManager />
      <header className="app-header">
        <Link className="app-brand" to="/" aria-label="OpenTrade games">
          {APP_NAME}
        </Link>
        <Button
          variant="secondary"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
        >
          Settings
        </Button>
      </header>
      <main id="main-content" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>{APP_DISCLAIMER}</p>
        <p>Original simulations. No real money, accounts, or live quotes.</p>
      </footer>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  )
}
