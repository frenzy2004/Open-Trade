import type Phaser from 'phaser'
import {
  resolveRunnerTexture,
  type RunnerTextureId,
} from '../assets/runnerAssets'
import type {
  ObstacleKind,
  RunnerObstacle,
  RunnerState,
} from '../engine/types'

const RUNNER_ANIMATION_KEY = 'ws-runner-loop-animation'
const LANE_CENTER_X = 640
const LANE_GAP_X = 190
const RUNNER_GROUND_Y = 638
const VISIBLE_DISTANCE_M = 90

const ENTITY_TEXTURES: Readonly<Partial<Record<ObstacleKind, RunnerTextureId>>> =
  Object.freeze({
    train: 'ws-train',
    barrier: 'ws-barrier',
    coin: 'ws-coin',
  })

function trainTint(ticker: string | undefined): number {
  if (ticker === undefined) return 0xffffff
  let checksum = 0
  for (let index = 0; index < ticker.length; index += 1) {
    checksum += ticker.charCodeAt(index)
  }
  return checksum % 2 === 0 ? 0xc8ffe0 : 0xffc9c2
}

export class RunnerRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics
  private readonly scene: Phaser.Scene
  private readonly entitySprites = new Map<string, Phaser.GameObjects.Image>()
  private readonly entityLabels = new Map<string, Phaser.GameObjects.Text>()
  private runnerSprite: Phaser.GameObjects.Sprite | null = null
  private runnerAvatar: Phaser.GameObjects.Image | null = null
  private previousPhase: RunnerState['phase'] | null = null
  private previousFeedbackTick: number | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(3)
    this.createRunnerVisual()
  }

  private createRunnerVisual(): void {
    const runLoop = resolveRunnerTexture(this.scene.textures, 'ws-run-loop')
    if (runLoop.mode === 'texture') {
      if (!this.scene.anims.exists(RUNNER_ANIMATION_KEY)) {
        this.scene.anims.create({
          key: RUNNER_ANIMATION_KEY,
          frames: this.scene.anims.generateFrameNumbers(runLoop.key, {
            start: 0,
            end: 14,
          }),
          frameRate: 16,
          repeat: -1,
        })
      }
      this.runnerSprite = this.scene.add
        .sprite(LANE_CENTER_X, RUNNER_GROUND_Y, runLoop.key, 0)
        .setOrigin(0.5, 1)
        .setDepth(10)
      this.runnerSprite.play(RUNNER_ANIMATION_KEY)
      return
    }

    const avatar = resolveRunnerTexture(this.scene.textures, 'ws-runner-avatar')
    if (avatar.mode === 'texture') {
      this.runnerAvatar = this.scene.add
        .image(LANE_CENTER_X, RUNNER_GROUND_Y, avatar.key)
        .setOrigin(0.5, 1)
        .setDepth(10)
    }
  }

  private cleanupEntityVisual(id: string): void {
    this.entitySprites.get(id)?.destroy()
    this.entitySprites.delete(id)
    this.entityLabels.get(id)?.destroy()
    this.entityLabels.delete(id)
  }

  private hasRenderableEntity(state: RunnerState, id: string): boolean {
    for (const entity of state.entities) {
      if (entity.id !== id || entity.resolved) continue
      const aheadM = entity.distanceM - state.distanceM
      return aheadM >= -1 && aheadM <= VISIBLE_DISTANCE_M
    }
    return false
  }

  private reconcileEntityVisuals(state: RunnerState): void {
    for (const id of this.entitySprites.keys()) {
      if (!this.hasRenderableEntity(state, id)) this.cleanupEntityVisual(id)
    }
    for (const id of this.entityLabels.keys()) {
      if (!this.hasRenderableEntity(state, id)) this.cleanupEntityVisual(id)
    }
  }

  private entitySprite(obstacle: RunnerObstacle): Phaser.GameObjects.Image | null {
    const existing = this.entitySprites.get(obstacle.id)
    if (existing !== undefined) return existing
    const textureKey = ENTITY_TEXTURES[obstacle.kind]
    if (textureKey === undefined) return null
    const resolved = resolveRunnerTexture(this.scene.textures, textureKey)
    if (resolved.mode === 'procedural') return null
    const sprite = this.scene.add
      .image(0, 0, resolved.key)
      .setOrigin(0.5)
      .setDepth(5)
    if (obstacle.kind === 'train') sprite.setTint(trainTint(obstacle.ticker))
    this.entitySprites.set(obstacle.id, sprite)
    return sprite
  }

  private entityLabel(obstacle: RunnerObstacle): Phaser.GameObjects.Text | null {
    if (obstacle.kind !== 'train' && obstacle.kind !== 'overhead') return null
    const existing = this.entityLabels.get(obstacle.id)
    if (existing !== undefined) return existing
    const label = this.scene.add.text(
      0,
      0,
      obstacle.kind === 'train' ? obstacle.ticker ?? 'MARKET' : 'ROLL',
      {
        color: '#171512',
        backgroundColor: '#f4c542',
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        padding: { x: 8, y: 4 },
      },
    ).setOrigin(0.5).setDepth(6)
    this.entityLabels.set(obstacle.id, label)
    return label
  }

  private drawProceduralObstacle(
    obstacle: RunnerObstacle,
    x: number,
    y: number,
    depth: number,
  ): void {
    if (obstacle.kind === 'coin') {
      this.graphics.fillStyle(0xffd84d, 1)
      this.graphics.fillCircle(x, y, 16 * depth)
    } else if (obstacle.kind === 'train') {
      this.graphics.fillStyle(0xdc3c3c, 1)
      this.graphics.fillRoundedRect(
        x - 55 * depth,
        y - 80 * depth,
        110 * depth,
        160 * depth,
        10 * depth,
      )
    } else if (obstacle.kind === 'barrier') {
      this.graphics.fillStyle(0xf28c28, 1)
      this.graphics.fillRect(
        x - 48 * depth,
        y - 26 * depth,
        96 * depth,
        52 * depth,
      )
    } else {
      this.graphics.fillStyle(0x20242d, 1)
      this.graphics.fillRect(
        x - 62 * depth,
        y - 95 * depth,
        124 * depth,
        28 * depth,
      )
    }
  }

  private renderRunner(state: RunnerState, laneX: number, jumpOffset: number): void {
    const runnerHeight = state.vertical === 'rolling' ? 50 : 104
    const runnerY = RUNNER_GROUND_Y + jumpOffset
    const visual = this.runnerSprite ?? this.runnerAvatar
    if (visual !== null) {
      visual.setPosition(laneX, runnerY)
      visual.setDisplaySize(104, runnerHeight)
    }
    if (this.runnerSprite !== null) {
      if (state.reducedMotion) {
        this.runnerSprite.anims.pause()
        this.runnerSprite.setFrame(0)
      } else if (!this.runnerSprite.anims.isPlaying) {
        this.runnerSprite.play(RUNNER_ANIMATION_KEY)
      }
    }
    if (visual === null) {
      this.graphics.fillStyle(0xf7d154, 1)
      this.graphics.fillRoundedRect(
        laneX - 28,
        560 + jumpOffset,
        56,
        state.vertical === 'rolling' ? 42 : 78,
        18,
      )
    }
  }

  private renderEffects(state: RunnerState): void {
    const feedbackTick = state.lastGateFeedback?.resolvedAtTick ?? null
    if (
      feedbackTick !== null
      && feedbackTick !== this.previousFeedbackTick
      && !state.reducedMotion
    ) {
      const color = state.lastGateFeedback?.correct === true ? 46 : 216
      this.scene.cameras.main.flash(130, color, 143, 96, false)
    }
    if (
      state.phase === 'gameOver'
      && this.previousPhase !== 'gameOver'
      && !state.reducedMotion
    ) {
      this.scene.cameras.main.shake(160, 0.006)
    }
    this.previousPhase = state.phase
    this.previousFeedbackTick = feedbackTick
  }

  render(state: RunnerState): void {
    this.reconcileEntityVisuals(state)
    const laneX = LANE_CENTER_X + state.lane * LANE_GAP_X
    const jumpOffset = state.vertical === 'jumping' ? -70 : 0
    this.graphics.clear()
    this.graphics.lineStyle(4, 0xffffff, 0.24)
    this.graphics.lineBetween(450, 0, 450, 720)
    this.graphics.lineBetween(830, 0, 830, 720)
    const trackOffset = (state.distanceM * 12) % 110
    for (let index = -1; index < 7; index += 1) {
      const markerY = index * 110 + trackOffset
      const markerWidth = Math.max(18, markerY / 4)
      this.graphics.lineStyle(3, 0xf4c542, 0.34)
      this.graphics.lineBetween(
        LANE_CENTER_X - markerWidth,
        markerY,
        LANE_CENTER_X + markerWidth,
        markerY,
      )
    }
    for (const entity of state.entities) {
      const obstacle = entity as RunnerObstacle
      const aheadM = obstacle.distanceM - state.distanceM
      if (entity.resolved || aheadM < -1) {
        this.cleanupEntityVisual(entity.id)
        continue
      }
      if (aheadM > VISIBLE_DISTANCE_M) continue
      const depth = Math.max(0.18, 1 - aheadM / 105)
      const obstacleX = LANE_CENTER_X + obstacle.lane * LANE_GAP_X * depth
      const obstacleY = 560 - (aheadM / VISIBLE_DISTANCE_M) * 500
      const sprite = this.entitySprite(obstacle)
      if (sprite === null) {
        this.drawProceduralObstacle(obstacle, obstacleX, obstacleY, depth)
      } else {
        const baseWidth = obstacle.kind === 'train'
          ? 150
          : obstacle.kind === 'barrier'
            ? 120
            : 48
        const baseHeight = obstacle.kind === 'train'
          ? 190
          : obstacle.kind === 'barrier'
            ? 78
            : 48
        sprite.setPosition(obstacleX, obstacleY)
        sprite.setDisplaySize(baseWidth * depth, baseHeight * depth)
      }
      const label = this.entityLabel(obstacle)
      if (label !== null) {
        label.setPosition(
          obstacleX,
          obstacleY - (obstacle.kind === 'train' ? 12 : 80) * depth,
        )
        label.setScale(Math.max(0.45, depth))
      }
    }
    const powellPressure = 1 - state.powellGap / 100
    if (powellPressure > 0.35) {
      const powellY = 715 - powellPressure * 105
      this.graphics.fillStyle(0xd84a3a, 0.68)
      this.graphics.fillCircle(LANE_CENTER_X - 24, powellY - 42, 20)
      this.graphics.fillRoundedRect(LANE_CENTER_X - 52, powellY - 24, 56, 72, 16)
    }
    if (state.currentGate !== null) {
      this.graphics.fillStyle(0x2ed573, 0.22)
      this.graphics.fillRect(390, 45, 500, 95)
    }
    this.renderRunner(state, laneX, jumpOffset)
    this.renderEffects(state)
  }

  destroy(): void {
    for (const sprite of this.entitySprites.values()) sprite.destroy()
    for (const label of this.entityLabels.values()) label.destroy()
    this.entitySprites.clear()
    this.entityLabels.clear()
    this.runnerSprite?.destroy()
    this.runnerAvatar?.destroy()
    this.graphics.destroy()
  }
}
