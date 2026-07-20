import { HashRouter } from 'react-router-dom'
import { AudioProvider } from '../shared/audio/AudioContext'
import { SettingsProvider } from '../shared/settings/SettingsContext'
import { ToastProvider } from '../shared/ui'
import { AppRouter } from './routes/AppRouter'

export function App() {
  return (
    <HashRouter>
      <SettingsProvider>
        <AudioProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AudioProvider>
      </SettingsProvider>
    </HashRouter>
  )
}
