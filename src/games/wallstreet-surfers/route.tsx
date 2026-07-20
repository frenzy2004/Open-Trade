/* eslint-disable react-refresh/only-export-components */

import { WALLSTREET_SURFERS_METADATA } from '../../app/routes/metadata'
import {
  readGameProgress,
  resetGameProgress,
} from '../../app/routes/progressStore'
import type { GameRouteModule } from '../../app/routes/types'
import { clearStoredGame } from '../../shared/persistence/gameStore'
import { parseChallenge } from '../../shared/routing/challenge'
import { GameFoundationPage } from '../GameFoundationPage'

const SAVE_KEY = 'open-trade:game:wallstreet-surfers'

function WallstreetSurfersEntry() {
  return <GameFoundationPage metadata={WALLSTREET_SURFERS_METADATA} />
}

export const gameRoute: GameRouteModule = {
  metadata: WALLSTREET_SURFERS_METADATA,
  Entry: WallstreetSurfersEntry,
  saveKey: SAVE_KEY,
  reset: () => {
    const cleared = clearStoredGame(SAVE_KEY)
    if (!cleared.ok) {
      throw new Error(
        'Wallstreet Surfers game save reset failed: ' + cleared.reason,
      )
    }
    const progress = resetGameProgress('wallstreet-surfers')
    if (!progress.ok) {
      throw new Error(
        'Wallstreet Surfers progress reset failed: ' + progress.reason,
      )
    }
  },
  getProgressBadge: () => readGameProgress('wallstreet-surfers'),
  parseChallenge,
}
