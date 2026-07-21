import {
  assertMarketGate,
  type MarketDirection,
  type MarketGate,
} from '../content/marketGates'

export const FIXED_STEP_MS = 1000 / 60
export const START_SPEED_MPS = 8.5
export const MAX_SPEED_MPS = 22
export const SPEED_STEP_MPS = 0.12
export const SPEED_STEP_DISTANCE_M = 100
export const INITIAL_POWELL_GAP = 60
export const MAX_FIXED_DELTA_MS = 1_000_000

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
export type ObstacleKind = 'barrier' | 'overhead' | 'train' | 'coin'

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

export interface RunnerObstacle extends RunnerEntity {
  kind: ObstacleKind
  lane: Lane
  ticker?: string
}

export interface RunnerConfig {
  seed: string
  reducedMotion: boolean
  bestScore?: number
}

export interface ActiveMarketGate {
  readonly eventId: string
  readonly promptDistanceM: number
  readonly responseDistanceM: number
  readonly gate: MarketGate
}

export interface RunnerGateFeedback {
  readonly gateId: string
  readonly ticker: string
  readonly answer: MarketDirection
  readonly expected: MarketDirection
  readonly correct: boolean
  readonly timedOut: boolean
  readonly scoreDelta: number
  readonly explanation: string
  readonly resolvedAtTick: number
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
  currentGate: ActiveMarketGate | null
  lastGateFeedback: RunnerGateFeedback | null
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
const OBSTACLE_KINDS: readonly ObstacleKind[] = [
  'barrier',
  'overhead',
  'train',
  'coin',
]
const REQUIRED_STATE_FIELDS = [
  'seed',
  'phase',
  'elapsedMs',
  'distanceM',
  'speedMps',
  'lane',
  'vertical',
  'verticalUntilMs',
  'score',
  'bestScore',
  'coins',
  'streak',
  'powellGap',
  'entities',
  'nextSpawnIndex',
  'currentGate',
  'lastGateFeedback',
  'lastFailure',
  'reducedMotion',
  'tick',
  'simulationRemainderMs',
] as const
const MAX_COMMANDS_PER_STEP = 64
const MAX_RUNNER_ENTITIES = 10_000

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

function assertOwnProperties(
  record: Record<string, unknown>,
  prefix: string,
  fields: readonly string[],
): void {
  for (const field of fields) {
    if (!Object.hasOwn(record, field)) {
      throw new TypeError(`${prefix}.${field} must be an own property`)
    }
  }
}

function assertOptionalOwnProperty(
  record: Record<string, unknown>,
  prefix: string,
  field: string,
): void {
  if (field in record && !Object.hasOwn(record, field)) {
    throw new TypeError(`${prefix}.${field} must be an own property`)
  }
}

function assertDenseOwnArray(
  values: unknown[],
  prefix: string,
  maximumLength: number,
): void {
  if (values.length > maximumLength) {
    throw new RangeError(`${prefix} exceeds the maximum length of ${maximumLength}`)
  }
  for (let index = 0; index < values.length; index += 1) {
    if (!Object.hasOwn(values, index)) {
      throw new TypeError(`${prefix} must be a dense own-slot array`)
    }
  }
}

export function assertRunnerObstacle(
  obstacle: unknown,
  prefix = 'Runner obstacle',
): asserts obstacle is RunnerObstacle {
  if (!isRecord(obstacle)) throw new TypeError(`${prefix} must be an object`)
  assertOwnProperties(obstacle, prefix, ['id'])
  if (!isNonEmptyString(obstacle.id)) {
    throw new TypeError(`${prefix}.id must be a non-empty string`)
  }
  assertOwnProperties(obstacle, prefix, ['kind'])
  if (!OBSTACLE_KINDS.includes(obstacle.kind as ObstacleKind)) {
    throw new TypeError(`${prefix}.kind is invalid`)
  }
  assertOwnProperties(obstacle, prefix, ['lane'])
  if (obstacle.lane !== -1 && obstacle.lane !== 0 && obstacle.lane !== 1) {
    throw new RangeError(`${prefix}.lane must be -1, 0, or 1`)
  }
  assertOwnProperties(obstacle, prefix, ['distanceM'])
  if (!isFiniteNonNegative(obstacle.distanceM)) {
    throw new RangeError(`${prefix}.distanceM must be finite and non-negative`)
  }
  assertOwnProperties(obstacle, prefix, ['resolved'])
  if (typeof obstacle.resolved !== 'boolean') {
    throw new TypeError(`${prefix}.resolved must be a boolean`)
  }
  assertOptionalOwnProperty(obstacle, prefix, 'ticker')
  if (obstacle.ticker !== undefined && !isNonEmptyString(obstacle.ticker)) {
    throw new TypeError(`${prefix}.ticker must be a non-empty string`)
  }
  if (obstacle.kind === 'train' && !isNonEmptyString(obstacle.ticker)) {
    throw new TypeError(`${prefix}.ticker is required for train obstacles`)
  }
}

function assertEntity(entity: unknown, index: number): asserts entity is RunnerEntity {
  assertRunnerObstacle(entity, `Runner state entities[${index}]`)
}

function assertFailure(failure: unknown): asserts failure is RunnerFailure {
  if (!isRecord(failure)) throw new TypeError('Runner state lastFailure must be an object or null')
  assertOwnProperties(failure, 'Runner state lastFailure', [
    'kind',
    'message',
    'tip',
  ])
  assertOptionalOwnProperty(failure, 'Runner state lastFailure', 'ticker')
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

function assertActiveMarketGate(gate: unknown): asserts gate is ActiveMarketGate {
  if (!isRecord(gate)) throw new TypeError('Runner state currentGate must be an object or null')
  assertOwnProperties(gate, 'Runner state currentGate', [
    'eventId',
    'promptDistanceM',
    'responseDistanceM',
    'gate',
  ])
  if (!isNonEmptyString(gate.eventId)) {
    throw new TypeError('Runner state currentGate.eventId must be a non-empty string')
  }
  if (!isFiniteNonNegative(gate.promptDistanceM)) {
    throw new RangeError('Runner state currentGate.promptDistanceM must be finite and non-negative')
  }
  if (
    !isFiniteNonNegative(gate.responseDistanceM)
    || gate.responseDistanceM < gate.promptDistanceM
  ) {
    throw new RangeError('Runner state currentGate.responseDistanceM must follow its prompt')
  }
  assertMarketGate(gate.gate, 'Runner state currentGate.gate')
}

function assertGateFeedback(
  feedback: unknown,
): asserts feedback is RunnerGateFeedback {
  if (!isRecord(feedback)) {
    throw new TypeError('Runner state lastGateFeedback must be an object or null')
  }
  assertOwnProperties(feedback, 'Runner state lastGateFeedback', [
    'gateId',
    'ticker',
    'answer',
    'expected',
    'correct',
    'timedOut',
    'scoreDelta',
    'explanation',
    'resolvedAtTick',
  ])
  if (!isNonEmptyString(feedback.gateId) || !isNonEmptyString(feedback.ticker)) {
    throw new TypeError('Runner state lastGateFeedback IDs must be non-empty strings')
  }
  if (
    (feedback.answer !== 'long' && feedback.answer !== 'short')
    || (feedback.expected !== 'long' && feedback.expected !== 'short')
  ) {
    throw new TypeError('Runner state lastGateFeedback answers must be long or short')
  }
  if (typeof feedback.correct !== 'boolean' || typeof feedback.timedOut !== 'boolean') {
    throw new TypeError('Runner state lastGateFeedback flags must be booleans')
  }
  if (!isSafeNonNegativeInteger(feedback.scoreDelta)) {
    throw new RangeError('Runner state lastGateFeedback.scoreDelta must be non-negative')
  }
  if (!isNonEmptyString(feedback.explanation)) {
    throw new TypeError('Runner state lastGateFeedback.explanation must be non-empty')
  }
  if (!isSafeNonNegativeInteger(feedback.resolvedAtTick)) {
    throw new RangeError('Runner state lastGateFeedback.resolvedAtTick must be non-negative')
  }
}

export function assertRunnerConfig(config: unknown): asserts config is RunnerConfig {
  if (!isRecord(config)) throw new TypeError('Runner config must be an object')
  assertOwnProperties(config, 'Runner config', ['seed', 'reducedMotion'])
  assertOptionalOwnProperty(config, 'Runner config', 'bestScore')
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
  assertDenseOwnArray(commands, 'Runner commands', MAX_COMMANDS_PER_STEP)
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index]
    if (!COMMANDS.includes(command as RunnerCommand)) {
      throw new TypeError('Runner commands contain an invalid command')
    }
  }
}

export function assertRunnerState(state: unknown): asserts state is RunnerState {
  if (!isRecord(state)) throw new TypeError('Runner state must be an object')
  assertOwnProperties(state, 'Runner state', REQUIRED_STATE_FIELDS)
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
  assertDenseOwnArray(state.entities, 'Runner state entities', MAX_RUNNER_ENTITIES)
  const entityIds = new Set<string>()
  for (let index = 0; index < state.entities.length; index += 1) {
    const entity = state.entities[index]
    assertEntity(entity, index)
    if (entityIds.has(entity.id)) {
      throw new TypeError('Runner state entity IDs must be unique')
    }
    entityIds.add(entity.id)
  }
  if (!isSafeNonNegativeInteger(state.nextSpawnIndex)) {
    throw new RangeError('Runner state nextSpawnIndex must be a non-negative safe integer')
  }
  if (state.currentGate !== null) assertActiveMarketGate(state.currentGate)
  if (state.lastGateFeedback !== null) {
    assertGateFeedback(state.lastGateFeedback)
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
