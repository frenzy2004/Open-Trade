import Phaser from 'phaser'
import { createRunnerState } from '../engine/createRunnerState'
import {
  createRunnerRuntime,
  stepRunnerRuntime,
} from '../engine/runnerRuntime'
import {
  FIXED_STEP_MS,
  type ActiveMarketGate,
  type RunnerCommand,
  type RunnerEntity,
  type RunnerGateFeedback,
  type RunnerState,
} from '../engine/types'
import { RunnerScene } from './RunnerScene'

const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720
const MAX_FRAME_DELTA_MS = 250
const MAX_CATCH_UP_STEPS = 5
const MAX_PENDING_COMMANDS = 8
const SEMANTIC_PUBLISH_TICKS = 6
const CPU_SAMPLE_LIMIT = 600
const FRAME_EPSILON_MS = 1e-9
const EMPTY_COMMANDS = Object.freeze([]) as readonly RunnerCommand[]

export interface RunnerGameInstance {
  destroy(removeCanvas: boolean): void
}

export type RunnerPhaserConfig = Phaser.Types.Core.GameConfig & {
  readonly scene: RunnerScene
  /**
   * The requested backing-store multiplier. Phaser 3.90 leaves this extension
   * for host factories to apply, so it is kept explicit at our adapter seam.
   */
  readonly resolution: number
}

export type RunnerGameFactory = (
  config: RunnerPhaserConfig,
) => RunnerGameInstance

export interface CreateRunnerGameOptions {
  readonly seed: string
  readonly reducedMotion: boolean
  readonly bestScore?: number
  readonly tutorialComplete?: boolean
  readonly dprCap?: number
  readonly gameFactory?: RunnerGameFactory
  readonly onSnapshot?: (state: RunnerState) => void
}

export interface RunnerGameHandle {
  destroy(): void
  dispatch(command: RunnerCommand): void
  completeTutorial(): void
  setReducedMotion(reducedMotion: boolean): void
  snapshot(): RunnerState
  diagnostics(): RunnerDiagnostics
}

export interface RunnerDiagnostics {
  readonly catchUpLimit: number
  readonly commandDrainCount: number
  readonly droppedCommands: number
  readonly droppedFrameMs: number
  readonly pendingCommands: number
  readonly sampledSimulationSteps: number
  readonly maxSimulationStepMs: number
}

function freezeEntity(entity: RunnerEntity): RunnerEntity {
  return Object.freeze({ ...entity })
}

function freezeActiveGate(gate: ActiveMarketGate | null): ActiveMarketGate | null {
  return gate === null
    ? null
    : Object.freeze({
        ...gate,
        gate: Object.freeze({ ...gate.gate }),
      })
}

function freezeGateFeedback(
  feedback: RunnerGateFeedback | null,
): RunnerGateFeedback | null {
  return feedback === null ? null : Object.freeze({ ...feedback })
}

function snapshotState(state: RunnerState): RunnerState {
  const lastFailure = state.lastFailure === null
    ? null
    : Object.freeze({ ...state.lastFailure })
  return Object.freeze({
    ...state,
    entities: Object.freeze(state.entities.map(freezeEntity)) as RunnerEntity[],
    currentGate: freezeActiveGate(state.currentGate),
    lastGateFeedback: freezeGateFeedback(state.lastGateFeedback),
    lastFailure,
  })
}

function defaultGameFactory(config: RunnerPhaserConfig): RunnerGameInstance {
  return new Phaser.Game(config)
}

function hasSemanticChange(previous: RunnerState, current: RunnerState): boolean {
  const previousFailure = previous.lastFailure
  const currentFailure = current.lastFailure
  return previous.phase !== current.phase
    || previous.lane !== current.lane
    || previous.vertical !== current.vertical
    || previous.coins !== current.coins
    || previous.streak !== current.streak
    || previous.reducedMotion !== current.reducedMotion
    || previous.currentGate?.eventId !== current.currentGate?.eventId
    || previous.lastGateFeedback?.resolvedAtTick
      !== current.lastGateFeedback?.resolvedAtTick
    || previousFailure?.kind !== currentFailure?.kind
    || previousFailure?.message !== currentFailure?.message
    || previousFailure?.tip !== currentFailure?.tip
    || previousFailure?.ticker !== currentFailure?.ticker
}

