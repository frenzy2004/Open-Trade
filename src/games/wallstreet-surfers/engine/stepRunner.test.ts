import { describe, expect, it } from 'vitest'
import { createRunnerState } from './createRunnerState'
import { FIXED_STEP_MS, type RunnerState } from './types'
import { stepRunner } from './stepRunner'

function copyState(overrides: Partial<RunnerState> = {}): RunnerState {
  return {
    ...createRunnerState({ seed: 'state-probe', reducedMotion: false }),
    ...overrides,
  }
}

describe('runner fixed-step progression', () => {
  it('replays an identical seed deterministically for ten seconds', () => {
    const a = createRunnerState({ seed: 'demo', reducedMotion: false })
    const b = createRunnerState({ seed: 'demo', reducedMotion: false })

    for (let index = 0; index < 600; index += 1) {
      expect(stepRunner(a, [], 1000 / 60)).toBe(a)
      stepRunner(b, [], 1000 / 60)
    }

    expect(a).toEqual(b)
    expect(a.distanceM).toBeGreaterThan(0)
    expect(a.elapsedMs).toBeCloseTo(10_000, 5)
    expect(a.tick).toBe(600)
  })

  it('produces the same simulation for differently chunked frame time', () => {
    const perTick = createRunnerState({ seed: 'frame-chunks', reducedMotion: true })
    const mixedChunks = createRunnerState({
      seed: 'frame-chunks',
      reducedMotion: true,
    })

    for (let index = 0; index < 600; index += 1) {
      stepRunner(perTick, [], FIXED_STEP_MS)
    }
    for (let index = 0; index < 50; index += 1) {
      stepRunner(mixedChunks, [], 37)
      stepRunner(mixedChunks, [], 63)
      stepRunner(mixedChunks, [], 100)
    }

    expect(mixedChunks).toEqual(perTick)
  })

  it('does not clamp a large elapsed chunk inside the pure engine', () => {
    const chunked = createRunnerState({ seed: 'adapter-clamps', reducedMotion: false })
    const perTick = createRunnerState({ seed: 'adapter-clamps', reducedMotion: false })

    stepRunner(chunked, [], 1_000)
    for (let index = 0; index < 60; index += 1) {
      stepRunner(perTick, [], FIXED_STEP_MS)
    }

    expect(chunked).toEqual(perTick)
    expect(chunked.elapsedMs).toBeCloseTo(1_000, 8)
  })

  it.each(['tutorial', 'paused', 'gameOver'] as const)(
    'does not advance while phase is %s',
    (phase) => {
      const state = copyState({ phase })

      stepRunner(state, [], 2_000)

      expect(state.elapsedMs).toBe(0)
      expect(state.distanceM).toBe(0)
      expect(state.tick).toBe(0)
      expect(state.simulationRemainderMs).toBe(0)
    },
  )

  it('toggles pause without consuming the command frame', () => {
    const state = createRunnerState({ seed: 'pause', reducedMotion: false })

    stepRunner(state, ['PAUSE'], 500)
    expect(state.phase).toBe('paused')
    expect(state.elapsedMs).toBe(0)

    stepRunner(state, ['PAUSE'], 500)
    expect(state.phase).toBe('running')
    expect(state.elapsedMs).toBe(0)

    stepRunner(state, [], 500)
    expect(state.elapsedMs).toBeCloseTo(500, 8)
  })

  it('restarts the same seed and settings while preserving the best score', () => {
    const state = createRunnerState({
      seed: 'same-run',
      reducedMotion: true,
      bestScore: 250,
    })
    stepRunner(state, [], 2_000)
    state.score = 900
    state.bestScore = 900
    state.coins = 5
    state.streak = 4
    state.powellGap = 19
    state.phase = 'gameOver'

    stepRunner(state, ['RESTART'], FIXED_STEP_MS)

    expect(state).toEqual(
      createRunnerState({
        seed: 'same-run',
        reducedMotion: true,
        bestScore: 900,
      }),
    )
  })

  it('ramps speed by 0.12 m/s each 100m and caps it at 22 m/s', () => {
    const state = createRunnerState({ seed: 'speed', reducedMotion: false })

    stepRunner(state, [], 12_000)
    expect(state.distanceM).toBeGreaterThan(100)
    expect(state.speedMps).toBeGreaterThanOrEqual(8.62)

    stepRunner(state, [], 1_000_000)
    expect(state.speedMps).toBe(22)
  })

  it('adds one score point per completed meter', () => {
    const state = createRunnerState({ seed: 'distance-score', reducedMotion: false })

    stepRunner(state, [], 2_000)

    expect(state.score).toBe(Math.floor(state.distanceM))
    expect(state.bestScore).toBe(state.score)
  })
})

