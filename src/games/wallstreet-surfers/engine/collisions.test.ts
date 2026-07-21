import { describe, expect, it } from 'vitest'
import {
  applyCommands,
  JUMP_DURATION_MS,
  ROLL_DURATION_MS,
  settleVerticalState,
} from './applyCommands'
import {
  COLLISION_HALF_WINDOW_M,
  detectCollision,
  type RunnerObstacle,
} from './collisions'
import { createRunnerState } from './createRunnerState'
import { stepRunner } from './stepRunner'
import { FIXED_STEP_MS, type Lane, type RunnerState } from './types'

function runner(overrides: Partial<RunnerState> = {}): RunnerState {
  return {
    ...createRunnerState({ seed: 'movement-test', reducedMotion: false }),
    ...overrides,
  }
}

function obstacle(
  kind: RunnerObstacle['kind'],
  lane: Lane = 0,
  overrides: Partial<RunnerObstacle> = {},
): RunnerObstacle {
  const ticker = kind === 'train' ? { ticker: 'ACME' } : {}
  return {
    id: `${kind}-${lane}`,
    kind,
    lane,
    distanceM: 10,
    resolved: false,
    ...ticker,
    ...overrides,
  }
}

describe('runner movement commands', () => {
  it('moves one lane per command and clamps at both track edges', () => {
    const state = runner()

    expect(applyCommands(state, ['MOVE_LEFT'])).toBe(state)
    expect(state.lane).toBe(-1)
    applyCommands(state, ['MOVE_LEFT', 'MOVE_LEFT'])
    expect(state.lane).toBe(-1)
    applyCommands(state, ['MOVE_RIGHT'])
    expect(state.lane).toBe(0)
    applyCommands(state, ['MOVE_RIGHT', 'MOVE_RIGHT', 'MOVE_RIGHT'])
    expect(state.lane).toBe(1)
  })

  it('keeps jump active for the 760ms threshold without command extension', () => {
    const state = runner()

    applyCommands(state, ['JUMP'])
    expect(state.vertical).toBe('jumping')
    expect(state.verticalUntilMs).toBe(760)

    stepRunner(state, [], 300)
    applyCommands(state, ['JUMP', 'ROLL'])
    expect(state.vertical).toBe('jumping')
    expect(state.verticalUntilMs).toBe(760)

    stepRunner(state, [], 450)
    expect(state.vertical).toBe('jumping')
    stepRunner(state, [], FIXED_STEP_MS)
    expect(state.elapsedMs).toBeCloseTo(760 + (20 / 3), 8)
    expect(state.vertical).toBe('grounded')
    expect(state.verticalUntilMs).toBe(0)
  })

  it('keeps roll active for exactly 650ms without command extension', () => {
    const state = runner()

    applyCommands(state, ['ROLL'])
    expect(state.vertical).toBe('rolling')
    expect(state.verticalUntilMs).toBe(650)

    stepRunner(state, [], 200)
    applyCommands(state, ['ROLL', 'JUMP'])
    expect(state.vertical).toBe('rolling')
    expect(state.verticalUntilMs).toBe(650)

    stepRunner(state, [], 450)
    expect(state.elapsedMs).toBeCloseTo(650, 8)
    expect(state.vertical).toBe('grounded')
    expect(state.verticalUntilMs).toBe(0)
  })

  it('settles jump and roll exactly at their configured boundaries', () => {
    for (const [command, vertical, duration] of [
      ['JUMP', 'jumping', JUMP_DURATION_MS],
      ['ROLL', 'rolling', ROLL_DURATION_MS],
    ] as const) {
      const state = runner()
      applyCommands(state, [command])
      state.elapsedMs = duration - 0.001
      settleVerticalState(state)
      expect(state.vertical).toBe(vertical)
      state.elapsedMs = duration
      settleVerticalState(state)
      expect(state.vertical).toBe('grounded')
    }
  })

  it('does not move or begin actions outside the running phase', () => {
    for (const phase of ['tutorial', 'paused', 'gameOver'] as const) {
      const state = runner({ phase })

      applyCommands(state, ['MOVE_LEFT', 'JUMP', 'ROLL'])

      expect(state.lane).toBe(0)
      expect(state.vertical).toBe('grounded')
    }
  })

  it('applies an evasive lane command before the collision tick', () => {
    const state = runner({
      entities: [
        obstacle('train', 0, {
          distanceM: 8.5 * (FIXED_STEP_MS / 1000),
        }),
      ],
    })

    stepRunner(state, ['MOVE_RIGHT'], FIXED_STEP_MS)

    expect(state.lane).toBe(1)
    expect(state.phase).toBe('running')
    expect(state.lastFailure).toBeNull()
  })
})

