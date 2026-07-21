import {
  assertRunnerObstacle,
  assertRunnerState,
  type RunnerFailure,
  type RunnerObstacle,
  type RunnerState,
} from './types'

export type { ObstacleKind, RunnerObstacle } from './types'

export const COLLISION_HALF_WINDOW_M = 0.5
export const COIN_SCORE = 25

function isWithinCollisionWindow(
  state: RunnerState,
  obstacle: RunnerObstacle,
): boolean {
  return Math.abs(state.distanceM - obstacle.distanceM)
    <= COLLISION_HALF_WINDOW_M + Number.EPSILON
}

function isActionActive(
  state: RunnerState,
  action: 'jumping' | 'rolling',
): boolean {
  return state.vertical === action && state.elapsedMs < state.verticalUntilMs
}

export function detectCollision(
  state: RunnerState,
  obstacle: RunnerObstacle,
): RunnerFailure | null {
  assertRunnerState(state)
  assertRunnerObstacle(obstacle)
  if (
    state.phase !== 'running'
    || obstacle.resolved
    || state.lane !== obstacle.lane
    || !isWithinCollisionWindow(state, obstacle)
    || obstacle.kind === 'coin'
  ) {
    return null
  }

  if (obstacle.kind === 'barrier') {
    return isActionActive(state, 'jumping')
      ? null
      : {
          kind: 'barrier',
          message: 'You ate the barrier',
          tip: 'Jump or switch lanes before the barrier',
        }
  }

  if (obstacle.kind === 'overhead') {
    return isActionActive(state, 'rolling')
      ? null
      : {
          kind: 'overhead',
          message: 'The sign clipped you',
          tip: 'Roll or switch lanes before the overhead sign',
        }
  }

  const ticker = obstacle.ticker ?? 'Market'
  const failure: RunnerFailure = {
    kind: 'train',
    message: `${ticker} train flattened you`,
    tip: 'Switch lanes before the ticker train',
  }
  if (obstacle.ticker !== undefined) failure.ticker = obstacle.ticker
  return failure
}

export function resolveRunnerCollisions(state: RunnerState): RunnerState {
  assertRunnerState(state)
  if (state.phase !== 'running') return state

  for (const entity of state.entities) {
    assertRunnerObstacle(entity)
    if (entity.resolved) continue

    if (state.distanceM - entity.distanceM > COLLISION_HALF_WINDOW_M) {
      entity.resolved = true
      continue
    }
    if (
      state.lane !== entity.lane
      || !isWithinCollisionWindow(state, entity)
    ) {
      continue
    }

    if (entity.kind === 'coin') {
      entity.resolved = true
      state.coins += 1
      state.score += COIN_SCORE
      state.bestScore = Math.max(state.bestScore, state.score)
      continue
    }

    const failure = detectCollision(state, entity)
    if (failure !== null) {
      entity.resolved = true
      state.lastFailure = failure
      state.phase = 'gameOver'
      state.bestScore = Math.max(state.bestScore, state.score)
      break
    }
  }

  assertRunnerState(state)
  return state
}
