import {
  createGameStore,
  type GameSaveCodec,
  type GameStore,
  type StorageLike,
} from '../persistence/gameStore'

export interface AppSettings {
  readonly muted: boolean
  readonly reducedMotion: boolean
}

export const DEFAULT_SETTINGS: AppSettings = Object.freeze({
  muted: false,
  reducedMotion: false,
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
    typeof record.reducedMotion === 'boolean'
  )
}

const settingsCodec: GameSaveCodec<AppSettings> = {
  key: SETTINGS_SAVE_KEY,
  version: 1,
  encode: (value) => ({
    muted: value.muted,
    reducedMotion: value.reducedMotion,
  }),
  decode: (value) => {
    if (isSettingsRecord(value)) {
      return {
        ok: true,
        value: {
          muted: value.muted,
          reducedMotion: value.reducedMotion,
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
    }
  }
  return DEFAULT_SETTINGS
}

export function createSettingsStore(
  storage?: StorageLike,
): GameStore<AppSettings> {
  const migrations = { 0: migrateVersionZero }

  return storage === undefined
    ? createGameStore(settingsCodec, { migrations })
    : createGameStore(settingsCodec, { storage, migrations })
}
