import { asset, type AssetRecord } from '../../../assets/catalog'
import type { RunnerPhase, RunnerState } from '../engine/types'

export type RunnerAudioCue =
  | 'background'
  | 'confirm'
  | 'gate-success'
  | 'gate-failure'
  | 'coin'
  | 'collision'

export const RUNNER_AUDIO_ASSETS: Readonly<Record<RunnerAudioCue, AssetRecord>> =
  Object.freeze({
    background: asset('arcade-loop'),
    confirm: asset('ui-confirm'),
    'gate-success': asset('market-success'),
    'gate-failure': asset('market-failure'),
    coin: asset('coin-pickup'),
    collision: asset('collision'),
  })

export interface RunnerAudioPlayer {
  play(src: string): Promise<boolean>
}

export class RunnerAudioController {
  private previousPhase: RunnerPhase | null = null
  private previousCoins = 0
  private previousFeedbackTick: number | null = null

  constructor(private readonly player: RunnerAudioPlayer) {}

  private play(cue: RunnerAudioCue): void {
    try {
      void this.player.play(RUNNER_AUDIO_ASSETS[cue].url).catch(() => false)
    } catch {
      // Audio is an enhancement. A failed media implementation cannot stop play.
    }
  }

  observe(state: RunnerState): void {
    const feedbackTick = state.lastGateFeedback?.resolvedAtTick ?? null
    if (state.coins > this.previousCoins) this.play('coin')
    if (feedbackTick !== null && feedbackTick !== this.previousFeedbackTick) {
      this.play(state.lastGateFeedback?.correct === true
        ? 'gate-success'
        : 'gate-failure')
    }
    if (
      state.phase === 'gameOver'
      && this.previousPhase !== 'gameOver'
      && state.lastFailure !== null
    ) {
      this.play('collision')
    }

    this.previousPhase = state.phase
    this.previousCoins = state.coins
    this.previousFeedbackTick = feedbackTick
  }

  confirm(): void {
    this.play('confirm')
  }

}
