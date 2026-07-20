/* eslint-disable react-refresh/only-export-components */

import { FOUNDER_MODE_METADATA } from '../../app/routes/metadata'
import {
  readGameProgress,
  resetGameProgress,
} from '../../app/routes/progressStore'
import type { GameRouteModule } from '../../app/routes/types'
import { clearStoredGame } from '../../shared/persistence/gameStore'
import { parseChallenge } from '../../shared/routing/challenge'
import { GameFoundationPage } from '../GameFoundationPage'

const SAVE_KEY = 'open-trade:game:founder-mode'

function FounderModeEntry() {
  return <GameFoundationPage metadata={FOUNDER_MODE_METADATA} />
}

export const gameRoute: GameRouteModule = {
  metadata: FOUNDER_MODE_METADATA,
  Entry: FounderModeEntry,
  saveKey: SAVE_KEY,
  reset: () => {
    clearStoredGame(SAVE_KEY)
    resetGameProgress('founder-mode')
  },
  getProgressBadge: () => readGameProgress('founder-mode'),
  parseChallenge,
}
