import { describe, expect, it } from 'vitest'
import {
  MARKET_GATES,
  type MarketGate,
} from '../content/marketGates'
import {
  MARKET_GATE_CLEARANCE_M,
  MARKET_GATE_MIN_LEAD_M,
  assertSolvableSchedule,
  buildSpawnSchedule,
  type HazardSpawnEvent,
  type MarketGateSpawnEvent,
  type SpawnEvent,
} from './buildSpawnSchedule'
import { createRunnerState } from './createRunnerState'
import { resolveMarketGate } from './resolveMarketGate'
import type { Lane, RunnerObstacle, RunnerState } from './types'

function longGate(): MarketGate {
  const gate = MARKET_GATES.find(({ answer }) => answer === 'long')
  if (gate === undefined) throw new Error('Test gate bank needs a LONG answer')
  return gate
}

function obstacle(
  id: string,
  kind: RunnerObstacle['kind'],
  lane: Lane,
  distanceM: number,
): RunnerObstacle {
  const ticker = kind === 'train' ? { ticker: 'TEST' } : {}
  return { id, kind, lane, distanceM, resolved: false, ...ticker }
}

function hazard(
  id: string,
  distanceM: number,
  obstacles: readonly RunnerObstacle[],
): HazardSpawnEvent {
  return { type: 'hazard', id, distanceM, obstacles }
}

function gateEvent(
  id: string,
  distanceM: number,
  responseDistanceM: number,
): MarketGateSpawnEvent {
  return {
    type: 'market-gate',
    id,
    distanceM,
    responseDistanceM,
    gate: { ...longGate() },
  }
}

function mutableRunner(overrides: Partial<RunnerState> = {}): RunnerState {
  return {
    ...createRunnerState({ seed: 'gate-resolution', reducedMotion: false }),
    ...overrides,
  }
}

describe('authored market gate bank', () => {
  it('ships at least 18 complete, synthetic, unambiguous scenarios', () => {
    expect(MARKET_GATES.length).toBeGreaterThanOrEqual(18)
    expect(new Set(MARKET_GATES.map(({ id }) => id)).size).toBe(
      MARKET_GATES.length,
    )
    expect(new Set(MARKET_GATES.map(({ answer }) => answer))).toEqual(
      new Set(['long', 'short']),
    )
    expect(new Set(MARKET_GATES.map(({ difficulty }) => difficulty))).toEqual(
      new Set([1, 2, 3]),
    )

    for (const gate of MARKET_GATES) {
      expect(gate.id).toMatch(/^[a-z0-9-]+$/)
      expect(gate.ticker).toMatch(/^[A-Z]{2,5}$/)
      expect(gate.setup.length).toBeGreaterThan(20)
      expect(gate.explanation.length).toBeGreaterThan(20)
      expect(Object.isFrozen(gate)).toBe(true)
    }
    expect(Object.isFrozen(MARKET_GATES)).toBe(true)
  })
})

