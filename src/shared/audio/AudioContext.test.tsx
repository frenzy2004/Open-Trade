import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameStore } from '../persistence/gameStore'
import { SettingsProvider } from '../settings/SettingsContext'
import type { AppSettings } from '../settings/settingsStore'
import { AudioManager, type PlayableAudio } from './AudioManager'
import { AudioProvider } from './AudioContext'

const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden')

afterEach(() => {
  if (originalHidden === undefined) {
    Reflect.deleteProperty(document, 'hidden')
  } else {
    Object.defineProperty(document, 'hidden', originalHidden)
  }
})

function makeAudio(): PlayableAudio {
  return {
    currentTime: 0,
    loop: false,
    volume: 1,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    addEventListener: vi.fn(),
  }
}

function emptySettingsStore(): GameStore<AppSettings> {
  return {
    load: () => ({ status: 'empty' }),
    save: () => ({ ok: true }),
    clear: () => ({ ok: true }),
  }
}

describe('AudioProvider', () => {
  it('unlocks from a gesture, starts one quiet loop, and follows visibility', async () => {
    const unlockAudio = makeAudio()
    const loopAudio = makeAudio()
    const queue = [unlockAudio, loopAudio]
    const manager = new AudioManager(() => {
      const audio = queue.shift()
      if (audio === undefined) throw new Error('Unexpected audio allocation')
      return audio
    })

    const view = render(
      <SettingsProvider
        store={emptySettingsStore()}
        initialSettings={{ muted: false, reducedMotion: false, volume: 0.5 }}
      >
        <AudioProvider manager={manager}>
          <div>Game</div>
        </AudioProvider>
      </SettingsProvider>,
    )

    fireEvent.pointerDown(document)
    await waitFor(() => expect(loopAudio.play).toHaveBeenCalledOnce())
    expect(unlockAudio.volume).toBe(0)
    expect(loopAudio.loop).toBe(true)
    expect(loopAudio.volume).toBeCloseTo(0.175)

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    })
    fireEvent(document, new Event('visibilitychange'))
    expect(loopAudio.pause).toHaveBeenCalledOnce()

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    })
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => expect(loopAudio.play).toHaveBeenCalledTimes(2))

    view.unmount()
    expect(loopAudio.pause).toHaveBeenCalledTimes(2)
  })

  it('keeps gesture listeners available until a transient unlock failure recovers', async () => {
    const blockedUnlock = makeAudio()
    blockedUnlock.play = vi.fn(() => Promise.reject(new Error('blocked once')))
    const successfulUnlock = makeAudio()
    const loopAudio = makeAudio()
    const queue = [blockedUnlock, successfulUnlock, loopAudio]
    const manager = new AudioManager(() => {
      const audio = queue.shift()
      if (audio === undefined) throw new Error('Unexpected audio allocation')
      return audio
    })

    const view = render(
      <SettingsProvider
        store={emptySettingsStore()}
        initialSettings={{ muted: false, reducedMotion: false, volume: 0.7 }}
      >
        <AudioProvider manager={manager}>
          <div>Game</div>
        </AudioProvider>
      </SettingsProvider>,
    )

    fireEvent.pointerDown(document)
    await waitFor(() => expect(blockedUnlock.play).toHaveBeenCalledOnce())
    expect(manager.isUnlocked()).toBe(false)

    fireEvent.pointerDown(document)
    await waitFor(() => expect(loopAudio.play).toHaveBeenCalledOnce())
    expect(manager.isUnlocked()).toBe(true)

    fireEvent.pointerDown(document)
    expect(queue).toEqual([])
    view.unmount()
  })
})
