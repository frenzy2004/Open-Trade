import { beforeEach, describe, expect, it } from 'vitest'
import type { StorageLike } from '../../shared/persistence/gameStore'
import {
  createProgressStore,
  DEFAULT_PROGRESS,
} from './progressStore'

class ProgressStorage implements StorageLike {
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

describe('progress store', () => {
  let storage: ProgressStorage

  beforeEach(() => {
    storage = new ProgressStorage()
  })

  it('starts with the three approved badge summaries', () => {
    const progress = createProgressStore(storage)

    expect(progress.readAll()).toEqual(DEFAULT_PROGRESS)
  })

  it('persists and resets one game without changing the others', () => {
    const progress = createProgressStore(storage)
    progress.set('fanstocks', {
      label: 'League',
      value: 'Round 2 of 3',
      tone: 'positive',
    })
    progress.set('wallstreet-surfers', {
      label: 'Best score',
      value: '12,450',
      tone: 'positive',
    })
    progress.reset('fanstocks')

    expect(progress.read('fanstocks')).toEqual(DEFAULT_PROGRESS.fanstocks)
    expect(progress.read('wallstreet-surfers')).toEqual({
      label: 'Best score',
      value: '12,450',
      tone: 'positive',
    })
  })

  it('resets every badge to a fresh immutable snapshot', () => {
    const progress = createProgressStore(storage)
    progress.set('founder-mode', {
      label: 'Founder streak',
      value: '4 days',
      tone: 'positive',
    })
    progress.resetAll()

    const snapshot = progress.readAll()
    expect(snapshot).toEqual(DEFAULT_PROGRESS)
    expect(snapshot).not.toBe(DEFAULT_PROGRESS)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.fanstocks)).toBe(true)
  })

  it('rejects persisted badges that inherit required fields', () => {
    const inheritedBadge = Object.create({
      label: 'League',
      value: 'Round 2 of 3',
      tone: 'positive',
    })
    storage.setItem(
      'open-trade:hub-progress',
      JSON.stringify({
        version: 1,
        savedAt: '2026-07-21T00:00:00.000Z',
        seed: null,
        data: {
          fanstocks: inheritedBadge,
          'founder-mode': DEFAULT_PROGRESS['founder-mode'],
          'wallstreet-surfers': DEFAULT_PROGRESS['wallstreet-surfers'],
        },
      }),
    )

    expect(createProgressStore(storage).readAll()).toEqual(DEFAULT_PROGRESS)
  })
})
