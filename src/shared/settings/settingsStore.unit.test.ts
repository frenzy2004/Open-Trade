import { describe, expect, it } from 'vitest'
import type { StorageLike } from '../persistence/gameStore'
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  SETTINGS_SAVE_KEY,
} from './settingsStore'

class SettingsStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

describe('settings store', () => {
  it('round-trips the exact public settings shape', () => {
    const store = createSettingsStore(new SettingsStorage())

    expect(store.save({ muted: true, reducedMotion: true, volume: 0.4 })).toEqual({
      ok: true,
    })
    expect(store.load()).toMatchObject({
      status: 'ready',
      value: { muted: true, reducedMotion: true, volume: 0.4 },
    })
  })

  it('migrates the version-zero sound shape', () => {
    const storage = new SettingsStorage()
    storage.setItem(
      SETTINGS_SAVE_KEY,
      JSON.stringify({
        version: 0,
        savedAt: '2026-07-20T00:00:00.000Z',
        seed: null,
        data: { soundEnabled: false, reduceMotion: true },
      }),
    )

    expect(createSettingsStore(storage).load()).toMatchObject({
      status: 'ready',
      value: { muted: true, reducedMotion: true, volume: 0.7 },
      migrated: true,
    })
  })

  it('migrates version-one settings with the default volume', () => {
    const storage = new SettingsStorage()
    storage.setItem(
      SETTINGS_SAVE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: '2026-07-20T00:00:00.000Z',
        seed: null,
        data: { muted: false, reducedMotion: true },
      }),
    )

    expect(createSettingsStore(storage).load()).toMatchObject({
      status: 'ready',
      value: { muted: false, reducedMotion: true, volume: 0.7 },
      migrated: true,
    })
  })

  it('rejects settings fields inherited from the ambient object prototype', () => {
    const storage = new SettingsStorage()
    storage.setItem(
      SETTINGS_SAVE_KEY,
      JSON.stringify({
        version: 2,
        savedAt: '2026-07-20T00:00:00.000Z',
        seed: null,
        data: {},
      }),
    )
    Object.defineProperties(Object.prototype, {
      muted: { configurable: true, value: false },
      reducedMotion: { configurable: true, value: false },
    })

    try {
      expect(createSettingsStore(storage).load()).toMatchObject({
        status: 'recovery-required',
        reason: 'corrupt',
      })
    } finally {
      delete (Object.prototype as Record<string, unknown>).muted
      delete (Object.prototype as Record<string, unknown>).reducedMotion
    }
  })

  it('exports immutable defaults', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      muted: false,
      reducedMotion: false,
      volume: 0.7,
    })
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true)
  })
})
