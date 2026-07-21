import {
  INITIAL_POWELL_GAP,
  START_SPEED_MPS,
  assertRunnerConfig,
  assertRunnerState,
  type RunnerConfig,
  type RunnerState,
} from './types'

export function createRunnerState(config: RunnerConfig): RunnerState {
  assertRunnerConfig(config)

  const state: RunnerState = {
    seed: config.seed,
    phase: 'running',
    elapsedMs: 0,
    distanceM: 0,
    speedMps: START_SPEED_MPS,
    lane: 0,
    vertical: 'grounded',
    verticalUntilMs: 0,
    score: 0,
    bestScore: config.bestScore ?? 0,
    coins: 0,
    streak: 1,
    powellGap: INITIAL_POWELL_GAP,
    entities: [],
    nextSpawnIndex: 0,
    lastFailure: null,
    reducedMotion: config.reducedMotion,
    tick: 0,
    simulationRemainderMs: 0,
  }

  assertRunnerState(state)
  return state
}
