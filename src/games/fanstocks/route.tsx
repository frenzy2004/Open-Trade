/* eslint-disable react-refresh/only-export-components */

import { FANSTOCKS_METADATA } from '../../app/routes/metadata'
import {
  readGameProgress,
  resetGameProgress,
} from '../../app/routes/progressStore'
import type { GameRouteModule } from '../../app/routes/types'
import { clearStoredGame } from '../../shared/persistence/gameStore'
import { parseChallenge } from '../../shared/routing/challenge'
import { GameFoundationPage } from '../GameFoundationPage'

const SAVE_KEY = 'open-trade:game:fanstocks'

function FanStocksEntry() {
  return <GameFoundationPage metadata={FANSTOCKS_METADATA} />
}

export const gameRoute: GameRouteModule = {
  metadata: FANSTOCKS_METADATA,
  Entry: FanStocksEntry,
  saveKey: SAVE_KEY,
  reset: () => {
    const cleared = clearStoredGame(SAVE_KEY)
    if (!cleared.ok) {
      throw new Error('FanStocks game save reset failed: ' + cleared.reason)
    }
    const progress = resetGameProgress('fanstocks')
    if (!progress.ok) {
      throw new Error('FanStocks progress reset failed: ' + progress.reason)
    }
  },
  getProgressBadge: () => readGameProgress('fanstocks'),
  parseChallenge,
}
