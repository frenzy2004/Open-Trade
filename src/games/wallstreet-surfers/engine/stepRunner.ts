import { applyCommands, settleVerticalState } from './applyCommands'
import { resolveRunnerCollisions } from './collisions'
import {
  FIXED_STEP_MS,
  MAX_SPEED_MPS,
  MAX_FIXED_DELTA_MS,
  SPEED_STEP_DISTANCE_M,
  SPEED_STEP_MPS,
  START_SPEED_MPS,
  assertRunnerCommands,
  assertRunnerState,
  type RunnerCommand,
  type RunnerState,
} from './types'

const STEP_EPSILON_MS = 1e-9

function advanceOneTick(state: RunnerState): void {
  state.tick += 1
  state.elapsedMs += FIXED_STEP_MS
  state.distanceM += state.speedMps * (FIXED_STEP_MS / 1000)

  const speedSteps = Math.floor(
    (state.distanceM + Number.EPSILON) / SPEED_STEP_DISTANCE_M,
  )
  state.speedMps = Math.min(
    MAX_SPEED_MPS,
    START_SPEED_MPS + speedSteps * SPEED_STEP_MPS,
  )
  state.powellGap = Math.min(100, Math.max(0, state.powellGap))
  state.bestScore = Math.max(state.bestScore, state.score)
  settleVerticalState(state)
  resolveRunnerCollisions(state)
}

export function stepRunner(
  state: RunnerState,
  commands: readonly RunnerCommand[],
  fixedDeltaMs: number,
): RunnerState {
  assertRunnerState(state)
  assertRunnerCommands(commands)
  if (
    typeof fixedDeltaMs !== 'number'
    || !Number.isFinite(fixedDeltaMs)
    || fixedDeltaMs < 0
    || fixedDeltaMs > MAX_FIXED_DELTA_MS
  ) {
    throw new RangeError(
      `fixedDeltaMs must be finite and between 0 and ${MAX_FIXED_DELTA_MS}`,
    )
  }

  const hasLifecycleCommand = commands.includes('RESTART')
    || commands.includes('PAUSE')
  applyCommands(state, commands)
  if (hasLifecycleCommand) return state
  if (state.phase !== 'running' || fixedDeltaMs === 0) return state

  state.simulationRemainderMs += fixedDeltaMs
  const stepCount = Math.floor(
    (state.simulationRemainderMs + STEP_EPSILON_MS) / FIXED_STEP_MS,
  )
  state.simulationRemainderMs -= stepCount * FIXED_STEP_MS
  if (Math.abs(state.simulationRemainderMs) < STEP_EPSILON_MS) {
    state.simulationRemainderMs = 0
  }

  for (let step = 0; step < stepCount; step += 1) {
    advanceOneTick(state)
    if (state.phase !== 'running') break
  }

  assertRunnerState(state)
  return state
}
