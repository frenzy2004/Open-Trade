import Phaser from 'phaser'
import type { RunnerState } from '../engine/types'
import { RunnerRenderer } from './RunnerRenderer'

export interface RunnerSceneOptions {
  readonly advanceFrame: (deltaMs: number) => void
  readonly snapshot: () => RunnerState
}

export class RunnerScene extends Phaser.Scene {
  private runnerRenderer: RunnerRenderer | null = null

  constructor(private readonly runnerOptions: RunnerSceneOptions) {
    super({ key: 'wallstreet-surfer-runner' })
  }

  create(): void {
    this.runnerRenderer = new RunnerRenderer(this)
  }

  update(_time: number, deltaMs: number): void {
    this.runnerOptions.advanceFrame(deltaMs)
    this.runnerRenderer?.render(this.runnerOptions.snapshot())
  }

  destroyRenderer(): void {
    this.runnerRenderer?.destroy()
    this.runnerRenderer = null
  }
}
