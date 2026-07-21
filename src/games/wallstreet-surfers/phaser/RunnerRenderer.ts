import type Phaser from 'phaser'
import type { RunnerState } from '../engine/types'

export class RunnerRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics()
  }

  render(state: RunnerState): void {
    const laneX = 640 + state.lane * 190
    const jumpOffset = state.vertical === 'jumping' ? -70 : 0
    const runnerHeight = state.vertical === 'rolling' ? 42 : 78
    this.graphics.clear()
    this.graphics.lineStyle(4, 0xffffff, 0.24)
    this.graphics.lineBetween(450, 0, 450, 720)
    this.graphics.lineBetween(830, 0, 830, 720)
    this.graphics.fillStyle(0xf7d154, 1)
    this.graphics.fillRoundedRect(
      laneX - 28,
      560 + jumpOffset,
      56,
      runnerHeight,
      18,
    )
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
