import type { GameProgressBadge } from '../../../app/routes/types'
import {
  createGameStore,
  type GameSaveCodec,
  type GameStore,
  type GameStoreLoadResult,
  type StorageLike,
} from '../../../shared/persistence/gameStore'

export const RUNNER_SAVE_KEY = 'open-trade:game:wallstreet-surfers'

export interface RunnerSaveV1 {
  readonly schemaVersion: 1
  readonly rulesetVersion: 1
  readonly seed: string
  readonly bestScore: number
  readonly tutorialComplete: boolean
}

const SAVE_KEYS = Object.freeze([
  'schemaVersion',
  'rulesetVersion',
  'seed',
  'bestScore',
  'tutorialComplete',
] as const)
const SEED_PATTERN = /^[a-z0-9_-]{1,64}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value)
  return keys.length === SAVE_KEYS.length
    && SAVE_KEYS.every((key) => Object.hasOwn(value, key))
}

function decodeRunnerSave(value: unknown) {
  if (!isRecord(value) || !hasExactKeys(value)) {
    return { ok: false as const, reason: 'corrupt' }
  }
  if (
    !Number.isSafeInteger(value.schemaVersion)
    || !Number.isSafeInteger(value.rulesetVersion)
  ) {
    return { ok: false as const, reason: 'corrupt' }
  }
  if (value.schemaVersion !== 1 || value.rulesetVersion !== 1) {
    return { ok: false as const, reason: 'incompatible' }
  }
  if (
    typeof value.seed !== 'string'
    || !SEED_PATTERN.test(value.seed)
    || !Number.isSafeInteger(value.bestScore)
    || (value.bestScore as number) < 0
    || typeof value.tutorialComplete !== 'boolean'
  ) {
    return { ok: false as const, reason: 'corrupt' }
  }

  return {
    ok: true as const,
    value: Object.freeze({
      schemaVersion: 1 as const,
      rulesetVersion: 1 as const,
      seed: value.seed,
      bestScore: value.bestScore as number,
      tutorialComplete: value.tutorialComplete,
    }),
  }
}

export const runnerSaveCodec: GameSaveCodec<RunnerSaveV1> = {
  key: RUNNER_SAVE_KEY,
  version: 1,
  encode(value) {
    const decoded = decodeRunnerSave(value)
    if (!decoded.ok) {
      throw new RangeError(`Cannot encode ${decoded.reason} runner save`)
    }
    return { ...decoded.value }
  },
  decode: decodeRunnerSave,
}

function normalizeLoad(
  loaded: GameStoreLoadResult<RunnerSaveV1>,
): GameStoreLoadResult<RunnerSaveV1> {
  return loaded.status === 'recovery-required'
    && loaded.reason === 'corrupt'
    && loaded.detail === 'incompatible'
    ? {
        status: 'recovery-required',
        reason: 'incompatible',
        detail: 'Saved runner rules or schema are incompatible',
      }
    : loaded
}

export function createRunnerStore(storage?: StorageLike): GameStore<RunnerSaveV1> {
  const base = storage === undefined
    ? createGameStore(runnerSaveCodec)
    : createGameStore(runnerSaveCodec, { storage })
  return Object.freeze({
    save: base.save,
    clear: base.clear,
    load: () => normalizeLoad(base.load()),
  })
}

export const runnerStore = createRunnerStore()

export function createRunnerSave(
  seed: string,
  bestScore: number,
  tutorialComplete: boolean,
): RunnerSaveV1 {
  const decoded = decodeRunnerSave({
    schemaVersion: 1,
    rulesetVersion: 1,
    seed,
    bestScore,
    tutorialComplete,
  })
  if (!decoded.ok) throw new RangeError(`Runner save is ${decoded.reason}`)
  return decoded.value
}

export function getRunnerProgressBadge(
  store: GameStore<RunnerSaveV1> = runnerStore,
): GameProgressBadge {
  const loaded = store.load()
  if (loaded.status === 'recovery-required') {
    return Object.freeze({
      label: 'Best score',
      value: 'Reset required',
      tone: 'warning',
    })
  }
  const bestScore = loaded.status === 'ready' ? loaded.value.bestScore : 0
  return Object.freeze({
    label: 'Best score',
    value: bestScore.toLocaleString('en-US'),
    tone: bestScore > 0 ? 'positive' : 'neutral',
  })
}
