import Phaser from 'phaser'
import { RUNNER_TEXTURE_ASSETS } from '../assets/runnerAssets'
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

  preload(): void {
    for (const media of RUNNER_TEXTURE_ASSETS) {
      if (media.kind === 'spritesheet' && media.frame !== undefined) {
        this.load.spritesheet(media.id, media.url, {
          frameWidth: media.frame.width,
          frameHeight: media.frame.height,
          endFrame: media.frame.count - 1,
        })
      } else {
        this.load.image(media.id, media.url)
      }
    }
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
