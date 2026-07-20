export type GameSaveDecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string }

export interface GameSaveCodec<T> {
  readonly key: string
  readonly version: number
  encode(value: T): unknown
  decode(value: unknown): GameSaveDecodeResult<T>
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type GameStoreLoadResult<T> =
  | { readonly status: 'empty' }
  | {
      readonly status: 'ready'
      readonly value: T
      readonly seed: string | null
      readonly savedAt: string
      readonly migrated: boolean
    }
  | {
      readonly status: 'recovery-required'
      readonly reason: 'corrupt' | 'incompatible' | 'storage-unavailable'
      readonly detail: string
    }

export type GameStoreWriteResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: 'encode-failed' | 'storage-unavailable'
    }

export interface GameStoreSaveMetadata {
  readonly seed?: string | null
  readonly savedAt?: string
}

export interface GameStore<T> {
  load(): GameStoreLoadResult<T>
  save(value: T, metadata?: GameStoreSaveMetadata): GameStoreWriteResult
  clear(): GameStoreWriteResult
}

export type GameSaveMigration = (data: unknown) => unknown

export interface GameStoreOptions {
  readonly storage?: StorageLike | null
  readonly now?: () => Date
  readonly migrations?: Readonly<Record<number, GameSaveMigration>>
}

interface SaveEnvelope {
  version: number
  savedAt: string
  seed: string | null
  data: unknown
}

const omittedFromJson = Symbol('omittedFromJson')

function snapshotJsonData(
  value: unknown,
  ancestors = new WeakSet<object>(),
): unknown | typeof omittedFromJson {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value
    case 'number':
      return Number.isFinite(value) ? value : null
    case 'undefined':
    case 'function':
    case 'symbol':
      return omittedFromJson
    case 'bigint':
      throw new TypeError('BigInt values cannot be stored as JSON')
    case 'object':
      if (value === null) {
        return null
      }
      if (ancestors.has(value)) {
        throw new TypeError('Cyclic values cannot be stored as JSON')
      }

      ancestors.add(value)
      try {
        if (Array.isArray(value)) {
          const length = value.length
          const snapshot: unknown[] = new Array(length)
          Object.setPrototypeOf(snapshot, null)
          Object.defineProperty(snapshot, 'toJSON', { value: undefined })
          for (let index = 0; index < length; index += 1) {
            if (!Object.hasOwn(value, index)) {
              snapshot[index] = null
              continue
            }
            const item = snapshotJsonData(value[index], ancestors)
            snapshot[index] = item === omittedFromJson ? null : item
          }
          return snapshot
        }

        const snapshot = Object.create(null) as Record<string, unknown>
        for (const key of Object.keys(value)) {
          const item = snapshotJsonData(
            (value as Record<string, unknown>)[key],
            ancestors,
          )
          if (item !== omittedFromJson) {
            snapshot[key] = item
          }
        }
        return snapshot
      } finally {
        ancestors.delete(value)
      }
  }
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isSaveEnvelope(value: unknown): value is SaveEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const envelope = value as Record<string, unknown>
  return (
    Object.hasOwn(envelope, 'version') &&
    typeof envelope.version === 'number' &&
    Number.isInteger(envelope.version) &&
    Object.hasOwn(envelope, 'savedAt') &&
    typeof envelope.savedAt === 'string' &&
    Object.hasOwn(envelope, 'seed') &&
    (envelope.seed === null || typeof envelope.seed === 'string') &&
    Object.hasOwn(envelope, 'data')
  )
}

function normalizeGameSaveDecodeResult<T>(
  value: unknown,
): GameSaveDecodeResult<T> | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const result = value as Record<string, unknown>
  if (!Object.hasOwn(result, 'ok')) {
    return null
  }

  const ok = result.ok
  if (typeof ok !== 'boolean') {
    return null
  }

  if (ok) {
    if (!Object.hasOwn(result, 'value')) {
      return null
    }
    return { ok: true, value: result.value as T }
  }

  if (!Object.hasOwn(result, 'reason')) {
    return null
  }
  const reason = result.reason
  return typeof reason === 'string' ? { ok: false, reason } : null
}

