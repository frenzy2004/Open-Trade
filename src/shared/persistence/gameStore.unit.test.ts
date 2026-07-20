import { describe, expect, it } from 'vitest'
import {
  createGameStore,
  type GameSaveCodec,
  type GameSaveDecodeResult,
  type GameStoreOptions,
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

  it('preserves envelope metadata and data under a polluted toJSON prototype', () => {
    const storage = new MemoryStorage()
    const store = createGameStore(codec, { storage })
    const originalToJSON = Object.getOwnPropertyDescriptor(
      Object.prototype,
      'toJSON',
    )
    Object.defineProperty(Object.prototype, 'toJSON', {
      configurable: true,
      value() {
        return {
          version: 2,
          savedAt: 'tampered',
          seed: 'tampered',
          data: 999,
        }
      },
    })

    try {
      expect(
        store.save(
          { score: 42 },
          { seed: 'league-77', savedAt: '2026-07-21T00:00:00.000Z' },
        ),
      ).toEqual({ ok: true })
      expect(JSON.parse(storage.getItem(codec.key) ?? '')).toEqual({
        version: 2,
        savedAt: '2026-07-21T00:00:00.000Z',
        seed: 'league-77',
        data: { score: 42 },
      })
    } finally {
      if (originalToJSON === undefined) {
        delete (Object.prototype as { toJSON?: unknown }).toJSON
      } else {
        Object.defineProperty(Object.prototype, 'toJSON', originalToJSON)
      }
    }
  })

  it('preserves nested encoded objects and arrays under a polluted toJSON prototype', () => {
    const storage = new MemoryStorage()
    const encoded = {
      object: { depth: 1 },
      list: [1, 2],
    }
    const store = createGameStore(
      {
        ...codec,
        encode: () => encoded,
      },
      { storage },
    )
    const originalToJSON = Object.getOwnPropertyDescriptor(
      Object.prototype,
      'toJSON',
    )
    Object.defineProperty(Object.prototype, 'toJSON', {
      configurable: true,
      value(this: unknown) {
        if (
          typeof this === 'object' &&
          this !== null &&
          Object.hasOwn(this, 'version') &&
          Object.hasOwn(this, 'savedAt') &&
          Object.hasOwn(this, 'seed') &&
          Object.hasOwn(this, 'data')
        ) {
          return this
        }
        if (this === encoded) {
          return this
        }
        return Array.isArray(this) ? ['polluted'] : { polluted: true }
      },
    })

    try {
      expect(store.save({ score: 1 })).toEqual({ ok: true })
      expect(JSON.parse(storage.getItem(codec.key) ?? '')).toMatchObject({
        data: {
          object: { depth: 1 },
          list: [1, 2],
        },
      })
      expect(encoded).toEqual({
        object: { depth: 1 },
        list: [1, 2],
      })
    } finally {
      if (originalToJSON === undefined) {
        delete (Object.prototype as { toJSON?: unknown }).toJSON
      } else {
        Object.defineProperty(Object.prototype, 'toJSON', originalToJSON)
      }
    }
  })

  it('serializes sparse arrays from their own values only', () => {
    const storage = new MemoryStorage()
    const list = new Array<number>(2)
    list[1] = 2
    const store = createGameStore(
      {
        ...codec,
        encode: () => ({ list }),
      },
      { storage },
    )
    const originalZero = Object.getOwnPropertyDescriptor(Object.prototype, '0')
    Object.defineProperty(Object.prototype, '0', {
      configurable: true,
      value: 'polluted',
      writable: true,
    })

    try {
      expect(store.save({ score: 1 })).toEqual({ ok: true })
      expect(JSON.parse(storage.getItem(codec.key) ?? '')).toMatchObject({
        data: { list: [null, 2] },
      })
    } finally {
      if (originalZero === undefined) {
        delete (Object.prototype as { 0?: unknown })[0]
      } else {
        Object.defineProperty(Object.prototype, '0', originalZero)
      }
    }
  })

  it('ignores an inherited Object.prototype.storage option', () => {
    const inheritedStorage = new MemoryStorage()
    const originalStorage = Object.getOwnPropertyDescriptor(
      Object.prototype,
      'storage',
    )
    Object.defineProperty(Object.prototype, 'storage', {
      configurable: true,
      value: inheritedStorage,
    })

    try {
      createGameStore(codec).save({ score: 1 })
      expect(inheritedStorage.getItem(codec.key)).toBeNull()
    } finally {
      if (originalStorage === undefined) {
        delete (Object.prototype as { storage?: unknown }).storage
      } else {
        Object.defineProperty(Object.prototype, 'storage', originalStorage)
      }
    }
  })

  it('ignores inherited now and migrations options', () => {
    const storage = new MemoryStorage()
    let migrationCalls = 0
    const originalNow = Object.getOwnPropertyDescriptor(Object.prototype, 'now')
    const originalMigrations = Object.getOwnPropertyDescriptor(
      Object.prototype,
      'migrations',
    )
    Object.defineProperty(Object.prototype, 'now', {
      configurable: true,
      value: () => new Date('2000-01-01T00:00:00.000Z'),
    })
    Object.defineProperty(Object.prototype, 'migrations', {
      configurable: true,
      value: {
        0: () => {
          migrationCalls += 1
          return { score: 40 }
        },
        1: (data: unknown) => data,
      },
    })

    try {
      const store = createGameStore(codec, { storage })
      expect(store.save({ score: 1 })).toEqual({ ok: true })
      expect(JSON.parse(storage.getItem(codec.key) ?? '')).toMatchObject({
        savedAt: expect.not.stringMatching('2000-01-01'),
      })
      storage.setItem(
        codec.key,
        JSON.stringify({
          version: 0,
          savedAt: '2026-07-20T00:00:00.000Z',
          seed: null,
          data: { points: 4 },
        }),
      )
      expect(store.load()).toMatchObject({
        status: 'recovery-required',
        reason: 'incompatible',
      })
      expect(migrationCalls).toBe(0)
    } finally {
      if (originalNow === undefined) {
        delete (Object.prototype as { now?: unknown }).now
      } else {
        Object.defineProperty(Object.prototype, 'now', originalNow)
      }
      if (originalMigrations === undefined) {
        delete (Object.prototype as { migrations?: unknown }).migrations
      } else {
        Object.defineProperty(
          Object.prototype,
          'migrations',
          originalMigrations,
        )
      }
    }
  })

  it('ignores an inherited numeric migration', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      codec.key,
      JSON.stringify({
        version: 0,
        savedAt: '2026-07-20T00:00:00.000Z',
        seed: null,
        data: { points: 4 },
      }),
    )
    const originalMigration = Object.getOwnPropertyDescriptor(
      Object.prototype,
      '0',
    )
    let migrationCalls = 0
    Object.defineProperty(Object.prototype, '0', {
      configurable: true,
      value: () => {
        migrationCalls += 1
        return { score: 40 }
      },
      writable: true,
    })

    try {
      expect(
        createGameStore(codec, { storage, migrations: {} }).load(),
      ).toMatchObject({
        status: 'recovery-required',
        reason: 'incompatible',
      })
      expect(migrationCalls).toBe(0)
    } finally {
      if (originalMigration === undefined) {
        delete (Object.prototype as { 0?: unknown })[0]
      } else {
        Object.defineProperty(Object.prototype, '0', originalMigration)
      }
    }
  })

  it('contains throwing option proxies and accessors', () => {
    const proxyOptions = new Proxy(
      {},
      {
        get() {
          throw new Error('option read failed')
        },
        getOwnPropertyDescriptor() {
          throw new Error('option lookup failed')
        },
      },
    ) as GameStoreOptions
    const accessorOptions = {}
    Object.defineProperty(accessorOptions, 'now', {
      get() {
        throw new Error('now read failed')
      },
    })

    expect(() => createGameStore(codec, proxyOptions)).not.toThrow()
    expect(() => createGameStore(codec, accessorOptions)).not.toThrow()
    expect(createGameStore(codec, proxyOptions).load()).toMatchObject({
      status: 'recovery-required',
      reason: 'storage-unavailable',
    })
    expect(createGameStore(codec, accessorOptions).load()).toMatchObject({
      status: 'recovery-required',
      reason: 'storage-unavailable',
    })
  })

  it('contains throwing migration accessors and proxies', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      codec.key,
      JSON.stringify({
        version: 0,
        savedAt: '2026-07-20T00:00:00.000Z',
        seed: null,
        data: { points: 4 },
      }),
    )
    const migrationAccessorOptions = { storage }
    Object.defineProperty(migrationAccessorOptions, 'migrations', {
      get() {
        throw new Error('migrations read failed')
      },
    })
    const migrationProxy = new Proxy(
      {},
      {
        get() {
          throw new Error('migration read failed')
        },
        getOwnPropertyDescriptor() {
          throw new Error('migration lookup failed')
        },
      },
    )

    expect(() => createGameStore(codec, migrationAccessorOptions)).not.toThrow()
    expect(
      createGameStore(codec, migrationAccessorOptions).load(),
    ).toMatchObject({
      status: 'recovery-required',
      reason: 'storage-unavailable',
    })
    const proxyStore = createGameStore(codec, {
      storage,
      migrations: migrationProxy,
    })
    expect(() => proxyStore.load()).not.toThrow()
    expect(proxyStore.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'incompatible',
    })
  })

  it.each([
    new Date('2026-07-21T00:00:00.000Z'),
    Object.defineProperty({}, 'toJSON', {
      value() {
        return { score: 1 }
      },
    }),
    new (class extends Array<number> {})(),
  ])('rejects unsupported encoded values %#', (encoded) => {
    const storage = new MemoryStorage()
    const store = createGameStore(
      {
        ...codec,
        encode: () => encoded,
      },
      { storage },
    )

    expect(store.save({ score: 1 })).toEqual({
      ok: false,
      reason: 'encode-failed',
    })
    expect(storage.getItem(codec.key)).toBeNull()
  })

  it('serializes plain and null-prototype encoded records without mutation', () => {
    const storage = new MemoryStorage()
    const plain = { score: 1 }
    const nullPrototype = Object.assign(Object.create(null), { bonus: 2 })
    const store = createGameStore(
      {
        ...codec,
        encode: () => ({ plain, nullPrototype }),
      },
      { storage },
    )

    expect(store.save({ score: 1 })).toEqual({ ok: true })
    expect(JSON.parse(storage.getItem(codec.key) ?? '')).toMatchObject({
      data: { plain: { score: 1 }, nullPrototype: { bonus: 2 } },
    })
    expect(plain).toEqual({ score: 1 })
    expect(Object.getPrototypeOf(plain)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(nullPrototype)).toBeNull()
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

  it('contains a decoder value getter that throws after validation', () => {
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
        decode: () =>
          ({
            ok: true,
            get value() {
              throw new Error('value getter failed')
            },
          }) as unknown as GameSaveDecodeResult<DemoState>,
      },
      { storage },
    )

    expect(store.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
      detail: 'Saved data could not be decoded',
    })
  })

  it('contains a decoder reason getter that throws after validation', () => {
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
    let reasonReads = 0
    const store = createGameStore(
      {
        ...codec,
        decode: () =>
          ({
            ok: false,
            get reason() {
              reasonReads += 1
              if (reasonReads === 1) {
                return 'invalid score'
              }
              throw new Error('reason getter failed')
            },
          }) as unknown as GameSaveDecodeResult<DemoState>,
      },
      { storage },
    )

    expect(store.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
      detail: 'invalid score',
    })
  })

  it('contains a stateful decoder ok getter after validation', () => {
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
    let okReads = 0
    const store = createGameStore(
      {
        ...codec,
        decode: () =>
          ({
            get ok() {
              okReads += 1
              if (okReads < 3) {
                return true
              }
              throw new Error('ok getter failed')
            },
            value: { score: 1 },
          }) as unknown as GameSaveDecodeResult<DemoState>,
      },
      { storage },
    )

    expect(store.load()).toEqual({
      status: 'ready',
      value: { score: 1 },
      seed: null,
      savedAt: '2026-07-21T00:00:00.000Z',
      migrated: false,
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
