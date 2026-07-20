import {
  createGameStore,
  type GameSaveCodec,
  type StorageLike,
} from '../../shared/persistence/gameStore'
import type { GameId, GameProgressBadge } from './types'

type ProgressState = Readonly<Record<GameId, GameProgressBadge>>

function createBadge(
  label: string,
  value: string,
  tone: GameProgressBadge['tone'],
): GameProgressBadge {
  return Object.freeze({ label, value, tone })
}

function createDefaultProgress(): ProgressState {
  return Object.freeze({
    fanstocks: createBadge('League', 'No active league', 'neutral'),
    'founder-mode': createBadge('Founder streak', '0 days', 'neutral'),
    'wallstreet-surfers': createBadge('Best score', '0', 'neutral'),
  })
}

function createProgressSnapshot(value: Record<GameId, GameProgressBadge>): ProgressState {
  return Object.freeze({
    fanstocks: createBadge(
      value.fanstocks.label,
      value.fanstocks.value,
      value.fanstocks.tone,
    ),
    'founder-mode': createBadge(
      value['founder-mode'].label,
      value['founder-mode'].value,
      value['founder-mode'].tone,
    ),
    'wallstreet-surfers': createBadge(
      value['wallstreet-surfers'].label,
      value['wallstreet-surfers'].value,
      value['wallstreet-surfers'].tone,
    ),
  })
}

export const DEFAULT_PROGRESS: ProgressState = createDefaultProgress()

const PROGRESS_EVENT = 'open-trade:progress-changed'
const PROGRESS_SAVE_KEY = 'open-trade:hub-progress'
const TONES = new Set<GameProgressBadge['tone']>([
  'neutral',
  'positive',
  'warning',
])

function isBadge(value: unknown): value is GameProgressBadge {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const badge = value as Record<string, unknown>
  return (
    Object.hasOwn(badge, 'label') &&
    typeof badge.label === 'string' &&
    Object.hasOwn(badge, 'value') &&
    typeof badge.value === 'string' &&
    Object.hasOwn(badge, 'tone') &&
    typeof badge.tone === 'string' &&
    TONES.has(badge.tone as GameProgressBadge['tone'])
  )
}

const progressCodec: GameSaveCodec<ProgressState> = {
  key: PROGRESS_SAVE_KEY,
  version: 1,
  encode: (value) => value,
  decode: (value) => {
    if (typeof value !== 'object' || value === null) {
      return { ok: false, reason: 'Hub progress fields are invalid' }
    }

    const progress = value as Record<string, unknown>
    if (
      !Object.hasOwn(progress, 'fanstocks') ||
      !isBadge(progress.fanstocks) ||
      !Object.hasOwn(progress, 'founder-mode') ||
      !isBadge(progress['founder-mode']) ||
      !Object.hasOwn(progress, 'wallstreet-surfers') ||
      !isBadge(progress['wallstreet-surfers'])
    ) {
      return { ok: false, reason: 'Hub progress fields are invalid' }
    }

    return {
      ok: true,
      value: createProgressSnapshot({
        fanstocks: progress.fanstocks,
        'founder-mode': progress['founder-mode'],
        'wallstreet-surfers': progress['wallstreet-surfers'],
      }),
    }
  },
}

export interface ProgressStore {
  read(id: GameId): GameProgressBadge
  readAll(): ProgressState
  set(id: GameId, badge: GameProgressBadge): void
  reset(id: GameId): void
  resetAll(): void
}

export function createProgressStore(storage?: StorageLike): ProgressStore {
  const store =
    storage === undefined
      ? createGameStore(progressCodec)
      : createGameStore(progressCodec, { storage })

  const readAll = (): ProgressState => {
    const result = store.load()
    if (result.status !== 'ready') {
      return createDefaultProgress()
    }
    return createProgressSnapshot(result.value)
  }

  return {
    read: (id) => readAll()[id],
    readAll,
    set(id, badge) {
      store.save(
        createProgressSnapshot({
          ...readAll(),
          [id]: badge,
        }),
      )
    },
    reset(id) {
      store.save(
        createProgressSnapshot({
          ...readAll(),
          [id]: DEFAULT_PROGRESS[id],
        }),
      )
    },
    resetAll() {
      store.save(createDefaultProgress())
    },
  }
}

const browserProgressStore = createProgressStore()

function announceProgressChange(): void {
  window.dispatchEvent(new Event(PROGRESS_EVENT))
}

export function readGameProgress(id: GameId): GameProgressBadge {
  return browserProgressStore.read(id)
}

export function setGameProgress(
  id: GameId,
  badge: GameProgressBadge,
): void {
  browserProgressStore.set(id, badge)
  announceProgressChange()
}

export function resetGameProgress(id: GameId): void {
  browserProgressStore.reset(id)
  announceProgressChange()
}

export function resetAllGameProgress(): void {
  browserProgressStore.resetAll()
  announceProgressChange()
}

export function subscribeToGameProgress(listener: () => void): () => void {
  window.addEventListener(PROGRESS_EVENT, listener)
  return () => window.removeEventListener(PROGRESS_EVENT, listener)
}
