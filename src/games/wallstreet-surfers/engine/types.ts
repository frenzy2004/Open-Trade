export const FIXED_STEP_MS = 1000 / 60
export const START_SPEED_MPS = 8.5
export const MAX_SPEED_MPS = 22
export const SPEED_STEP_MPS = 0.12
export const SPEED_STEP_DISTANCE_M = 100
export const INITIAL_POWELL_GAP = 60

export type Lane = -1 | 0 | 1
export type RunnerPhase = 'tutorial' | 'running' | 'paused' | 'gameOver'
export type RunnerVertical = 'grounded' | 'jumping' | 'rolling'
export type RunnerCommand =
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'JUMP'
  | 'ROLL'
  | 'PAUSE'
  | 'RESTART'

export type RunnerFailureKind = 'barrier' | 'overhead' | 'train' | 'powell'

export interface RunnerFailure {
  kind: RunnerFailureKind
  message: string
  tip: string
  ticker?: string
}

export interface RunnerEntity {
  id: string
  kind: string
  distanceM: number
  resolved: boolean
}

export interface RunnerConfig {
  seed: string
  reducedMotion: boolean
  bestScore?: number
}

export interface RunnerState {
  seed: string
  phase: RunnerPhase
  elapsedMs: number
  distanceM: number
  speedMps: number
  lane: Lane
  vertical: RunnerVertical
  verticalUntilMs: number
  score: number
  bestScore: number
  coins: number
  streak: number
  powellGap: number
  entities: RunnerEntity[]
  nextSpawnIndex: number
  lastFailure: RunnerFailure | null
  reducedMotion: boolean
  tick: number
  simulationRemainderMs: number
}

