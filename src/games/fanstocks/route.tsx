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
    clearStoredGame(SAVE_KEY)
    resetGameProgress('fanstocks')
  },
  getProgressBadge: () => readGameProgress('fanstocks'),
  parseChallenge,
}