describe('seeded spawn schedules', () => {
  it('is reproducible for one seed, divergent for another, and deeply detached', () => {
    const first = buildSpawnSchedule('repeatable', 5_000)
    const replay = buildSpawnSchedule('repeatable', 5_000)
    const other = buildSpawnSchedule('different', 5_000)

    expect(first).toEqual(replay)
    expect(first).not.toEqual(other)
    expect(first).not.toBe(replay)
    expect(first[0]).not.toBe(replay[0])
    expect(Object.isFrozen(first)).toBe(true)

    for (const event of first) {
      expect(Object.isFrozen(event)).toBe(true)
      if (event.type === 'hazard') {
        expect(Object.isFrozen(event.obstacles)).toBe(true)
        expect(event.obstacles.every(Object.isFrozen)).toBe(true)
      } else {
        expect(Object.isFrozen(event.gate)).toBe(true)
      }
    }
  })

  it('keeps 100 independent 5km schedules solvable and ordered', () => {
    for (let seedIndex = 0; seedIndex < 100; seedIndex += 1) {
      const schedule = buildSpawnSchedule(`stress-${seedIndex}`, 5_000)

      expect(assertSolvableSchedule(schedule)).toBe(true)
      expect(schedule.length).toBeGreaterThan(50)
      expect(schedule.every(({ distanceM }) => distanceM <= 5_000)).toBe(true)
      expect(schedule.map(({ distanceM }) => distanceM)).toEqual(
        [...schedule].map(({ distanceM }) => distanceM).sort((a, b) => a - b),
      )
      expect(new Set(schedule.map(({ id }) => id)).size).toBe(schedule.length)
    }
  })

  it('leaves a safe lane or action in every hazard window', () => {
    const schedule = buildSpawnSchedule('safe-responses', 5_000)
    const hazards = schedule.filter(
      (event): event is HazardSpawnEvent => event.type === 'hazard',
    )

    for (const event of hazards) {
      const trainLanes = new Set(
        event.obstacles
          .filter(({ kind }) => kind === 'train')
          .map(({ lane }) => lane),
      )
      expect(trainLanes.size).toBeLessThan(3)
    }
    expect(assertSolvableSchedule(schedule)).toBe(true)
  })

  it('announces each market gate at least 45m early in a hazard-free window', () => {
    const schedule = buildSpawnSchedule('market-windows', 5_000)
    const hazards = schedule.filter(
      (event): event is HazardSpawnEvent => event.type === 'hazard',
    )
    const gates = schedule.filter(
      (event): event is MarketGateSpawnEvent => event.type === 'market-gate',
    )

    expect(gates.length).toBeGreaterThan(5)
    for (const event of gates) {
      expect(event.responseDistanceM - event.distanceM).toBeGreaterThanOrEqual(
        MARKET_GATE_MIN_LEAD_M,
      )
      expect(
        hazards.some(
          (candidate) =>
            candidate.distanceM >= event.distanceM
            && candidate.distanceM
              <= event.responseDistanceM + MARKET_GATE_CLEARANCE_M,
        ),
      ).toBe(false)
    }
  })

  it('rejects a three-lane train wall and an unreachable lane reversal', () => {
    const trainWall: readonly SpawnEvent[] = [
      hazard('wall', 30, [
        obstacle('wall-left', 'train', -1, 30),
        obstacle('wall-center', 'train', 0, 30),
        obstacle('wall-right', 'train', 1, 30),
      ]),
    ]
    const laneReversal: readonly SpawnEvent[] = [
      hazard('left-only', 12, [
        obstacle('left-only-center', 'train', 0, 12),
        obstacle('left-only-right', 'train', 1, 12),
      ]),
      hazard('right-only', 13, [
        obstacle('right-only-left', 'train', -1, 13),
        obstacle('right-only-center', 'train', 0, 13),
      ]),
    ]

    expect(() => assertSolvableSchedule(trainWall)).toThrow('no safe response')
    expect(() => assertSolvableSchedule(laneReversal)).toThrow('unreachable')
  })

  it('rejects an impossible jump-to-roll transition and a late prompt', () => {
    const actionTrap: readonly SpawnEvent[] = [
      hazard('jump-all', 30, [
        obstacle('jump-left', 'barrier', -1, 30),
        obstacle('jump-center', 'barrier', 0, 30),
        obstacle('jump-right', 'barrier', 1, 30),
      ]),
      hazard('roll-all', 31, [
        obstacle('roll-left', 'overhead', -1, 31),
        obstacle('roll-center', 'overhead', 0, 31),
        obstacle('roll-right', 'overhead', 1, 31),
      ]),
    ]
    const latePrompt: readonly SpawnEvent[] = [gateEvent('late', 100, 140)]

    expect(() => assertSolvableSchedule(actionTrap)).toThrow('unreachable')
    expect(() => assertSolvableSchedule(latePrompt)).toThrow('45')
  })

  it.each([
    ['', 5_000, 'seed'],
    ['contains spaces', 5_000, 'seed'],
    ['valid', -1, 'lengthM'],
    ['valid', 1.5, 'lengthM'],
    ['valid', Number.NaN, 'lengthM'],
    ['valid', 100_001, 'lengthM'],
  ] as const)('rejects hostile builder input %#', (seed, lengthM, field) => {
    expect(() => buildSpawnSchedule(seed, lengthM)).toThrow(field)
  })

  it('rejects sparse, prototype-backed, and duplicate schedule identities', () => {
    const inherited = hazard('inherited', 30, [
      obstacle('inherited-coin', 'coin', 0, 30),
    ])
    const sparse: SpawnEvent[] = []
    sparse.length = 1
    const prototype = Object.create(Array.prototype) as Record<number, unknown>
    prototype[0] = inherited
    Object.setPrototypeOf(sparse, prototype)

    expect(() => assertSolvableSchedule(sparse)).toThrow('dense own-slot array')
    expect(() =>
      assertSolvableSchedule([Object.create(inherited) as SpawnEvent]),
    ).toThrow('own property')
    expect(() =>
      assertSolvableSchedule([
        inherited,
        hazard('inherited', 60, [
          obstacle('other-coin', 'coin', 1, 60),
        ]),
      ]),
    ).toThrow('unique')
    expect(() =>
      assertSolvableSchedule([
        hazard('one', 30, [
          obstacle('same-obstacle', 'coin', 0, 30),
        ]),
        hazard('two', 60, [
          obstacle('same-obstacle', 'coin', 1, 60),
        ]),
      ]),
    ).toThrow('unique')
  })

  it('rejects unsafe course and response distances', () => {
    const hugeDistance = Number.MAX_VALUE
    const hugeHazard = hazard('huge', hugeDistance, [
      obstacle('huge-coin', 'coin', 0, hugeDistance),
    ])
    const hugeResponse = gateEvent('huge-response', 100, 100_001)

    expect(() => assertSolvableSchedule([hugeHazard])).toThrow('distanceM')
    expect(() => assertSolvableSchedule([hugeResponse])).toThrow(
      'responseDistanceM',
    )
  })
})

