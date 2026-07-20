import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { GameStore } from '../persistence/gameStore'
import { Button } from '../ui'
import {
  type AppSettings,
  createSettingsStore,
  DEFAULT_SETTINGS,
} from './settingsStore'

export interface SettingsContextValue {
  readonly settings: AppSettings
  readonly updateSettings: (patch: Partial<AppSettings>) => void
}

interface SettingsProviderProps {
  readonly store?: GameStore<AppSettings>
  readonly initialSettings?: AppSettings
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({
  store: suppliedStore,
  initialSettings = DEFAULT_SETTINGS,
  children,
}: PropsWithChildren<SettingsProviderProps>) {
  const store = useMemo(
    () => suppliedStore ?? createSettingsStore(),
    [suppliedStore],
  )
  const initialLoad = useMemo(() => store.load(), [store])
  const [settings, setSettings] = useState<AppSettings>(
    initialLoad.status === 'ready' ? initialLoad.value : initialSettings,
  )
  const [showRecovery, setShowRecovery] = useState(
    initialLoad.status === 'recovery-required',
  )

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(
      settings.reducedMotion,
    )
    return () => {
      delete document.documentElement.dataset.reducedMotion
    }
  }, [settings.reducedMotion])

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch }
        store.save(next)
        return next
      })
    },
    [store],
  )

  const value = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  )

  return (
    <SettingsContext.Provider value={value}>
      {showRecovery ? (
        <div className="settings-recovery" role="alert">
          <span>Saved settings could not be read. Safe defaults are active.</span>
          <Button
            variant="secondary"
            onClick={() => {
              store.clear()
              setShowRecovery(false)
            }}
          >
            Clear damaged settings
          </Button>
        </div>
      ) : null}
      {children}
    </SettingsContext.Provider>
  )
}

// The public hook must share this module's private context with SettingsProvider.
// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (context === null) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}
