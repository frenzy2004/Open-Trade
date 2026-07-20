import {
  FANSTOCKS_METADATA,
  FOUNDER_MODE_METADATA,
  WALLSTREET_SURFERS_METADATA,
} from './metadata'
import type { GameId, GameRouteRegistration } from './types'

export const GAME_ROUTES: readonly GameRouteRegistration[] = [
  {
    metadata: FANSTOCKS_METADATA,
    load: () => import('../../games/fanstocks/route'),
  },
  {
    metadata: FOUNDER_MODE_METADATA,
    load: () => import('../../games/founder-mode/route'),
  },
  {
    metadata: WALLSTREET_SURFERS_METADATA,
    load: () => import('../../games/wallstreet-surfers/route'),
  },
]

export function getGameRoute(id: GameId): GameRouteRegistration {
  const registration = GAME_ROUTES.find(
    (candidate) => candidate.metadata.id === id,
  )
  if (registration === undefined) {
    throw new RangeError('Unknown game route: ' + id)
  }
  return registration
}