describe('typed collisions', () => {
  it('hits a same-lane barrier while grounded with actionable copy', () => {
    const state = runner({ distanceM: 10 })

    expect(detectCollision(state, obstacle('barrier'))).toEqual({
      kind: 'barrier',
      message: 'You ate the barrier',
      tip: 'Jump or switch lanes before the barrier',
    })
  })

  it('avoids a barrier while actively jumping or in another lane', () => {
    const jumping = runner({
      distanceM: 10,
      elapsedMs: 100,
      vertical: 'jumping',
      verticalUntilMs: 101,
    })

    expect(detectCollision(jumping, obstacle('barrier'))).toBeNull()
    expect(detectCollision(runner({ distanceM: 10 }), obstacle('barrier', 1))).toBeNull()

    jumping.elapsedMs = 101
    expect(detectCollision(jumping, obstacle('barrier'))).toEqual(
      expect.objectContaining({ kind: 'barrier' }),
    )
  })

  it('hits an overhead sign unless actively rolling or in another lane', () => {
    const grounded = runner({ distanceM: 10 })
    const rolling = runner({
      distanceM: 10,
      vertical: 'rolling',
      verticalUntilMs: 1,
    })

    expect(detectCollision(grounded, obstacle('overhead'))).toEqual({
      kind: 'overhead',
      message: 'The sign clipped you',
      tip: 'Roll or switch lanes before the overhead sign',
    })
    expect(detectCollision(rolling, obstacle('overhead'))).toBeNull()
    expect(detectCollision(grounded, obstacle('overhead', -1))).toBeNull()
  })

  it('requires another lane for a ticker train regardless of vertical action', () => {
    const jumping = runner({
      distanceM: 10,
      vertical: 'jumping',
      verticalUntilMs: 1,
    })

    expect(detectCollision(jumping, obstacle('train'))).toEqual({
      kind: 'train',
      message: 'ACME train flattened you',
      tip: 'Switch lanes before the ticker train',
      ticker: 'ACME',
    })
    expect(detectCollision(jumping, obstacle('train', 1))).toBeNull()
  })

  it('uses inclusive collision bounds and ignores resolved or distant objects', () => {
    const state = runner({ distanceM: 10 })

    expect(
      detectCollision(
        state,
        obstacle('barrier', 0, {
          distanceM: 10 + COLLISION_HALF_WINDOW_M,
        }),
      ),
    ).toEqual(expect.objectContaining({ kind: 'barrier' }))
    expect(
      detectCollision(
        state,
        obstacle('barrier', 0, {
          distanceM: 10 + COLLISION_HALF_WINDOW_M + 0.000_001,
        }),
      ),
    ).toBeNull()
    expect(
      detectCollision(state, obstacle('barrier', 0, { resolved: true })),
    ).toBeNull()
  })

  it('collects a coin once without ending the run', () => {
    const coin = obstacle('coin', 0, {
      distanceM: 8.5 * (FIXED_STEP_MS / 1000),
    })
    const state = runner({ entities: [coin] })

    expect(detectCollision(state, coin)).toBeNull()
    stepRunner(state, [], FIXED_STEP_MS)

    expect(state.coins).toBe(1)
    expect(state.score).toBe(25)
    expect(state.bestScore).toBe(25)
    expect(state.phase).toBe('running')
    expect(state.lastFailure).toBeNull()
    expect(coin.resolved).toBe(true)

    stepRunner(state, [], FIXED_STEP_MS)
    expect(state.coins).toBe(1)
    expect(state.score).toBe(25)
  })

  it('ends the run once with the detected typed failure', () => {
    const barrier = obstacle('barrier', 0, {
      distanceM: 8.5 * (FIXED_STEP_MS / 1000),
    })
    const state = runner({ entities: [barrier], score: 125, bestScore: 100 })

    stepRunner(state, [], FIXED_STEP_MS)

    expect(state.phase).toBe('gameOver')
    expect(state.lastFailure).toEqual({
      kind: 'barrier',
      message: 'You ate the barrier',
      tip: 'Jump or switch lanes before the barrier',
    })
    expect(state.bestScore).toBe(125)
    expect(barrier.resolved).toBe(true)
  })

  it.each([
    [{ ...obstacle('barrier'), kind: 'meteor' }, 'kind'],
    [{ ...obstacle('barrier'), lane: 2 }, 'lane'],
    [{ ...obstacle('barrier'), distanceM: Number.NaN }, 'distanceM'],
    [{ ...obstacle('barrier'), resolved: 'no' }, 'resolved'],
    [{ ...obstacle('train'), ticker: '' }, 'ticker'],
  ] as const)('rejects malformed obstacle field %s', (candidate, field) => {
    expect(() =>
      detectCollision(
        runner({ distanceM: 10 }),
        candidate as unknown as RunnerObstacle,
      ),
    ).toThrow(field)
  })

  it('requires train tickers and rejects prototype-backed obstacle fields', () => {
    const trainWithoutTicker = obstacle('train')
    delete trainWithoutTicker.ticker
    const inheritedObstacle = Object.create(obstacle('barrier')) as RunnerObstacle
    const inheritedTicker = Object.assign(
      Object.create({ ticker: 'PROTO' }),
      obstacle('train'),
    ) as RunnerObstacle
    delete inheritedTicker.ticker

    expect(() =>
      detectCollision(runner({ distanceM: 10 }), trainWithoutTicker),
    ).toThrow('ticker')
    expect(() =>
      detectCollision(runner({ distanceM: 10 }), inheritedObstacle),
    ).toThrow('own property')
    expect(() =>
      detectCollision(runner({ distanceM: 10 }), inheritedTicker),
    ).toThrow('ticker')
  })

  it('rejects unknown entity kinds during state validation', () => {
    const state = runner({
      entities: [
        {
          id: 'unknown-1',
          kind: 'meteor',
          distanceM: 10,
          resolved: false,
        },
      ],
    })

    expect(() => stepRunner(state, [], FIXED_STEP_MS)).toThrow('entities[0].kind')
  })
})
