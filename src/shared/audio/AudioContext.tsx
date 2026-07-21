import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react'
import { useSettings } from '../settings/SettingsContext'
import { asset } from '../../assets/catalog'
import { AudioManager } from './AudioManager'

interface AudioContextValue {
  readonly unlock: () => Promise<boolean>
  readonly play: (src: string) => Promise<boolean>
  readonly loop: (src: string, gain?: number) => Promise<boolean>
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
  const backgroundLoop = asset('arcade-loop').url

  useEffect(() => {
    manager.setVolume(settings.volume)
    manager.setMuted(settings.muted)
    if (!settings.muted && manager.isUnlocked()) {
      void manager.loop(backgroundLoop)
    }
  }, [backgroundLoop, manager, settings.muted, settings.volume])

  useEffect(() => {
    let active = true
    const unlockFromGesture = () => {
      void manager.unlock().then((unlocked) => {
        if (active && unlocked && !settings.muted) {
          void manager.loop(backgroundLoop)
        }
      })
    }
    document.addEventListener('pointerdown', unlockFromGesture, {
      capture: true,
      once: true,
    })
    document.addEventListener('keydown', unlockFromGesture, {
      capture: true,
      once: true,
    })
    return () => {
      active = false
      document.removeEventListener('pointerdown', unlockFromGesture, true)
      document.removeEventListener('keydown', unlockFromGesture, true)
    }
  }, [backgroundLoop, manager, settings.muted])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) manager.suspend()
      else void manager.resume()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [manager])

  useEffect(() => {
    return () => manager.stopAll()
  }, [manager])

  const unlock = useCallback(() => manager.unlock(), [manager])
  const play = useCallback((src: string) => manager.play(src), [manager])
  const loop = useCallback(
    (src: string, gain?: number) => manager.loop(src, gain),
    [manager],
  )
  const stopAll = useCallback(() => manager.stopAll(), [manager])
  const value = useMemo(
    () => ({ unlock, play, loop, stopAll }),
    [loop, play, stopAll, unlock],
  )

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
