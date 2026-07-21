import { createRunnerState } from './createRunnerState'
import {
  assertRunnerCommands,
  assertRunnerState,
  type Lane,
  type RunnerCommand,
  type RunnerState,
} from './types'

export const JUMP_DURATION_MS = 650
export const ROLL_DURATION_MS = 500
const ACTION_BOUNDARY_EPSILON_MS = 1e-9

function resetRunner(state: RunnerState): void {
  const reset = createRunnerState({
    seed: state.seed,
    reducedMotion: state.reducedMotion,
    bestScore: Math.max(state.bestScore, state.score),
  })
  Object.assign(state, reset)
}

export function settleVerticalState(state: RunnerState): void {
  if (
    state.vertical !== 'grounded'
    && state.elapsedMs + ACTION_BOUNDARY_EPSILON_MS >= state.verticalUntilMs
  ) {
    state.vertical = 'grounded'
    state.verticalUntilMs = 0
  }
}

function moveLane(lane: Lane, direction: -1 | 1): Lane {
  return Math.max(-1, Math.min(1, lane + direction)) as Lane
}

export function applyCommands(
  state: RunnerState,
  commands: readonly RunnerCommand[],
): RunnerState {
  assertRunnerState(state)
  assertRunnerCommands(commands)

  if (commands.includes('RESTART')) {
    resetRunner(state)
    return state
  }

  if (commands.includes('PAUSE')) {
    if (state.phase === 'running') state.phase = 'paused'
    else if (state.phase === 'paused') state.phase = 'running'
    return state
  }

  if (state.phase !== 'running') return state
  settleVerticalState(state)

  for (const command of commands) {
    switch (command) {
      case 'MOVE_LEFT':
        state.lane = moveLane(state.lane, -1)
        break
      case 'MOVE_RIGHT':
        state.lane = moveLane(state.lane, 1)
        break
      case 'JUMP':
        if (state.vertical === 'grounded') {
          state.vertical = 'jumping'
          state.verticalUntilMs = state.elapsedMs + JUMP_DURATION_MS
        }
        break
      case 'ROLL':
        if (state.vertical === 'grounded') {
          state.vertical = 'rolling'
          state.verticalUntilMs = state.elapsedMs + ROLL_DURATION_MS
        }
        break
      case 'PAUSE':
      case 'RESTART':
        break
    }
  }

  assertRunnerState(state)
  return state
}
