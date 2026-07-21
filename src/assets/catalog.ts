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
  url: string,
  kind: AssetRecord['kind'],
  alt: string,
): AssetRecord {
  return Object.freeze({
    id,
    url,
    kind,
    alt,
  })
}

export const ASSET_CATALOG: Readonly<Record<AssetId, AssetRecord>> = Object.freeze({
  'fs-draft-room': makeAsset(
    'fs-draft-room',
    fanStocksDraftRoomUrl,
    'image',
    'After-hours fantasy stock draft room',
  ),
  'fm-boardroom': makeAsset(
    'fm-boardroom',
    founderBoardroomUrl,
    'image',
    'Founder boardroom split between legacy risk and a strategic future',
  ),
  'ws-runner-street': makeAsset(
    'ws-runner-street',
    runnerStreetUrl,
    'image',
    'Three-lane financial district running course',
  ),
  'ws-runner-avatar': makeAsset(
    'ws-runner-avatar',
    runnerAvatarUrl,
    'image',
    'Market courier ready to run',
  ),
  'ws-train': makeAsset(
    'ws-train',
    runnerTrainUrl,
    'image',
    'Market ticker train obstacle',
  ),
  'ws-barrier': makeAsset(
    'ws-barrier',
    runnerBarrierUrl,
    'image',
    'Striped financial district barrier',
  ),
  'ws-long-arrow': makeAsset(
    'ws-long-arrow',
    runnerLongArrowUrl,
    'image',
    'Upward market direction arrow',
  ),
  'ws-short-arrow': makeAsset(
    'ws-short-arrow',
    runnerShortArrowUrl,
    'image',
    'Downward market direction arrow',
  ),
  'ws-coin': makeAsset(
    'ws-coin',
    runnerCoinUrl,
    'image',
    'Embossed market coin',
  ),
  'ws-run-loop': makeAsset(
    'ws-run-loop',
    runnerLoopUrl,
    'spritesheet',
    'Animated market courier run cycle',
  ),
  'ui-confirm': makeAsset(
    'ui-confirm',
    uiConfirmUrl,
    'audio',
    'Tactile confirmation sound',
  ),
  'market-success': makeAsset(
    'market-success',
    marketSuccessUrl,
    'audio',
    'Positive market result sound',
  ),
  'market-failure': makeAsset(
    'market-failure',
    marketFailureUrl,
    'audio',
    'Negative market result sound',
  ),
  'coin-pickup': makeAsset(
    'coin-pickup',
    coinPickupUrl,
    'audio',
    'Market coin pickup sound',
  ),
  collision: makeAsset(
    'collision',
    collisionUrl,
    'audio',
    'Runner collision sound',
  ),
  'arcade-loop': makeAsset(
    'arcade-loop',
    arcadeLoopUrl,
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
import arcadeLoopUrl from './audio/shared/arcade-loop.ogg?url'
import marketFailureUrl from './audio/shared/market-failure.ogg?url'
import marketSuccessUrl from './audio/shared/market-success.ogg?url'
import uiConfirmUrl from './audio/shared/ui-confirm.ogg?url'
import coinPickupUrl from './audio/wallstreet-surfers/coin-pickup.ogg?url'
import collisionUrl from './audio/wallstreet-surfers/collision.ogg?url'
import fanStocksDraftRoomUrl from './generated/fanstocks/draft-room.webp?url'
import founderBoardroomUrl from './generated/founder-mode/boardroom.webp?url'
import runnerBarrierUrl from './generated/wallstreet-surfers/barrier.png?url'
import runnerCoinUrl from './generated/wallstreet-surfers/coin.png?url'
import runnerLongArrowUrl from './generated/wallstreet-surfers/long-arrow.png?url'
import runnerLoopUrl from './generated/wallstreet-surfers/runner_run_f15_256x256_g4x4_fps16_loop.png?url'
import runnerAvatarUrl from './generated/wallstreet-surfers/runner-avatar.png?url'
import runnerStreetUrl from './generated/wallstreet-surfers/runner-street.webp?url'
import runnerShortArrowUrl from './generated/wallstreet-surfers/short-arrow.png?url'
import runnerTrainUrl from './generated/wallstreet-surfers/train.png?url'
