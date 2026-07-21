import type Phaser from 'phaser'
import { describe, expect, it, vi } from 'vitest'
import { createRunnerState } from '../engine/createRunnerState'
import {
  createRunnerRuntime,
  stepRunnerRuntime,
} from '../engine/runnerRuntime'
import type { RunnerObstacle } from '../engine/types'
import { RunnerRenderer } from './RunnerRenderer'

interface VisualDouble {
  readonly id: number
  readonly destroy: ReturnType<typeof vi.fn>
  setDepth(): VisualDouble
  setDisplaySize(): VisualDouble
  setOrigin(): VisualDouble
  setPosition(): VisualDouble
  setScale(): VisualDouble
  setTint(): VisualDouble
}

function createVisual(id: number): VisualDouble {
  const visual: VisualDouble = {
    id,
    destroy: vi.fn(),
    setDepth: () => visual,
    setDisplaySize: () => visual,
    setOrigin: () => visual,
    setPosition: () => visual,
    setScale: () => visual,
    setTint: () => visual,
  }
  return visual
}

function createSceneDouble() {
  let nextVisualId = 0
  const images: VisualDouble[] = []
  const labels: VisualDouble[] = []
  const graphics = {
    clear: vi.fn(),
    destroy: vi.fn(),
    fillCircle: vi.fn(),
    fillRect: vi.fn(),
    fillRoundedRect: vi.fn(),
    fillStyle: vi.fn(),
    lineBetween: vi.fn(),
    lineStyle: vi.fn(),
    setDepth: vi.fn(),
  }
  const scene = {
    add: {
      graphics: () => graphics,
      image: () => {
        const visual = createVisual(nextVisualId++)
        images.push(visual)
        return visual
      },
      text: () => {
        const visual = createVisual(nextVisualId++)
        labels.push(visual)
        return visual
      },
    },
    anims: {
      create: vi.fn(),
      exists: () => false,
      generateFrameNumbers: vi.fn(),
    },
    cameras: {
      main: { flash: vi.fn(), shake: vi.fn() },
    },
    textures: {
      exists: (key: string) => key === 'ws-train',
    },
  }
  return {
    images,
    labels,
    scene: scene as unknown as Phaser.Scene,
  }
}

function obstacle(
  id: string,
  kind: RunnerObstacle['kind'],
  lane: RunnerObstacle['lane'],
): RunnerObstacle {
  return {
    id,
    kind,
    lane,
    distanceM: 30,
    resolved: false,
    ...(kind === 'train' ? { ticker: 'TEST' } : {}),
  }
}

describe('RunnerRenderer entity reconciliation', () => {
  it('destroys visuals pruned by runtime while preserving live IDs and clears restart', () => {
    const { images, labels, scene } = createSceneDouble()
    const renderer = new RunnerRenderer(scene)
    const state = createRunnerState({ seed: 'renderer-prune', reducedMotion: true })
    state.entities = [
      obstacle('live-train', 'train', 0),
      obstacle('pruned-sign', 'overhead', 1),
    ]

    renderer.render(state)

    expect(images).toHaveLength(1)
    expect(labels).toHaveLength(2)
    const trainImage = images[0]
    const trainLabel = labels[0]
    const signLabel = labels[1]
    if (trainImage === undefined || trainLabel === undefined || signLabel === undefined) {
      throw new Error('Expected train and sign renderer doubles')
    }

    state.entities = [obstacle('live-train', 'train', 0)]
    renderer.render(state)

    expect(signLabel.destroy).toHaveBeenCalledTimes(1)
    expect(trainImage.destroy).not.toHaveBeenCalled()
    expect(trainLabel.destroy).not.toHaveBeenCalled()

    state.entities = []
    state.distanceM = 0
    renderer.render(state)

    expect(trainImage.destroy).toHaveBeenCalledTimes(1)
    expect(trainLabel.destroy).toHaveBeenCalledTimes(1)
  })

  it('reconciles entities pruned by the seeded runtime and its restart reset', () => {
    const { images, labels, scene } = createSceneDouble()
    const renderer = new RunnerRenderer(scene)
    const runtime = createRunnerRuntime('e2e-6', 200)
    const state = createRunnerState({ seed: 'e2e-6', reducedMotion: true })
    stepRunnerRuntime(runtime, state, [], 0)
    renderer.render(state)

    expect(images).toHaveLength(1)
    expect(labels).toHaveLength(2)
    const initialVisuals = [...images, ...labels]

    stepRunnerRuntime(runtime, state, [], 11_000)
    expect(state.entities.some(({ id }) => id.includes('obstacle-1'))).toBe(false)
    renderer.render(state)

    for (const visual of initialVisuals) {
      expect(visual.destroy).toHaveBeenCalledTimes(1)
    }
    expect(labels.some(({ destroy }) => destroy.mock.calls.length === 0)).toBe(true)

    stepRunnerRuntime(runtime, state, ['RESTART'], 0)
    expect(state.entities).toEqual([])
    renderer.render(state)

    for (const visual of [...images, ...labels]) {
      expect(visual.destroy).toHaveBeenCalledTimes(1)
    }
  })
})
