import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react'
import { useSettings } from '../settings/SettingsContext'
import { AudioManager } from './AudioManager'

interface AudioContextValue {
  readonly play: (src: string) => Promise<boolean>
  readonly stopAll: () => void
}

interface AudioProviderProps {
  readonly manager?: AudioManager
}

const AudioContext = createContext<AudioContextValue | null>(null)

export function AudioProvider({
  manager: suppliedManager,
  children,
}: PropsWithChildren<AudioProviderProps>) {
  const manager = useMemo(
    () => suppliedManager ?? new AudioManager(),
    [suppliedManager],
  )
  const { settings } = useSettings()

  useEffect(() => {
    manager.setMuted(settings.muted)
  }, [manager, settings.muted])

  useEffect(() => {
    return () => manager.stopAll()
  }, [manager])

  const play = useCallback((src: string) => manager.play(src), [manager])
  const stopAll = useCallback(() => manager.stopAll(), [manager])
  const value = useMemo(() => ({ play, stopAll }), [play, stopAll])

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  )
}

// The public hook must share this module's private context with AudioProvider.
// eslint-disable-next-line react-refresh/only-export-components
export function useAudio(): AudioContextValue {
  const context = useContext(AudioContext)
  if (context === null) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return context
}
