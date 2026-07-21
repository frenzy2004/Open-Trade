import { FANSTOCKS_METADATA } from '../../app/routes/metadata'
import type { GameRouteModule } from '../../app/routes/types'
import { parseChallenge } from '../../shared/routing/challenge'
import FanStocksRoute from './FanStocksRoute'
import {
  fanStocksSaveCodec,
  getFanStocksProgressBadge,
  resetFanStocksProgress,
} from './persistence/fanStocksSave'

export const gameRoute: GameRouteModule = Object.freeze({
  metadata: FANSTOCKS_METADATA,
  Entry: FanStocksRoute,
  saveKey: fanStocksSaveCodec.key,
  reset: resetFanStocksProgress,
  getProgressBadge: () => getFanStocksProgressBadge() ?? {
    label: 'FanStocks',
    value: 'No active league',
    tone: 'neutral',
  },
  parseChallenge,
})
