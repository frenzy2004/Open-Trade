import { createSeededRng } from '../../../shared/rng/seededRng'
import {
  MARKET_GATES,
  assertMarketGate,
  cloneMarketGate,
  type MarketGate,
} from '../content/marketGates'
import {
  JUMP_DURATION_MS,
  ROLL_DURATION_MS,
} from './applyCommands'
import {
  MAX_SPEED_MPS,
  assertRunnerObstacle,
  type Lane,
  type ObstacleKind,
  type RunnerObstacle,
} from './types'

export const MARKET_GATE_MIN_LEAD_M = 45
export const MARKET_GATE_CLEARANCE_M = 12
export const MAX_SCHEDULE_LENGTH_M = 100_000

const SEED_PATTERN = /^[a-z0-9_-]{1,64}$/i
const LANES: readonly Lane[] = [-1, 0, 1]
const MIN_LANE_SHIFT_DISTANCE_M = 6
const MIN_HAZARD_GAP_M = 24
const MAX_SCHEDULE_EVENTS = 10_000
const MAX_OBSTACLES_PER_WINDOW = 9
const EVENT_ID_PATTERN = /^[a-z0-9-]+$/i
const SYNTHETIC_TICKERS = Object.freeze([
  'NVLN',
  'CFIN',
  'ORPT',
  'VGRD',
  'KHBR',
  'MSRL',
  'AUCL',
  'BEMD',
] as const)
const RANDOM_OBSTACLE_KINDS = Object.freeze([
  'barrier',
  'barrier',
  'overhead',
  'overhead',
  'train',
  'coin',
  'coin',
] as const satisfies readonly ObstacleKind[])

export interface HazardSpawnEvent {
  readonly type: 'hazard'
  readonly id: string
  readonly distanceM: number
  readonly obstacles: readonly RunnerObstacle[]
}

export interface MarketGateSpawnEvent {
  readonly type: 'market-gate'
  readonly id: string
  readonly distanceM: number
  readonly responseDistanceM: number
  readonly gate: MarketGate
}

export type SpawnEvent = HazardSpawnEvent | MarketGateSpawnEvent

type SafeAction = 'grounded' | 'jumping' | 'rolling'