export function createRunnerGame(
  parent: HTMLElement,
  options: CreateRunnerGameOptions,
): RunnerGameHandle {
  if (!(parent instanceof HTMLElement)) {
    throw new TypeError('Runner parent must be an HTMLElement')
  }
  const dprCap = options.dprCap ?? 1.5
  if (!Number.isFinite(dprCap) || dprCap <= 0 || dprCap > 4) {
    throw new RangeError('Runner dprCap must be between 0 and 4')
  }
  const stateConfig = {
    seed: options.seed,
    reducedMotion: options.reducedMotion,
    ...(options.bestScore === undefined ? {} : { bestScore: options.bestScore }),
  }
  const state = createRunnerState(stateConfig)
  const runtime = createRunnerRuntime(options.seed)
  if (options.tutorialComplete === false) state.phase = 'tutorial'
  else stepRunnerRuntime(runtime, state, EMPTY_COMMANDS, 0)
  let pendingCommands: RunnerCommand[] = []
  let accumulatorMs = 0
  let commandDrainCount = 0
  let droppedCommands = 0
  let droppedFrameMs = 0
  let sampledSimulationSteps = 0
  let maxSimulationStepMs = 0
  let destroyed = false
  let autoPaused = false
  let lastPublished: RunnerState | null = null

  const drainCommands = (): readonly RunnerCommand[] => {
    if (pendingCommands.length === 0) return EMPTY_COMMANDS
    const drained = pendingCommands
    pendingCommands = []
    commandDrainCount += 1
    return drained
  }

  const publish = (force = false) => {
    if (options.onSnapshot === undefined) return
    if (
      !force
      && lastPublished !== null
      && state.tick - lastPublished.tick < SEMANTIC_PUBLISH_TICKS
      && !hasSemanticChange(lastPublished, state)
    ) {
      return
    }
    const next = snapshotState(state)
    lastPublished = next
    options.onSnapshot(next)
  }
  const advanceFrame = (rawDeltaMs: number) => {
    if (destroyed || !Number.isFinite(rawDeltaMs) || rawDeltaMs <= 0) return
    const acceptedDeltaMs = Math.min(rawDeltaMs, MAX_FRAME_DELTA_MS)
    droppedFrameMs += rawDeltaMs - acceptedDeltaMs
    accumulatorMs += acceptedDeltaMs
    let catchUpSteps = 0
    while (
      accumulatorMs + FRAME_EPSILON_MS >= FIXED_STEP_MS
      && catchUpSteps < MAX_CATCH_UP_STEPS
    ) {
      const frameCommands = drainCommands()
      const stepStartedAt = performance.now()
      stepRunnerRuntime(runtime, state, frameCommands, FIXED_STEP_MS)
      if (sampledSimulationSteps < CPU_SAMPLE_LIMIT) {
        const stepDurationMs = Math.max(0, performance.now() - stepStartedAt)
        sampledSimulationSteps += 1
        maxSimulationStepMs = Math.max(maxSimulationStepMs, stepDurationMs)
      }
      accumulatorMs -= FIXED_STEP_MS
      catchUpSteps += 1
      if (Math.abs(accumulatorMs) < FRAME_EPSILON_MS) accumulatorMs = 0
      if (state.phase !== 'running') {
        accumulatorMs = 0
        break
      }
    }
    if (
      catchUpSteps === MAX_CATCH_UP_STEPS
      && accumulatorMs + FRAME_EPSILON_MS >= FIXED_STEP_MS
    ) {
      const droppedSteps = Math.floor(
        (accumulatorMs + FRAME_EPSILON_MS) / FIXED_STEP_MS,
      )
      const catchUpDropMs = droppedSteps * FIXED_STEP_MS
      accumulatorMs -= catchUpDropMs
      droppedFrameMs += catchUpDropMs
      if (Math.abs(accumulatorMs) < FRAME_EPSILON_MS) accumulatorMs = 0
    }
    publish()
  }

  const scene = new RunnerScene({
    advanceFrame,
    snapshot: () => state,
  })
  const gameFactory = options.gameFactory ?? defaultGameFactory
  const pixelRatio = typeof window === 'undefined'
    ? 1
    : Math.max(1, window.devicePixelRatio || 1)
  const game = gameFactory({
    type: Phaser.AUTO,
    parent,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    transparent: true,
    resolution: Math.min(pixelRatio, dprCap),
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    },
    scene,
  })

  const handleVisibility = () => {
    if (document.hidden) {
      if (state.phase === 'running') {
        stepRunnerRuntime(runtime, state, ['PAUSE'], 0)
        autoPaused = true
        accumulatorMs = 0
        publish()
      }
      return
    }
    if (autoPaused && state.phase === 'paused') {
      stepRunnerRuntime(runtime, state, ['PAUSE'], 0)
      autoPaused = false
      publish()
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)
  publish(true)

  return {
    dispatch(command) {
      if (destroyed) return
      if (state.phase === 'tutorial') {
        if (command === 'MOVE_LEFT') state.lane = Math.max(-1, state.lane - 1) as -1 | 0 | 1
        else if (command === 'MOVE_RIGHT') state.lane = Math.min(1, state.lane + 1) as -1 | 0 | 1
        else if (command === 'JUMP') state.vertical = 'jumping'
        else if (command === 'ROLL') state.vertical = 'rolling'
        publish(true)
        return
      }
      if (command === 'PAUSE' || command === 'RESTART') {
        pendingCommands.length = 0
        stepRunnerRuntime(runtime, state, [command], 0)
        autoPaused = false
        accumulatorMs = 0
        publish(true)
        return
      }
      if (state.phase !== 'running') return
      if (pendingCommands.at(-1) === command) {
        droppedCommands += 1
        return
      }
      if (pendingCommands.length >= MAX_PENDING_COMMANDS) {
        droppedCommands += 1
        return
      }
      pendingCommands.push(command)
    },
    completeTutorial() {
      if (destroyed || state.phase !== 'tutorial') return
      state.phase = 'running'
      state.lane = 0
      state.vertical = 'grounded'
      state.verticalUntilMs = 0
      accumulatorMs = 0
      pendingCommands.length = 0
      stepRunnerRuntime(runtime, state, EMPTY_COMMANDS, 0)
      publish(true)
    },
    setReducedMotion(reducedMotion) {
      if (destroyed) return
      if (typeof reducedMotion !== 'boolean') {
        throw new TypeError('Runner reducedMotion must be a boolean')
      }
      if (state.reducedMotion === reducedMotion) return
      state.reducedMotion = reducedMotion
      publish(true)
    },
    snapshot: () => snapshotState(state),
    diagnostics: () => Object.freeze({
      catchUpLimit: MAX_CATCH_UP_STEPS,
      commandDrainCount,
      droppedCommands,
      droppedFrameMs,
      sampledSimulationSteps,
      maxSimulationStepMs,
      pendingCommands: pendingCommands.length,
    }),
    destroy() {
      if (destroyed) return
      destroyed = true
      document.removeEventListener('visibilitychange', handleVisibility)
      scene.destroyRenderer()
      game.destroy(true)
    },
  }
}
