import type { MarketDirection } from '../content/marketGates'
import {
  buildSpawnSchedule,
  type MarketGateSpawnEvent,
  type SpawnEvent,
} from './buildSpawnSchedule'
import { COLLISION_HALF_WINDOW_M } from './collisions'
import { resolveMarketGate } from './resolveMarketGate'
import { stepRunner } from './stepRunner'
import {
  assertRunnerCommands,
  assertRunnerState,
  type RunnerCommand,
  type RunnerObstacle,
  type RunnerState,
} from './types'

export const RUNNER_SCHEDULE_LENGTH_M = 100_000
export const RUNNER_SPAWN_LOOKAHEAD_M = 90
export const POWELL_PRESSURE_PER_SECOND = 0.6
export const GATE_FEEDBACK_VISIBLE_TICKS = 180
const EMPTY_COMMANDS = Object.freeze([]) as readonly RunnerCommand[]

export interface RunnerRuntime {
  readonly schedule: readonly SpawnEvent[]
}

function pruneEntities(state: RunnerState): void {
  const minimumDistanceM = state.distanceM - COLLISION_HALF_WINDOW_M
  let writeIndex = 0
  for (let readIndex = 0; readIndex < state.entities.length; readIndex += 1) {
    const entity = state.entities[readIndex]
    if (entity === undefined || entity.resolved || entity.distanceM < minimumDistanceM) {
      continue
    }
    state.entities[writeIndex] = entity
    writeIndex += 1
  }
  state.entities.length = writeIndex
}

function activateGate(state: RunnerState, event: MarketGateSpawnEvent): void {
  state.currentGate = Object.freeze({
    eventId: event.id,
    promptDistanceM: event.distanceM,
    responseDistanceM: event.responseDistanceM,
    gate: event.gate,
  })
}

function syncNextScheduleEvent(
  runtime: RunnerRuntime,
  state: RunnerState,
): void {
  pruneEntities(state)
  while (state.nextSpawnIndex < runtime.schedule.length) {
    const event = runtime.schedule[state.nextSpawnIndex]
    if (event === undefined) return
    if (event.type === 'hazard') {
      if (event.distanceM > state.distanceM + RUNNER_SPAWN_LOOKAHEAD_M) return
      state.nextSpawnIndex += 1
      if (event.distanceM < state.distanceM - COLLISION_HALF_WINDOW_M) continue
      for (const scheduled of event.obstacles) {
        state.entities.push({ ...scheduled } satisfies RunnerObstacle)
      }
      return
    }

    if (event.responseDistanceM < state.distanceM) {
      state.nextSpawnIndex += 1
      continue
    }
    if (event.distanceM > state.distanceM || state.currentGate !== null) return
    state.nextSpawnIndex += 1
    activateGate(state, event)
    return
  }
}

function publishGateFeedback(
  state: RunnerState,
  event: MarketGateSpawnEvent,
  answer: MarketDirection,
  timedOut: boolean,
): void {
  const resolution = resolveMarketGate(state, event.gate, answer)
  state.lastGateFeedback = Object.freeze({
    gateId: event.gate.id,
    ticker: event.gate.ticker,
    answer: resolution.answer,
    expected: resolution.expected,
    correct: resolution.correct,
    timedOut,
    scoreDelta: resolution.scoreDelta,
    explanation: event.gate.explanation,
    resolvedAtTick: state.tick,
  })
  state.currentGate = null
}

function eventForActiveGate(
  runtime: RunnerRuntime,
  state: RunnerState,
): MarketGateSpawnEvent | null {
  const active = state.currentGate
  if (active === null) return null
  for (let index = state.nextSpawnIndex - 1; index >= 0; index -= 1) {
    const event = runtime.schedule[index]
    if (event?.type === 'market-gate' && event.id === active.eventId) return event
  }
  return null
}

function expireGate(runtime: RunnerRuntime, state: RunnerState): void {
  const event = eventForActiveGate(runtime, state)
  if (event === null || state.distanceM <= event.responseDistanceM) return
  const wrongAnswer: MarketDirection = event.gate.answer === 'long' ? 'short' : 'long'
  publishGateFeedback(state, event, wrongAnswer, true)
}

function resolveContextualGateCommand(
  runtime: RunnerRuntime,
  state: RunnerState,
  commands: readonly RunnerCommand[],
): readonly RunnerCommand[] {
  const event = eventForActiveGate(runtime, state)
  if (event === null) return commands
  let answerIndex = -1
  let answer: MarketDirection | null = null
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index]
    if (command === 'JUMP' || command === 'ROLL') {
      answerIndex = index
      answer = command === 'JUMP' ? 'long' : 'short'
      break
    }
  }
  if (answer === null) return commands
  publishGateFeedback(state, event, answer, false)
  if (commands.length === 1) return EMPTY_COMMANDS
  const remaining: RunnerCommand[] = []
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index]
    if (
      command !== undefined
      && index !== answerIndex
      && command !== 'JUMP'
      && command !== 'ROLL'
    ) {
      remaining.push(command)
    }
  }
  return remaining
}

function applyPowellPressure(state: RunnerState, elapsedDeltaMs: number): void {
  if (state.phase !== 'running' || elapsedDeltaMs <= 0) return
  state.powellGap = Math.max(
    0,
    state.powellGap - POWELL_PRESSURE_PER_SECOND * (elapsedDeltaMs / 1000),
  )
  if (state.powellGap > 0) return
  state.phase = 'gameOver'
  state.lastFailure = {
    kind: 'powell',
    message: 'Powell closed the gap',
    tip: 'Build the gap with correct LONG or SHORT calls',
  }
  state.bestScore = Math.max(state.bestScore, state.score)
}

function expireGateFeedback(state: RunnerState): void {
  const feedback = state.lastGateFeedback
  if (
    feedback !== null
    && state.tick - feedback.resolvedAtTick > GATE_FEEDBACK_VISIBLE_TICKS
  ) {
    state.lastGateFeedback = null
  }
}

export function createRunnerRuntime(
  seed: string,
  lengthM = RUNNER_SCHEDULE_LENGTH_M,
): RunnerRuntime {
  const schedule = buildSpawnSchedule(seed, lengthM)
  return Object.freeze({ schedule })
}

export function stepRunnerRuntime(
  runtime: RunnerRuntime,
  state: RunnerState,
  commands: readonly RunnerCommand[],
  fixedDeltaMs: number,
): RunnerState {
  assertRunnerState(state)
  assertRunnerCommands(commands)
  const restarting = commands.includes('RESTART')
  if (restarting || commands.includes('PAUSE')) {
    stepRunner(state, commands, fixedDeltaMs)
    if (!restarting && state.phase === 'running') {
      syncNextScheduleEvent(runtime, state)
    }
    return state
  }
  if (state.phase !== 'running') {
    return stepRunner(state, commands, fixedDeltaMs)
  }

  syncNextScheduleEvent(runtime, state)
  expireGate(runtime, state)
  const movementCommands = resolveContextualGateCommand(runtime, state, commands)
  const elapsedBefore = state.elapsedMs
  stepRunner(state, movementCommands, fixedDeltaMs)
  applyPowellPressure(state, state.elapsedMs - elapsedBefore)
  expireGateFeedback(state)
  if (state.phase === 'running') {
    syncNextScheduleEvent(runtime, state)
    expireGate(runtime, state)
  }
  assertRunnerState(state)
  return state
}