interface ResponsePath {
  readonly lane: Lane
  readonly action: SafeAction
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function assertDenseOwnArray(
  value: unknown,
  prefix: string,
  maximumLength: number,
): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${prefix} must be an array`)
  if (value.length > maximumLength) {
    throw new RangeError(`${prefix} exceeds the maximum length of ${maximumLength}`)
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      throw new TypeError(`${prefix} must be a dense own-slot array`)
    }
  }
}

function assertDistance(value: unknown, prefix: string): asserts value is number {
  if (
    !Number.isSafeInteger(value)
    || (value as number) < 0
    || (value as number) > MAX_SCHEDULE_LENGTH_M
  ) {
    throw new RangeError(
      `${prefix} must be a safe integer between 0 and ${MAX_SCHEDULE_LENGTH_M}`,
    )
  }
}

function assertEvent(
  event: unknown,
  index: number,
): asserts event is SpawnEvent {
  const prefix = `Spawn schedule[${index}]`
  if (!isRecord(event)) throw new TypeError(`${prefix} must be an object`)
  assertOwnProperties(event, prefix, ['type', 'id', 'distanceM'])
  if (event.type !== 'hazard' && event.type !== 'market-gate') {
    throw new TypeError(`${prefix}.type is invalid`)
  }
  if (typeof event.id !== 'string' || !EVENT_ID_PATTERN.test(event.id)) {
    throw new TypeError(`${prefix}.id is invalid`)
  }
  assertDistance(event.distanceM, `${prefix}.distanceM`)

  if (event.type === 'hazard') {
    assertOwnProperties(event, prefix, ['obstacles'])
    assertDenseOwnArray(
      event.obstacles,
      `${prefix}.obstacles`,
      MAX_OBSTACLES_PER_WINDOW,
    )
    if (event.obstacles.length === 0) {
      throw new TypeError(`${prefix}.obstacles must not be empty`)
    }
    for (let obstacleIndex = 0; obstacleIndex < event.obstacles.length; obstacleIndex += 1) {
      const obstacle = event.obstacles[obstacleIndex]
      assertRunnerObstacle(
        obstacle,
        `${prefix}.obstacles[${obstacleIndex}]`,
      )
      if (obstacle.resolved) {
        throw new TypeError(`${prefix}.obstacles[${obstacleIndex}] must be unresolved`)
      }
      if (obstacle.distanceM !== event.distanceM) {
        throw new TypeError(`${prefix}.obstacles[${obstacleIndex}].distanceM must match its window`)
      }
    }
    return
  }

  assertOwnProperties(event, prefix, ['responseDistanceM', 'gate'])
  assertDistance(event.responseDistanceM, `${prefix}.responseDistanceM`)
  assertMarketGate(event.gate, `${prefix}.gate`)
}

function safeActionsForLane(
  event: HazardSpawnEvent,
  lane: Lane,
): readonly SafeAction[] {
  const blocking = event.obstacles.filter(
    (obstacle) => obstacle.lane === lane && obstacle.kind !== 'coin',
  )
  if (blocking.some(({ kind }) => kind === 'train')) return []
  const hasBarrier = blocking.some(({ kind }) => kind === 'barrier')
  const hasOverhead = blocking.some(({ kind }) => kind === 'overhead')
  if (hasBarrier && hasOverhead) return []
  if (hasBarrier) return ['jumping']
  if (hasOverhead) return ['rolling']
  return ['grounded', 'jumping', 'rolling']
}

function actionClearDistance(action: SafeAction): number {
  if (action === 'jumping') return MAX_SPEED_MPS * (JUMP_DURATION_MS / 1000)
  if (action === 'rolling') return MAX_SPEED_MPS * (ROLL_DURATION_MS / 1000)
  return 0
}

function canReachResponse(
  previous: ResponsePath,
  next: ResponsePath,
  distanceGapM: number,
): boolean {
  const laneDistance = Math.abs(next.lane - previous.lane)
    * MIN_LANE_SHIFT_DISTANCE_M
  if (distanceGapM + Number.EPSILON < laneDistance) return false
  if (previous.action === 'grounded' || previous.action === next.action) {
    return true
  }
  return distanceGapM + Number.EPSILON >= actionClearDistance(previous.action)
}

function deduplicatePaths(paths: readonly ResponsePath[]): ResponsePath[] {
  const keys = new Set<string>()
  const result: ResponsePath[] = []
  for (const path of paths) {
    const key = `${path.lane}:${path.action}`
    if (!keys.has(key)) {
      keys.add(key)
      result.push(path)
    }
  }
  return result
}

export function assertSolvableSchedule(schedule: readonly SpawnEvent[]): true {
  assertDenseOwnArray(schedule, 'Spawn schedule', MAX_SCHEDULE_EVENTS)
  const eventIds = new Set<string>()
  const obstacleIds = new Set<string>()
  const hazards: HazardSpawnEvent[] = []
  const gates: MarketGateSpawnEvent[] = []
  let previousDistanceM = -1

  for (let index = 0; index < schedule.length; index += 1) {
    const event = schedule[index]
    assertEvent(event, index)
    if (event.distanceM < previousDistanceM) {
      throw new TypeError('Spawn schedule must be ordered by distanceM')
    }
    previousDistanceM = event.distanceM
    if (eventIds.has(event.id)) {
      throw new TypeError('Spawn schedule event IDs must be unique')
    }
    eventIds.add(event.id)

    if (event.type === 'hazard') {
      hazards.push(event)
      for (const candidate of event.obstacles) {
        if (obstacleIds.has(candidate.id)) {
          throw new TypeError('Spawn schedule obstacle IDs must be unique')
        }
        obstacleIds.add(candidate.id)
      }
    } else {
      gates.push(event)
      if (
        event.responseDistanceM - event.distanceM
        < MARKET_GATE_MIN_LEAD_M
      ) {
        throw new TypeError(
          `Market gate prompts must lead responses by at least ${MARKET_GATE_MIN_LEAD_M}m`,
        )
      }
    }
  }

  let previousGate: MarketGateSpawnEvent | undefined
  for (const gate of gates) {
    if (
      previousGate !== undefined
      && gate.distanceM
        <= previousGate.responseDistanceM + MARKET_GATE_CLEARANCE_M
    ) {
      throw new TypeError('Market gate response windows must not overlap')
    }
    if (
      hazards.some(
        ({ distanceM }) =>
          distanceM >= gate.distanceM
          && distanceM
            <= gate.responseDistanceM + MARKET_GATE_CLEARANCE_M,
      )
    ) {
      throw new TypeError('Market gate response windows must be hazard-free')
    }
    previousGate = gate
  }

  let reachable: ResponsePath[] = [{ lane: 0, action: 'grounded' }]
  let lastHazardDistanceM = 0
  for (const event of hazards) {
    const responses = LANES.flatMap((lane) =>
      safeActionsForLane(event, lane).map((action) => ({ lane, action })),
    )
    if (responses.length === 0) {
      throw new TypeError(`Hazard ${event.id} has no safe response`)
    }
    const distanceGapM = event.distanceM - lastHazardDistanceM
    const nextReachable = responses.filter((response) =>
      reachable.some((path) => canReachResponse(path, response, distanceGapM)),
    )
    if (nextReachable.length === 0) {
      throw new TypeError(`Hazard ${event.id} is unreachable from the prior window`)
    }
    reachable = deduplicatePaths(nextReachable)
    lastHazardDistanceM = event.distanceM
  }

  return true
}

function createObstacle(
  id: string,
  kind: ObstacleKind,
  lane: Lane,
  distanceM: number,
  ticker?: string,
): RunnerObstacle {
  const obstacle: RunnerObstacle = {
    id,
    kind,
    lane,
    distanceM,
    resolved: false,
  }
  if (ticker !== undefined) obstacle.ticker = ticker
  assertRunnerObstacle(obstacle)
  return Object.freeze(obstacle)
}

function createHazard(
  seedLabel: string,
  index: number,
  distanceM: number,
  rng: ReturnType<typeof createSeededRng>,
): HazardSpawnEvent {
  const mode = rng.int(0, 10)
  const forcedKind = mode === 0
    ? 'barrier'
    : mode === 1
      ? 'overhead'
      : null
  const lanes = forcedKind === null
    ? rng.shuffle(LANES).slice(0, rng.int(1, 3))
    : [...LANES]
  const obstacles = lanes.map((lane, obstacleIndex) => {
    const kind = forcedKind ?? rng.pick(RANDOM_OBSTACLE_KINDS)
    const ticker = kind === 'train' ? rng.pick(SYNTHETIC_TICKERS) : undefined
    return createObstacle(
      `${seedLabel}-obstacle-${index}-${obstacleIndex}`,
      kind,
      lane,
      distanceM,
      ticker,
    )
  })

  return Object.freeze({
    type: 'hazard',
    id: `${seedLabel}-hazard-${index}`,
    distanceM,
    obstacles: Object.freeze(obstacles),
  })
}

export function buildSpawnSchedule(
  seed: string,
  lengthM: number,
): readonly SpawnEvent[] {
  if (typeof seed !== 'string' || !SEED_PATTERN.test(seed)) {
    throw new TypeError('Spawn schedule seed must match challenge seed format')
  }
  if (
    !Number.isSafeInteger(lengthM)
    || lengthM < 0
    || lengthM > MAX_SCHEDULE_LENGTH_M
  ) {
    throw new RangeError(
      `Spawn schedule lengthM must be a safe integer between 0 and ${MAX_SCHEDULE_LENGTH_M}`,
    )
  }
  if (lengthM === 0) return Object.freeze([])

  const rng = createSeededRng(seed).fork('wallstreet-spawns')
  const seedLabel = createSeededRng(seed).seed.toString(36)
  const events: SpawnEvent[] = []
  let positionM = 55 + rng.int(0, 16)
  let nextGateThresholdM = 220 + rng.int(0, 81)
  let hazardIndex = 0
  let gateIndex = 0

  while (positionM <= lengthM) {
    if (positionM >= nextGateThresholdM) {
      const responseDistanceM = positionM
        + MARKET_GATE_MIN_LEAD_M
        + rng.int(0, 16)
      if (responseDistanceM <= lengthM) {
        const selected = rng.pick(MARKET_GATES)
        events.push(Object.freeze({
          type: 'market-gate',
          id: `${seedLabel}-gate-${gateIndex}`,
          distanceM: positionM,
          responseDistanceM,
          gate: cloneMarketGate(selected),
        }))
        gateIndex += 1
        positionM = responseDistanceM
          + MARKET_GATE_CLEARANCE_M
          + MIN_HAZARD_GAP_M
        nextGateThresholdM = positionM + 200 + rng.int(0, 101)
        continue
      }
    }

    events.push(createHazard(seedLabel, hazardIndex, positionM, rng))
    hazardIndex += 1
    positionM += MIN_HAZARD_GAP_M + rng.int(0, 13)
  }

  const schedule: readonly SpawnEvent[] = Object.freeze(events)
  assertSolvableSchedule(schedule)
  return schedule
}