const SEED_PATTERN = /^[a-z0-9_-]{1,64}$/i
const PHASES: readonly RunnerPhase[] = [
  'tutorial',
  'running',
  'paused',
  'gameOver',
]
const VERTICAL_STATES: readonly RunnerVertical[] = [
  'grounded',
  'jumping',
  'rolling',
]
const COMMANDS: readonly RunnerCommand[] = [
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'JUMP',
  'ROLL',
  'PAUSE',
  'RESTART',
]
const FAILURE_KINDS: readonly RunnerFailureKind[] = [
  'barrier',
  'overhead',
  'train',
  'powell',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function assertEntity(entity: unknown, index: number): asserts entity is RunnerEntity {
  const prefix = `Runner state entities[${index}]`
  if (!isRecord(entity)) throw new TypeError(`${prefix} must be an object`)
  if (!isNonEmptyString(entity.id)) throw new TypeError(`${prefix}.id must be a non-empty string`)
  if (!isNonEmptyString(entity.kind)) throw new TypeError(`${prefix}.kind must be a non-empty string`)
  if (!isFiniteNonNegative(entity.distanceM)) {
    throw new RangeError(`${prefix}.distanceM must be finite and non-negative`)
  }
  if (typeof entity.resolved !== 'boolean') {
    throw new TypeError(`${prefix}.resolved must be a boolean`)
  }
}

function assertFailure(failure: unknown): asserts failure is RunnerFailure {
  if (!isRecord(failure)) throw new TypeError('Runner state lastFailure must be an object or null')
  if (!FAILURE_KINDS.includes(failure.kind as RunnerFailureKind)) {
    throw new TypeError('Runner state lastFailure.kind is invalid')
  }
  if (!isNonEmptyString(failure.message)) {
    throw new TypeError('Runner state lastFailure.message must be a non-empty string')
  }
  if (!isNonEmptyString(failure.tip)) {
    throw new TypeError('Runner state lastFailure.tip must be a non-empty string')
  }
  if (failure.ticker !== undefined && !isNonEmptyString(failure.ticker)) {
    throw new TypeError('Runner state lastFailure.ticker must be a non-empty string')
  }
}

export function assertRunnerConfig(config: unknown): asserts config is RunnerConfig {
  if (!isRecord(config)) throw new TypeError('Runner config must be an object')
  if (typeof config.seed !== 'string' || !SEED_PATTERN.test(config.seed)) {
    throw new TypeError('Runner config seed must match challenge seed format')
  }
  if (typeof config.reducedMotion !== 'boolean') {
    throw new TypeError('Runner config reducedMotion must be a boolean')
  }
  if (config.bestScore !== undefined && !isSafeNonNegativeInteger(config.bestScore)) {
    throw new RangeError('Runner config bestScore must be a non-negative safe integer')
  }
}

export function assertRunnerCommands(
  commands: unknown,
): asserts commands is readonly RunnerCommand[] {
  if (!Array.isArray(commands)) throw new TypeError('Runner commands must be an array')
  for (const command of commands) {
    if (!COMMANDS.includes(command as RunnerCommand)) {
      throw new TypeError('Runner commands contain an invalid command')
    }
  }
}

export function assertRunnerState(state: unknown): asserts state is RunnerState {
  if (!isRecord(state)) throw new TypeError('Runner state must be an object')
  if (typeof state.seed !== 'string' || !SEED_PATTERN.test(state.seed)) {
    throw new TypeError('Runner state seed must match challenge seed format')
  }
  if (!PHASES.includes(state.phase as RunnerPhase)) {
    throw new TypeError('Runner state phase is invalid')
  }
  if (!isFiniteNonNegative(state.elapsedMs)) {
    throw new RangeError('Runner state elapsedMs must be finite and non-negative')
  }
  if (!isFiniteNonNegative(state.distanceM)) {
    throw new RangeError('Runner state distanceM must be finite and non-negative')
  }
  if (
    typeof state.speedMps !== 'number'
    || !Number.isFinite(state.speedMps)
    || state.speedMps < START_SPEED_MPS
    || state.speedMps > MAX_SPEED_MPS
  ) {
    throw new RangeError(`Runner state speedMps must be between ${START_SPEED_MPS} and ${MAX_SPEED_MPS}`)
  }
  if (state.lane !== -1 && state.lane !== 0 && state.lane !== 1) {
    throw new RangeError('Runner state lane must be -1, 0, or 1')
  }
  if (!VERTICAL_STATES.includes(state.vertical as RunnerVertical)) {
    throw new TypeError('Runner state vertical is invalid')
  }
  if (!isFiniteNonNegative(state.verticalUntilMs)) {
    throw new RangeError('Runner state verticalUntilMs must be finite and non-negative')
  }
  for (const field of ['score', 'bestScore', 'coins', 'streak'] as const) {
    if (!isSafeNonNegativeInteger(state[field])) {
      throw new RangeError(`Runner state ${field} must be a non-negative safe integer`)
    }
  }
  if (
    typeof state.powellGap !== 'number'
    || !Number.isFinite(state.powellGap)
    || state.powellGap < 0
    || state.powellGap > 100
  ) {
    throw new RangeError('Runner state powellGap must be between 0 and 100')
  }
  if (!Array.isArray(state.entities)) {
    throw new TypeError('Runner state entities must be an array')
  }
  state.entities.forEach(assertEntity)
  if (!isSafeNonNegativeInteger(state.nextSpawnIndex)) {
    throw new RangeError('Runner state nextSpawnIndex must be a non-negative safe integer')
  }
  if (state.lastFailure !== null) assertFailure(state.lastFailure)
  if (typeof state.reducedMotion !== 'boolean') {
    throw new TypeError('Runner state reducedMotion must be a boolean')
  }
  if (!isSafeNonNegativeInteger(state.tick)) {
    throw new RangeError('Runner state tick must be a non-negative safe integer')
  }
  if (
    typeof state.simulationRemainderMs !== 'number'
    || !Number.isFinite(state.simulationRemainderMs)
    || state.simulationRemainderMs < 0
    || state.simulationRemainderMs >= FIXED_STEP_MS
  ) {
    throw new RangeError(
      `Runner state simulationRemainderMs must be between 0 and ${FIXED_STEP_MS}`,
    )
  }
}
