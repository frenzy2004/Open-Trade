import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/global.css'
import './shared/ui/ui.css'
import './shared/settings/settings.css'
import './app/app-shell.css'
import './app/hub/hub.css'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('OpenTrade root element was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
