import { describe, expect, it, vi } from 'vitest'
import { asset } from '../../../assets/catalog'
import { createRunnerState } from '../engine/createRunnerState'
import {
  RUNNER_AUDIO_ASSETS,
  RunnerAudioController,
  type RunnerAudioPlayer,
} from '../audio/runnerAudio'
import {
  RUNNER_BACKGROUND_ASSET,
  RUNNER_TEXTURE_ASSETS,
  resolveRunnerTexture,
} from './runnerAssets'

const EXPECTED_TEXTURE_IDS = [
  'ws-runner-avatar',
  'ws-run-loop',
  'ws-train',
  'ws-barrier',
  'ws-long-arrow',
  'ws-short-arrow',
  'ws-coin',
] as const

describe('Wallstreet Surfers media contract', () => {
  it('exposes only approved local runner art and keeps the street in CSS', () => {
    expect(RUNNER_BACKGROUND_ASSET).toMatchObject({
      id: 'ws-runner-street',
      target: 'css-background',
      fallback: 'gradient',
    })
    expect(RUNNER_TEXTURE_ASSETS.map(({ id }) => id)).toEqual(
      EXPECTED_TEXTURE_IDS,
    )
    expect(Object.isFrozen(RUNNER_TEXTURE_ASSETS)).toBe(true)

    for (const media of [RUNNER_BACKGROUND_ASSET, ...RUNNER_TEXTURE_ASSETS]) {
      expect(media.url).toBe(asset(media.id).url)
      expect(media.url).not.toMatch(/^https?:/)
      expect(Object.isFrozen(media)).toBe(true)
    }
  })

  it('falls back procedurally when an optional Phaser texture is unavailable', () => {
    expect(resolveRunnerTexture({ exists: () => true }, 'ws-train')).toEqual({
      mode: 'texture',
      key: 'ws-train',
    })
    expect(resolveRunnerTexture({ exists: () => false }, 'ws-train')).toEqual({
      mode: 'procedural',
    })
  })

  it('maps state transitions to the exact approved semantic audio cues', () => {
    const player: RunnerAudioPlayer = {
      play: vi.fn(async () => true),
    }
    const controller = new RunnerAudioController(player)
    const state = createRunnerState({ seed: 'runner-audio', reducedMotion: false })
    state.phase = 'tutorial'
    controller.observe(state)

    state.phase = 'running'
    controller.observe(state)
    state.coins = 1
    controller.observe(state)
    state.lastGateFeedback = {
      gateId: 'fed-cpi',
      ticker: 'SPY',
      answer: 'long',
      expected: 'long',
      correct: true,
      timedOut: false,
      scoreDelta: 500,
      explanation: 'Rates support the call.',
      resolvedAtTick: 10,
    }
    controller.observe(state)
    state.lastGateFeedback = {
      ...state.lastGateFeedback,
      correct: false,
      scoreDelta: 0,
      resolvedAtTick: 11,
    }
    controller.observe(state)
    state.phase = 'gameOver'
    state.lastFailure = {
      kind: 'train',
      message: 'You got wrecked by TSLA',
      tip: 'Switch lanes before the ticker train arrives',
      ticker: 'TSLA',
    }
    controller.observe(state)
    controller.confirm()

    expect(player.play).toHaveBeenCalledTimes(5)
    expect(player.play).toHaveBeenNthCalledWith(1, asset('coin-pickup').url)
    expect(player.play).toHaveBeenNthCalledWith(2, asset('market-success').url)
    expect(player.play).toHaveBeenNthCalledWith(3, asset('market-failure').url)
    expect(player.play).toHaveBeenNthCalledWith(4, asset('collision').url)
    expect(player.play).toHaveBeenNthCalledWith(5, asset('ui-confirm').url)
    expect(Object.keys(RUNNER_AUDIO_ASSETS)).toEqual([
      'background',
      'confirm',
      'gate-success',
      'gate-failure',
      'coin',
      'collision',
    ])
  })

  it('stays playable when audio is muted or playback is unavailable', () => {
    const player: RunnerAudioPlayer = {
      play: vi.fn(async () => false),
    }
    const controller = new RunnerAudioController(player)
    const state = createRunnerState({ seed: 'silent-runner', reducedMotion: true })

    expect(() => {
      state.phase = 'running'
      controller.observe(state)
      controller.confirm()
    }).not.toThrow()
    expect(player.play).toHaveBeenCalledWith(asset('ui-confirm').url)
    expect(state).toMatchObject({ phase: 'running', reducedMotion: true })
  })
})
