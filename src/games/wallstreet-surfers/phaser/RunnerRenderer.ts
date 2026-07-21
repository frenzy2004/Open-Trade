import type Phaser from 'phaser'
import type { RunnerObstacle, RunnerState } from '../engine/types'

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
    for (const entity of state.entities) {
      if (entity.resolved) continue
      const obstacle = entity as RunnerObstacle
      const aheadM = obstacle.distanceM - state.distanceM
      if (aheadM < -1 || aheadM > 90) continue
      const depth = Math.max(0.18, 1 - aheadM / 105)
      const obstacleX = 640 + obstacle.lane * 190 * depth
      const obstacleY = 560 - (aheadM / 90) * 500
      if (obstacle.kind === 'coin') {
        this.graphics.fillStyle(0xffd84d, 1)
        this.graphics.fillCircle(obstacleX, obstacleY, 16 * depth)
      } else if (obstacle.kind === 'train') {
        this.graphics.fillStyle(0xdc3c3c, 1)
        this.graphics.fillRoundedRect(
          obstacleX - 55 * depth,
          obstacleY - 80 * depth,
          110 * depth,
          160 * depth,
          10 * depth,
        )
      } else if (obstacle.kind === 'barrier') {
        this.graphics.fillStyle(0xf28c28, 1)
        this.graphics.fillRect(
          obstacleX - 48 * depth,
          obstacleY - 26 * depth,
          96 * depth,
          52 * depth,
        )
      } else {
        this.graphics.fillStyle(0x20242d, 1)
        this.graphics.fillRect(
          obstacleX - 62 * depth,
          obstacleY - 95 * depth,
          124 * depth,
          28 * depth,
        )
      }
    }
    if (state.currentGate !== null) {
      this.graphics.fillStyle(0x2ed573, 0.22)
      this.graphics.fillRect(390, 45, 500, 95)
    }
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