describe('market gate resolution', () => {
  it('increments streak first, awards 100 times that streak, and clamps Powell', () => {
    const gate = longGate()
    const state = mutableRunner({
      streak: 2,
      score: 50,
      bestScore: 50,
      powellGap: 95,
    })

    const result = resolveMarketGate(state, gate, 'long')

    expect(state.streak).toBe(3)
    expect(state.score).toBe(350)
    expect(state.bestScore).toBe(350)
    expect(state.powellGap).toBe(100)
    expect(result).toEqual({
      gateId: gate.id,
      answer: 'long',
      expected: 'long',
      correct: true,
      scoreDelta: 300,
      streak: 3,
      powellGap: 100,
    })
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('resets a wrong answer to streak one and removes 12 Powell gap', () => {
    const gate = longGate()
    const state = mutableRunner({ streak: 7, score: 800, bestScore: 800, powellGap: 30 })

    const result = resolveMarketGate(state, gate, 'short')

    expect(state.streak).toBe(1)
    expect(state.score).toBe(800)
    expect(state.powellGap).toBe(18)
    expect(state.phase).toBe('running')
    expect(result).toEqual(
      expect.objectContaining({ correct: false, scoreDelta: 0, streak: 1 }),
    )
  })

  it('ends the run with deterministic Powell failure copy at zero gap', () => {
    const state = mutableRunner({ streak: 4, powellGap: 5 })

    resolveMarketGate(state, longGate(), 'short')

    expect(state.powellGap).toBe(0)
    expect(state.phase).toBe('gameOver')
    expect(state.lastFailure).toEqual({
      kind: 'powell',
      message: 'Powell closed the gap',
      tip: 'Build the gap with correct LONG or SHORT calls',
    })
  })

  it('rejects invalid answers, prototype gates, and score overflow atomically', () => {
    const gate = longGate()
    const invalidAnswerState = mutableRunner()
    const inheritedGate = Object.create(gate) as MarketGate
    const overflowState = mutableRunner({
      streak: Number.MAX_SAFE_INTEGER,
      score: 0,
      bestScore: 0,
    })
    const invalidBefore = structuredClone(invalidAnswerState)
    const overflowBefore = structuredClone(overflowState)

    expect(() =>
      resolveMarketGate(
        invalidAnswerState,
        gate,
        'hold' as Parameters<typeof resolveMarketGate>[2],
      ),
    ).toThrow('answer')
    expect(invalidAnswerState).toEqual(invalidBefore)
    expect(() => resolveMarketGate(invalidAnswerState, inheritedGate, 'long')).toThrow(
      'own property',
    )
    expect(() => resolveMarketGate(overflowState, gate, 'long')).toThrow('safe integer')
    expect(overflowState).toEqual(overflowBefore)
  })
})
