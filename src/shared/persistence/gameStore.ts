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

function isGameSaveDecodeResult<T>(
  value: unknown,
): value is GameSaveDecodeResult<T> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const result = value as Record<string, unknown>
  if (!Object.hasOwn(result, 'ok') || typeof result.ok !== 'boolean') {
    return false
  }

  return result.ok
    ? Object.hasOwn(result, 'value')
    : Object.hasOwn(result, 'reason') && typeof result.reason === 'string'
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
      const envelope: SaveEnvelope = {
        version: codec.version,
        savedAt: metadata.savedAt ?? now().toISOString(),
        seed: metadata.seed ?? null,
        data: codec.encode(value),
      }
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
        if (!isGameSaveDecodeResult<T>(result)) {
          return recovery('corrupt', 'Saved data could not be decoded')
        }
        decoded = result
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
