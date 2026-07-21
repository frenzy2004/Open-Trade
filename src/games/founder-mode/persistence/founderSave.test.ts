import { describe, expect, it } from 'vitest'
import type { GameProgressBadge } from '../../../app/routes/types'
import type { StorageLike } from '../../../shared/persistence/gameStore'
import { netflix2011 } from '../content/netflix2011'
import { founderReducer } from '../engine/founderReducer'
import { createFounderRun } from '../engine/founderState'
import {
  createDefaultFounderSave,
  createFounderStore,
  FOUNDER_SAVE_KEY,
  founderSaveCodec,
  progressBadgeForFounderSave,
  type FounderSaveV1,
} from './founderSave'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  failRead = false
  failWrite = false
  failClear = false

  getItem(key: string): string | null {
    if (this.failRead) throw new Error('read unavailable')
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrite) throw new Error('write unavailable')
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    if (this.failClear) throw new Error('clear unavailable')
    this.values.delete(key)
  }
}

function readyRun(): FounderSaveV1 {
  let activeRun = founderReducer(
    createFounderRun(netflix2011, 'classic'),
    { type: 'TAKE_CHAIR' },
    netflix2011,
  )
  activeRun = founderReducer(
    activeRun,
    { type: 'CHOOSE', choiceId: 'unbundle-now' },
    netflix2011,
  )
  return {
    ...createDefaultFounderSave(),
    activeRun,
  }
}

describe('Founder Mode persistence', () => {
  it('loads an empty store without writing a default save', () => {
    const storage = new MemoryStorage()
    const store = createFounderStore({ storage })

    expect(store.load()).toEqual({ status: 'empty' })
    expect(storage.values.size).toBe(0)
  })

  it('round-trips a valid detached and deeply frozen active run', () => {
    const storage = new MemoryStorage()
    const store = createFounderStore({
      storage,
      now: () => new Date('2026-07-21T12:00:00.000Z'),
    })
    const save = readyRun()

    expect(store.save(save)).toEqual({ ok: true })
    const loaded = store.load()
    expect(loaded).toMatchObject({
      status: 'ready',
      savedAt: '2026-07-21T12:00:00.000Z',
      migrated: false,
    })
    if (loaded.status !== 'ready') throw new Error('Expected ready save')
    expect(loaded.value).toEqual(save)
    expect(loaded.value).not.toBe(save)
    expect(Object.isFrozen(loaded.value)).toBe(true)
    expect(Object.isFrozen(loaded.value.activeRun)).toBe(true)
    expect(Object.isFrozen(loaded.value.activeRun?.history)).toBe(true)
  })

  it('reports corrupt JSON and preserves the original recovery bytes', () => {
    const storage = new MemoryStorage()
    storage.values.set(FOUNDER_SAVE_KEY, '{not-json')
    const store = createFounderStore({ storage })

    expect(store.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
    })
    expect(storage.values.get(FOUNDER_SAVE_KEY)).toBe('{not-json')
  })

  it('reports newer envelopes as incompatible without erasing them', () => {
    const storage = new MemoryStorage()
    const raw = JSON.stringify({
      version: founderSaveCodec.version + 1,
      savedAt: '2026-07-21T00:00:00.000Z',
      seed: null,
      data: createDefaultFounderSave(),
    })
    storage.values.set(FOUNDER_SAVE_KEY, raw)
    const store = createFounderStore({ storage })

    expect(store.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'incompatible',
    })
    expect(storage.values.get(FOUNDER_SAVE_KEY)).toBe(raw)
  })

  it('surfaces read, write, and clear failures without pretending success', () => {
    const storage = new MemoryStorage()
    const store = createFounderStore({ storage })

    storage.failRead = true
    expect(store.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'storage-unavailable',
    })
    storage.failRead = false

    storage.values.set(FOUNDER_SAVE_KEY, 'preserve-me')
    storage.failWrite = true
    expect(store.save(createDefaultFounderSave())).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    })
    expect(storage.values.get(FOUNDER_SAVE_KEY)).toBe('preserve-me')
    storage.failWrite = false

    storage.failClear = true
    expect(store.clear()).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    })
    expect(storage.values.get(FOUNDER_SAVE_KEY)).toBe('preserve-me')
  })

  it('rejects unknown episodes and forged valuation history', () => {
    const unknownEpisode = {
      ...createDefaultFounderSave(),
      selectedEpisodeId: 'missing',
    }
    expect(founderSaveCodec.decode(unknownEpisode)).toEqual({
      ok: false,
      reason: 'Founder save selected episode is invalid',
    })

    const forged = structuredClone(readyRun()) as unknown as {
      activeRun: {
        history: { valueAfterBn: number }[]
        currentValueBn: number
      } | null
    }
    if (!forged.activeRun) throw new Error('Expected active run')
    const firstHistoryItem = forged.activeRun.history.at(0)
    if (!firstHistoryItem) throw new Error('Expected history')
    firstHistoryItem.valueAfterBn = 99
    forged.activeRun.currentValueBn = 99
    expect(founderSaveCodec.decode(forged)).toEqual({
      ok: false,
      reason: 'Founder save active run is invalid',
    })
  })

  it('rejects inherited fields, sparse history, invalid dates, and style drift', () => {
    const inherited = Object.create(createDefaultFounderSave()) as FounderSaveV1
    expect(founderSaveCodec.decode(inherited).ok).toBe(false)

    const sparse = structuredClone(readyRun()) as unknown as {
      activeRun: { history: unknown[] } | null
    }
    if (!sparse.activeRun) throw new Error('Expected active run')
    sparse.activeRun.history = new Array(1)
    expect(founderSaveCodec.decode(sparse).ok).toBe(false)

    const badDate = {
      ...createDefaultFounderSave(),
      lastCompletedDate: '2026-02-30',
    }
    expect(founderSaveCodec.decode(badDate).ok).toBe(false)

    const drift = structuredClone(readyRun()) as unknown as { style: string }
    drift.style = 'brainrot'
    expect(founderSaveCodec.decode(drift).ok).toBe(false)
  })

  it('derives the exact hub progress badge from the streak', () => {
    const cases: readonly [number, GameProgressBadge][] = [
      [0, { label: 'Founder streak', value: '0 days', tone: 'neutral' }],
      [1, { label: 'Founder streak', value: '1 day', tone: 'positive' }],
      [7, { label: 'Founder streak', value: '7 days', tone: 'positive' }],
    ]

    for (const [streakDays, badge] of cases) {
      expect(
        progressBadgeForFounderSave({
          ...createDefaultFounderSave(),
          streakDays,
        }),
      ).toEqual(badge)
    }
  })
})