describe('runner runtime validation', () => {
  it.each([
    [{ seed: '', reducedMotion: false }, 'seed'],
    [{ seed: 'contains spaces', reducedMotion: false }, 'seed'],
    [{ seed: 'ok', reducedMotion: 'no' }, 'reducedMotion'],
    [{ seed: 'ok', reducedMotion: false, bestScore: -1 }, 'bestScore'],
    [{ seed: 'ok', reducedMotion: false, bestScore: 1.5 }, 'bestScore'],
  ] as const)('rejects hostile config %#', (config, field) => {
    expect(() =>
      createRunnerState(config as unknown as Parameters<typeof createRunnerState>[0]),
    ).toThrow(field)
  })

  it('rejects prototype-backed config and state fields', () => {
    const inheritedConfig = Object.create({
      seed: 'inherited-config',
      reducedMotion: false,
    }) as Parameters<typeof createRunnerState>[0]
    const inheritedState = Object.create(
      createRunnerState({ seed: 'inherited-state', reducedMotion: false }),
    ) as RunnerState

    expect(() => createRunnerState(inheritedConfig)).toThrow('own property')
    expect(() => stepRunner(inheritedState, [], 0)).toThrow('own property')
  })

  it('rejects a prototype-backed optional best score', () => {
    const config = Object.assign(
      Object.create({ bestScore: 500 }),
      { seed: 'own-config', reducedMotion: false },
    ) as Parameters<typeof createRunnerState>[0]

    expect(() => createRunnerState(config)).toThrow('bestScore')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects invalid elapsed time %s',
    (deltaMs) => {
      const state = createRunnerState({ seed: 'delta', reducedMotion: false })

      expect(() => stepRunner(state, [], deltaMs)).toThrow('fixedDeltaMs')
    },
  )

  it('accepts zero elapsed time as an explicit no-op', () => {
    const state = createRunnerState({ seed: 'no-op', reducedMotion: false })

    expect(stepRunner(state, [], 0)).toBe(state)
    expect(state.elapsedMs).toBe(0)
  })

  it.each([
    null,
    {},
    ['TELEPORT'],
    ['MOVE_LEFT', 'TELEPORT'],
    [1],
  ])('rejects hostile command collections %#', (commands) => {
    const state = createRunnerState({ seed: 'commands', reducedMotion: false })

    expect(() =>
      stepRunner(
        state,
        commands as unknown as Parameters<typeof stepRunner>[1],
        FIXED_STEP_MS,
      ),
    ).toThrow('commands')
  })

  it('rejects sparse command arrays even when a prototype supplies the slot', () => {
    const commands: unknown[] = []
    commands.length = 1
    const prototype = Object.create(Array.prototype) as Record<number, unknown>
    prototype[0] = 'MOVE_LEFT'
    Object.setPrototypeOf(commands, prototype)
    const state = createRunnerState({ seed: 'sparse-command', reducedMotion: false })

    expect(() =>
      stepRunner(
        state,
        commands as Parameters<typeof stepRunner>[1],
        FIXED_STEP_MS,
      ),
    ).toThrow('dense own-slot array')
    expect(state.lane).toBe(0)
  })

  it('rejects an excessive finite delta before applying commands', () => {
    const state = createRunnerState({ seed: 'huge-delta', reducedMotion: false })
    const before = structuredClone(state)

    expect(() => stepRunner(state, ['MOVE_LEFT'], 1_000_001)).toThrow(
      'fixedDeltaMs',
    )
    expect(state).toEqual(before)
  })

  it.each([
    ['seed', 'contains spaces'],
    ['phase', 'flying'],
    ['elapsedMs', Number.NaN],
    ['distanceM', -1],
    ['speedMps', 30],
    ['lane', 2],
    ['vertical', 'diving'],
    ['verticalUntilMs', -1],
    ['score', 1.5],
    ['bestScore', -1],
    ['coins', -1],
    ['streak', -1],
    ['powellGap', 101],
    ['entities', {}],
    ['nextSpawnIndex', -1],
    ['lastFailure', { kind: 'meteor', message: 'x', tip: 'x' }],
    ['reducedMotion', 'false'],
    ['tick', -1],
    ['simulationRemainderMs', FIXED_STEP_MS],
  ] as const)('rejects a hostile %s state field', (field, value) => {
    const state = copyState({ [field]: value } as Partial<RunnerState>)

    expect(() => stepRunner(state, [], FIXED_STEP_MS)).toThrow(field)
  })

  it('rejects malformed nested entities before simulation', () => {
    const state = copyState({
      entities: [
        {
          id: '',
          kind: 'coin',
          distanceM: 10,
          resolved: false,
        },
      ],
    })

    expect(() => stepRunner(state, [], FIXED_STEP_MS)).toThrow('entities[0].id')
  })

  it('rejects sparse entity arrays and duplicate entity IDs', () => {
    const inheritedEntity = {
      id: 'inherited-entity',
      kind: 'coin',
      lane: 0,
      distanceM: 10,
      resolved: false,
    }
    const sparseEntities: RunnerState['entities'] = []
    sparseEntities.length = 1
    const prototype = Object.create(Array.prototype) as Record<number, unknown>
    prototype[0] = inheritedEntity
    Object.setPrototypeOf(sparseEntities, prototype)

    expect(() =>
      stepRunner(copyState({ entities: sparseEntities }), [], 0),
    ).toThrow('dense own-slot array')

    const duplicate = { ...inheritedEntity, id: 'duplicate' }
    expect(() =>
      stepRunner(
        copyState({ entities: [{ ...duplicate }, { ...duplicate }] }),
        [],
        0,
      ),
    ).toThrow('unique')
  })

  it('rejects prototype-backed failure fields', () => {
    const lastFailure = Object.create({
      kind: 'barrier',
      message: 'Inherited failure',
      tip: 'Inherited tip',
    }) as RunnerState['lastFailure']

    expect(() => stepRunner(copyState({ lastFailure }), [], 0)).toThrow(
      'own property',
    )
  })
})
