import {
  asset,
  type AssetId,
  type AssetRecord,
} from '../../../assets/catalog'

export const RUNNER_TEXTURE_IDS = [
  'ws-runner-avatar',
  'ws-run-loop',
  'ws-train',
  'ws-barrier',
  'ws-long-arrow',
  'ws-short-arrow',
  'ws-coin',
] as const satisfies readonly AssetId[]

export type RunnerTextureId = (typeof RUNNER_TEXTURE_IDS)[number]

export interface RunnerBackgroundAsset extends AssetRecord {
  readonly id: 'ws-runner-street'
  readonly target: 'css-background'
  readonly fallback: 'gradient'
}

export interface RunnerTextureAsset extends AssetRecord {
  readonly id: RunnerTextureId
  readonly target: 'phaser-texture'
  readonly fallback: 'procedural'
  readonly frame?: Readonly<{
    width: number
    height: number
    count: number
    fps: number
  }>
}

const street = asset('ws-runner-street')

export const RUNNER_BACKGROUND_ASSET: RunnerBackgroundAsset = Object.freeze({
  ...street,
  id: 'ws-runner-street',
  target: 'css-background',
  fallback: 'gradient',
})

export const RUNNER_TEXTURE_ASSETS: readonly RunnerTextureAsset[] = Object.freeze(
  RUNNER_TEXTURE_IDS.map((id): RunnerTextureAsset => {
    const media = asset(id)
    const frame = id === 'ws-run-loop'
      ? Object.freeze({ width: 256, height: 256, count: 15, fps: 16 })
      : undefined
    return Object.freeze({
      ...media,
      id,
      target: 'phaser-texture' as const,
      fallback: 'procedural' as const,
      ...(frame === undefined ? {} : { frame }),
    })
  }),
)

const RUNNER_TEXTURE_BY_ID = Object.freeze(
  Object.fromEntries(
    RUNNER_TEXTURE_ASSETS.map((media) => [media.id, media]),
  ) as Record<RunnerTextureId, RunnerTextureAsset>,
)

export function runnerTextureAsset(id: RunnerTextureId): RunnerTextureAsset {
  return RUNNER_TEXTURE_BY_ID[id]
}

export interface RunnerTextureStore {
  exists(key: string): boolean
}

export type ResolvedRunnerTexture =
  | Readonly<{ mode: 'texture'; key: RunnerTextureId }>
  | Readonly<{ mode: 'procedural' }>

const PROCEDURAL_TEXTURE = Object.freeze({ mode: 'procedural' as const })

export function resolveRunnerTexture(
  textures: RunnerTextureStore,
  key: RunnerTextureId,
): ResolvedRunnerTexture {
  return textures.exists(key)
    ? Object.freeze({ mode: 'texture' as const, key })
    : PROCEDURAL_TEXTURE
}
