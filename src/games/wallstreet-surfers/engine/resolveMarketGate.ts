import {
  assertMarketGate,
  type MarketDirection,
  type MarketGate,
} from '../content/marketGates'
import {
  assertRunnerState,
  type RunnerState,
} from './types'

export interface MarketGateResolution {
  readonly gateId: string
  readonly answer: MarketDirection
  readonly expected: MarketDirection
  readonly correct: boolean
  readonly scoreDelta: number
  readonly streak: number
  readonly powellGap: number
}

function assertSafeScore(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must remain a non-negative safe integer`)
  }
}

export function resolveMarketGate(
  state: RunnerState,
  gate: MarketGate,
  answer: MarketDirection,
): MarketGateResolution {
  assertRunnerState(state)
  assertMarketGate(gate)
  if (answer !== 'long' && answer !== 'short') {
    throw new TypeError('Market gate answer must be long or short')
  }
  if (state.phase !== 'running') {
    throw new TypeError('Market gates can only resolve while the runner is running')
  }

  const correct = answer === gate.answer
  const nextStreak = correct ? state.streak + 1 : 1
  const scoreDelta = correct ? 100 * nextStreak : 0
  const nextScore = state.score + scoreDelta
  assertSafeScore(nextStreak, 'Runner streak')
  assertSafeScore(scoreDelta, 'Market gate score delta')
  assertSafeScore(nextScore, 'Runner score')
  const nextPowellGap = correct
    ? Math.min(100, state.powellGap + 8)
    : Math.max(0, state.powellGap - 12)

  const result: MarketGateResolution = Object.freeze({
    gateId: gate.id,
    answer,
    expected: gate.answer,
    correct,
    scoreDelta,
    streak: nextStreak,
    powellGap: nextPowellGap,
  })

  state.streak = nextStreak
  state.score = nextScore
  state.bestScore = Math.max(state.bestScore, nextScore)
  state.powellGap = nextPowellGap
  if (!correct && nextPowellGap === 0) {
    state.phase = 'gameOver'
    state.lastFailure = {
      kind: 'powell',
      message: 'Powell closed the gap',
      tip: 'Build the gap with correct LONG or SHORT calls',
    }
  }

  assertRunnerState(state)
  return result
}