function recovery(
  reason: 'corrupt' | 'incompatible' | 'storage-unavailable',
  detail: string,
): GameStoreLoadResult<never> {
  return { status: 'recovery-required', reason, detail }
}

export function createGameStore<T>(
  codec: GameSaveCodec<T>,
  options: GameStoreOptions = {},
): GameStore<T> {
  if (!Number.isInteger(codec.version) || codec.version < 1) {
    throw new RangeError('Game save codec version must be a positive integer')
  }

  const storage =
    options.storage === undefined ? getBrowserStorage() : options.storage
  const now = options.now ?? (() => new Date())

  const save: GameStore<T>['save'] = (value, metadata = {}) => {
    if (storage === null) {
      return { ok: false, reason: 'storage-unavailable' }
    }

    let serialized: string
    try {
      const data = snapshotJsonData(codec.encode(value))
      if (data === omittedFromJson) {
        return { ok: false, reason: 'encode-failed' }
      }
      const envelope = Object.create(null) as SaveEnvelope
      envelope.version = codec.version
      envelope.savedAt = metadata.savedAt ?? now().toISOString()
      envelope.seed = metadata.seed ?? null
      envelope.data = data
      serialized = JSON.stringify(envelope)
      if (!isSaveEnvelope(JSON.parse(serialized) as unknown)) {
        return { ok: false, reason: 'encode-failed' }
      }
    } catch {
      return { ok: false, reason: 'encode-failed' }
    }

    try {
      storage.setItem(codec.key, serialized)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'storage-unavailable' }
    }
  }

  return {
    load() {
      if (storage === null) {
        return recovery(
          'storage-unavailable',
          'Browser storage is not available',
        )
      }

      let raw: string | null
      try {
        raw = storage.getItem(codec.key)
      } catch {
        return recovery(
          'storage-unavailable',
          'Browser storage could not be read',
        )
      }

      if (raw === null) {
        return { status: 'empty' }
      }

      let envelope: unknown
      try {
        envelope = JSON.parse(raw) as unknown
      } catch {
        return recovery('corrupt', 'Saved JSON could not be parsed')
      }

      if (!isSaveEnvelope(envelope)) {
        return recovery('corrupt', 'Saved envelope is malformed')
      }

      if (envelope.version > codec.version) {
        return recovery(
          'incompatible',
          'Saved version is newer than this application',
        )
      }

      let version = envelope.version
      let data = envelope.data
      let migrated = false

      while (version < codec.version) {
        const migrate = options.migrations?.[version]
        if (migrate === undefined) {
          return recovery(
            'incompatible',
            'No migration exists for save version ' + String(version),
          )
        }
        try {
          data = migrate(data)
        } catch {
          return recovery(
            'corrupt',
            'Migration failed for save version ' + String(version),
          )
        }
        version += 1
        migrated = true
      }

      let decoded: GameSaveDecodeResult<T>
      try {
        const result = codec.decode(data)
        const normalized = normalizeGameSaveDecodeResult<T>(result)
        if (normalized === null) {
          return recovery('corrupt', 'Saved data could not be decoded')
        }
        decoded = normalized
      } catch {
        return recovery('corrupt', 'Saved data could not be decoded')
      }
      if (!decoded.ok) {
        return recovery('corrupt', decoded.reason)
      }

      if (migrated) {
        save(decoded.value, {
          seed: envelope.seed,
          savedAt: envelope.savedAt,
        })
      }

      return {
        status: 'ready',
        value: decoded.value,
        seed: envelope.seed,
        savedAt: envelope.savedAt,
        migrated,
      }
    },
    save,
    clear() {
      if (storage === null) {
        return { ok: false, reason: 'storage-unavailable' }
      }
      try {
        storage.removeItem(codec.key)
        return { ok: true }
      } catch {
        return { ok: false, reason: 'storage-unavailable' }
      }
    },
  }
}

export function clearStoredGame(
  key: string,
  storage: StorageLike | null = getBrowserStorage(),
): GameStoreWriteResult {
  if (storage === null) {
    return { ok: false, reason: 'storage-unavailable' }
  }
  try {
    storage.removeItem(key)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'storage-unavailable' }
  }
}
