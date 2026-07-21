export type AssetId =
  | 'fs-draft-room'
  | 'fm-boardroom'
  | 'ws-runner-street'
  | 'ws-runner-avatar'
  | 'ws-train'
  | 'ws-barrier'
  | 'ws-long-arrow'
  | 'ws-short-arrow'
  | 'ws-coin'
  | 'ws-run-loop'
  | 'ui-confirm'
  | 'market-success'
  | 'market-failure'
  | 'coin-pickup'
  | 'collision'
  | 'arcade-loop'

export interface AssetRecord {
  readonly id: AssetId
  readonly url: string
  readonly kind: 'image' | 'spritesheet' | 'audio'
  readonly alt: string
}

export const ASSET_CATALOG_IDS = [
  'fs-draft-room',
  'fm-boardroom',
  'ws-runner-street',
  'ws-runner-avatar',
  'ws-train',
  'ws-barrier',
  'ws-long-arrow',
  'ws-short-arrow',
  'ws-coin',
  'ws-run-loop',
  'ui-confirm',
  'market-success',
  'market-failure',
  'coin-pickup',
  'collision',
  'arcade-loop',
] as const;
Object.freeze(ASSET_CATALOG_IDS)

function makeAsset(
  id: AssetId,
  relativeUrl: string,
  kind: AssetRecord['kind'],
  alt: string,
): AssetRecord {
  return Object.freeze({
    id,
    url: new URL(relativeUrl, import.meta.url).href,
    kind,
    alt,
  })
}

export const ASSET_CATALOG: Readonly<Record<AssetId, AssetRecord>> = Object.freeze({
  'fs-draft-room': makeAsset(
    'fs-draft-room',
    './generated/fanstocks/draft-room.webp',
    'image',
    'After-hours fantasy stock draft room',
  ),
  'fm-boardroom': makeAsset(
    'fm-boardroom',
    './generated/founder-mode/boardroom.webp',
    'image',
    'Founder boardroom split between legacy risk and a strategic future',
  ),
  'ws-runner-street': makeAsset(
    'ws-runner-street',
    './generated/wallstreet-surfers/runner-street.webp',
    'image',
    'Three-lane financial district running course',
  ),
  'ws-runner-avatar': makeAsset(
    'ws-runner-avatar',
    './generated/wallstreet-surfers/runner-avatar.png',
    'image',
    'Market courier ready to run',
  ),
  'ws-train': makeAsset(
    'ws-train',
    './generated/wallstreet-surfers/train.png',
    'image',
    'Market ticker train obstacle',
  ),
  'ws-barrier': makeAsset(
    'ws-barrier',
    './generated/wallstreet-surfers/barrier.png',
    'image',
    'Striped financial district barrier',
  ),
  'ws-long-arrow': makeAsset(
    'ws-long-arrow',
    './generated/wallstreet-surfers/long-arrow.png',
    'image',
    'Upward market direction arrow',
  ),
  'ws-short-arrow': makeAsset(
    'ws-short-arrow',
    './generated/wallstreet-surfers/short-arrow.png',
    'image',
    'Downward market direction arrow',
  ),
  'ws-coin': makeAsset(
    'ws-coin',
    './generated/wallstreet-surfers/coin.png',
    'image',
    'Embossed market coin',
  ),
  'ws-run-loop': makeAsset(
    'ws-run-loop',
    './generated/wallstreet-surfers/runner_run_f15_256x256_g4x4_fps16_loop.png',
    'spritesheet',
    'Animated market courier run cycle',
  ),
  'ui-confirm': makeAsset(
    'ui-confirm',
    './audio/shared/ui-confirm.ogg',
    'audio',
    'Tactile confirmation sound',
  ),
  'market-success': makeAsset(
    'market-success',
    './audio/shared/market-success.ogg',
    'audio',
    'Positive market result sound',
  ),
  'market-failure': makeAsset(
    'market-failure',
    './audio/shared/market-failure.ogg',
    'audio',
    'Negative market result sound',
  ),
  'coin-pickup': makeAsset(
    'coin-pickup',
    './audio/wallstreet-surfers/coin-pickup.ogg',
    'audio',
    'Market coin pickup sound',
  ),
  collision: makeAsset(
    'collision',
    './audio/wallstreet-surfers/collision.ogg',
    'audio',
    'Runner collision sound',
  ),
  'arcade-loop': makeAsset(
    'arcade-loop',
    './audio/shared/arcade-loop.ogg',
    'audio',
    'Instrumental finance arcade loop',
  ),
})

export function asset(id: AssetId): AssetRecord {
  if (!Object.hasOwn(ASSET_CATALOG, id)) {
    throw new RangeError(`Unknown asset id: ${String(id)}`)
  }
  return ASSET_CATALOG[id]
}
