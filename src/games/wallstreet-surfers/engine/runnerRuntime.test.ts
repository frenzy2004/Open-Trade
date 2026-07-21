import { describe, expect, it } from 'vitest'
import { createRunnerState } from './createRunnerState'
import { FIXED_STEP_MS } from './types'
import {
  createRunnerRuntime,
  stepRunnerRuntime,
} from './runnerRuntime'

describe('live runner runtime', () => {
  it('builds a reproducible seeded schedule and spawns mutable hazards ahead', () => {
    const first = createRunnerRuntime('runtime-seed', 5_000)
    const second = createRunnerRuntime('runtime-seed', 5_000)
    expect(second.schedule).toEqual(first.schedule)
    const hazard = first.schedule.find((event) => event.type === 'hazard')
    if (hazard?.type !== 'hazard') throw new Error('Expected a hazard')
    const state = createRunnerState({ seed: 'runtime-seed', reducedMotion: false })
    state.distanceM = Math.max(0, hazard.distanceM - 90)

    stepRunnerRuntime(first, state, [], 0)

    expect(state.entities.map(({ id }) => id)).toEqual(
      hazard.obstacles.map(({ id }) => id),
    )
    expect(state.entities[0]).not.toBe(hazard.obstacles[0])
    expect(Object.isFrozen(state.entities[0])).toBe(false)
  })

  it('opens the current gate and resolves JUMP as LONG without jumping', () => {
    const runtime = createRunnerRuntime('long-runtime', 5_000)
    const event = runtime.schedule.find(
      (candidate) => candidate.type === 'market-gate' && candidate.gate.answer === 'long',
    )
    if (event?.type !== 'market-gate') throw new Error('Expected a LONG gate')
    const state = createRunnerState({ seed: 'long-runtime', reducedMotion: false })
    state.distanceM = event.distanceM
    stepRunnerRuntime(runtime, state, [], 0)
    expect(state.currentGate).toMatchObject({
      eventId: event.id,
      responseDistanceM: event.responseDistanceM,
    })

    stepRunnerRuntime(runtime, state, ['JUMP'], 0)

    expect(state.vertical).toBe('grounded')
    expect(state.currentGate).toBeNull()
    expect(state.lastGateFeedback).toMatchObject({
      answer: 'long',
      correct: true,
      timedOut: false,
    })
    expect(state.score).toBeGreaterThan(0)
  })

  it('resolves ROLL as SHORT and times out an unanswered window as incorrect', () => {
    const runtime = createRunnerRuntime('short-runtime', 5_000)
    const shortEvent = runtime.schedule.find(
      (candidate) => candidate.type === 'market-gate' && candidate.gate.answer === 'short',
    )
    if (shortEvent?.type !== 'market-gate') throw new Error('Expected a SHORT gate')
    const shortState = createRunnerState({ seed: 'short-runtime', reducedMotion: false })
    shortState.distanceM = shortEvent.distanceM
    stepRunnerRuntime(runtime, shortState, [], 0)
    stepRunnerRuntime(runtime, shortState, ['ROLL'], 0)
    expect(shortState.lastGateFeedback).toMatchObject({
      answer: 'short',
      correct: true,
      timedOut: false,
    })
    expect(shortState.vertical).toBe('grounded')

    const timeoutState = createRunnerState({ seed: 'short-runtime', reducedMotion: false })
    timeoutState.distanceM = shortEvent.distanceM
    stepRunnerRuntime(runtime, timeoutState, [], 0)
    timeoutState.distanceM = shortEvent.responseDistanceM + 0.01
    stepRunnerRuntime(runtime, timeoutState, [], 0)
    expect(timeoutState.currentGate).toBeNull()
    expect(timeoutState.lastGateFeedback).toMatchObject({
      correct: false,
      timedOut: true,
    })
  })

  it('resets schedule progress and reproduces the same first entities', () => {
    const runtime = createRunnerRuntime('restart-runtime', 5_000)
    const state = createRunnerState({ seed: 'restart-runtime', reducedMotion: false })
    stepRunnerRuntime(runtime, state, [], 0)
    const firstIds = state.entities.map(({ id }) => id)
    state.score = 500

    stepRunnerRuntime(runtime, state, ['RESTART'], 0)
    stepRunnerRuntime(runtime, state, [], 0)

    expect(state.nextSpawnIndex).toBeGreaterThan(0)
    expect(state.entities.map(({ id }) => id)).toEqual(firstIds)
    expect(state.bestScore).toBe(500)
  })

  it('applies deterministic Powell pressure and ends with the exact recovery tip', () => {
    const runtime = createRunnerRuntime('powell-runtime', 5_000)
    const state = createRunnerState({ seed: 'powell-runtime', reducedMotion: false })
    state.powellGap = 0.001

    stepRunnerRuntime(runtime, state, [], FIXED_STEP_MS)

    expect(state.phase).toBe('gameOver')
    expect(state.powellGap).toBe(0)
    expect(state.lastFailure).toEqual({
      kind: 'powell',
      message: 'Powell closed the gap',
      tip: 'Build the gap with correct LONG or SHORT calls',
    })
  })
})
