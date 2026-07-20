import { describe, expect, it } from 'vitest'
import {
  createGameStore,
  type GameSaveCodec,
  type GameSaveDecodeResult,
  type StorageLike,
} from './gameStore'

interface DemoState {
  score: number
}

class MemoryStorage implements StorageLike {
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

const codec: GameSaveCodec<DemoState> = {
  key: 'open-trade:test',
  version: 2,
  encode: (value) => ({ score: value.score }),
  decode: (value) => {
    if (
      typeof value === 'object' &&
      value !== null &&
      'score' in value &&
      typeof value.score === 'number'
    ) {
      return { ok: true, value: { score: value.score } }
    }
    return { ok: false, reason: 'score must be a number' }
  },
}

describe('createGameStore', () => {
  it('returns empty when no save exists', () => {
    const store = createGameStore(codec, {
      storage: new MemoryStorage(),
    })

    expect(store.load()).toEqual({ status: 'empty' })
  })

  it('round-trips encoded state, seed, and timestamp', () => {
    const storage = new MemoryStorage()
    const store = createGameStore(codec, {
      storage,
      now: () => new Date('2026-07-21T00:00:00.000Z'),
    })

    expect(store.save({ score: 42 }, { seed: 'league-77' })).toEqual({ ok: true })
    expect(store.load()).toEqual({
      status: 'ready',
      value: { score: 42 },
      seed: 'league-77',
      savedAt: '2026-07-21T00:00:00.000Z',
      migrated: false,
    })
  })

  it('migrates each older version before decoding', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      codec.key,
      JSON.stringify({
        version: 0,
        savedAt: '2026-07-20T00:00:00.000Z',
        seed: 'legacy-5',
        data: { points: 4 },
      }),
    )
    const store = createGameStore(codec, {
      storage,
      migrations: {
        0: (data) => {
          const points =
            typeof data === 'object' &&
            data !== null &&
            'points' in data &&
            typeof data.points === 'number'
              ? data.points
              : 0
          return { score: points * 10 }
        },
        1: (data) => data,
      },
    })

    const result = store.load()
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.value).toEqual({ score: 40 })
      expect(result.migrated).toBe(true)
    }
  })

  it('returns recovery-required for invalid JSON and future versions', () => {
    const corruptStorage = new MemoryStorage()
    corruptStorage.setItem(codec.key, '{not-json')
    const futureStorage = new MemoryStorage()
    futureStorage.setItem(
      codec.key,
      JSON.stringify({
        version: 99,
        savedAt: '2026-07-21T00:00:00.000Z',
        seed: null,
        data: { score: 1 },
      }),
    )

    expect(
      createGameStore(codec, { storage: corruptStorage }).load(),
    ).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
    })
    expect(
      createGameStore(codec, { storage: futureStorage }).load(),
    ).toMatchObject({
      status: 'recovery-required',
      reason: 'incompatible',
    })
  })

  it('returns recovery-required for malformed saves and codec failures', () => {
    const malformedStorage = new MemoryStorage()
    malformedStorage.setItem(codec.key, JSON.stringify({ version: 2 }))
    const codecFailureStorage = new MemoryStorage()
    codecFailureStorage.setItem(
      codec.key,
      JSON.stringify({
        version: 2,
        savedAt: '2026-07-21T00:00:00.000Z',
        seed: null,
        data: { score: 'not-a-number' },
      }),
    )

    expect(
      createGameStore(codec, { storage: malformedStorage }).load(),
    ).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
    })
    expect(
      createGameStore(codec, { storage: codecFailureStorage }).load(),
    ).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
      detail: 'score must be a number',
    })
  })

  it('does not save an envelope when encoding omits its data', () => {
    const storage = new MemoryStorage()
    const store = createGameStore(
      {
        ...codec,
        encode: () => undefined,
      },
      { storage },
    )

    expect(store.save({ score: 1 })).toEqual({
      ok: false,
      reason: 'encode-failed',
    })
    expect(storage.getItem(codec.key)).toBeNull()
  })

  it('converts thrown codec decoding errors into recovery-required', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      codec.key,
      JSON.stringify({
        version: 2,
        savedAt: '2026-07-21T00:00:00.000Z',
        seed: null,
        data: { score: 1 },
      }),
    )
    const store = createGameStore(
      {
        ...codec,
        decode: () => {
          throw new Error('unexpected codec failure')
        },
      },
      { storage },
    )

    expect(store.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
      detail: 'Saved data could not be decoded',
    })
  })

  it('rejects an envelope whose data exists only on Object.prototype', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      codec.key,
      JSON.stringify({
        version: 2,
        savedAt: '2026-07-21T00:00:00.000Z',
        seed: null,
      }),
    )
    Object.defineProperty(Object.prototype, 'data', {
      configurable: true,
      value: { score: 42 },
    })

    try {
      const storeWithUndefinedEncoding = createGameStore(
        {
          ...codec,
          encode: () => undefined,
        },
        { storage },
      )
      expect(storeWithUndefinedEncoding.save({ score: 1 })).toEqual({
        ok: false,
        reason: 'encode-failed',
      })
      expect(createGameStore(codec, { storage }).load()).toMatchObject({
        status: 'recovery-required',
        reason: 'corrupt',
        detail: 'Saved envelope is malformed',
      })
    } finally {
      delete (Object.prototype as { data?: unknown }).data
    }
  })

  it.each([
    undefined,
    {},
    { ok: false },
    { ok: false, reason: 1 },
    { ok: true },
  ])('rejects invalid runtime decode result %#', (invalidResult) => {
    const storage = new MemoryStorage()
    storage.setItem(
      codec.key,
      JSON.stringify({
        version: 2,
        savedAt: '2026-07-21T00:00:00.000Z',
        seed: null,
        data: { score: 1 },
      }),
    )
    const store = createGameStore(
      {
        ...codec,
        decode: () => invalidResult as GameSaveDecodeResult<DemoState>,
      },
      { storage },
    )

    expect(store.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
      detail: 'Saved data could not be decoded',
    })
  })

  it('does not throw when browser storage is unavailable', () => {
    const unavailable: StorageLike = {
      getItem() {
        throw new Error('denied')
      },
      setItem() {
        throw new Error('denied')
      },
      removeItem() {
        throw new Error('denied')
      },
    }
    const store = createGameStore(codec, { storage: unavailable })

    expect(store.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'storage-unavailable',
    })
    expect(store.save({ score: 1 })).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    })
    expect(store.clear()).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    })
  })
})
