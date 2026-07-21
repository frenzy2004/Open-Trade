import {
  createGameStore,
  type GameSaveCodec,
  type GameStore,
  type StorageLike,
} from '../persistence/gameStore'

export interface AppSettings {
  readonly muted: boolean
  readonly reducedMotion: boolean
  readonly volume: number
}

export const DEFAULT_SETTINGS: AppSettings = Object.freeze({
  muted: false,
  reducedMotion: false,
  volume: 0.7,
})

export const SETTINGS_SAVE_KEY = 'open-trade:settings'

function isSettingsRecord(value: unknown): value is AppSettings {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    Object.hasOwn(record, 'muted') &&
    typeof record.muted === 'boolean' &&
    Object.hasOwn(record, 'reducedMotion') &&
    typeof record.reducedMotion === 'boolean' &&
    Object.hasOwn(record, 'volume') &&
    typeof record.volume === 'number' &&
    Number.isFinite(record.volume) &&
    record.volume >= 0 &&
    record.volume <= 1
  )
}

const settingsCodec: GameSaveCodec<AppSettings> = {
  key: SETTINGS_SAVE_KEY,
  version: 2,
  encode: (value) => ({
    muted: value.muted,
    reducedMotion: value.reducedMotion,
    volume: value.volume,
  }),
  decode: (value) => {
    if (isSettingsRecord(value)) {
      return {
        ok: true,
        value: {
          muted: value.muted,
          reducedMotion: value.reducedMotion,
          volume: value.volume,
        },
      }
    }
    return { ok: false, reason: 'Settings fields are invalid' }
  },
}

function migrateVersionZero(value: unknown): AppSettings {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_SETTINGS
  }

  const record = value as Record<string, unknown>
  if (
    Object.hasOwn(record, 'soundEnabled') &&
    typeof record.soundEnabled === 'boolean' &&
    Object.hasOwn(record, 'reduceMotion') &&
    typeof record.reduceMotion === 'boolean'
  ) {
    return {
      muted: !record.soundEnabled,
      reducedMotion: record.reduceMotion,
      volume: DEFAULT_SETTINGS.volume,
    }
  }
  return DEFAULT_SETTINGS
}

function migrateVersionOne(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const record = value as Record<string, unknown>
  if (
    Object.hasOwn(record, 'muted')
    && typeof record.muted === 'boolean'
    && Object.hasOwn(record, 'reducedMotion')
    && typeof record.reducedMotion === 'boolean'
  ) {
    return {
      muted: record.muted,
      reducedMotion: record.reducedMotion,
      volume: DEFAULT_SETTINGS.volume,
    }
  }
  return value
}

export function createSettingsStore(
  storage?: StorageLike,
): GameStore<AppSettings> {
  const migrations = { 0: migrateVersionZero, 1: migrateVersionOne }

  return storage === undefined
    ? createGameStore(settingsCodec, { migrations })
    : createGameStore(settingsCodec, { storage, migrations })
}
