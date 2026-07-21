/* eslint-disable react-refresh/only-export-components */

import { FOUNDER_MODE_METADATA } from '../../app/routes/metadata'
import { resetGameProgress } from '../../app/routes/progressStore'
import type { GameProgressBadge } from '../../app/routes/types'
import type { GameRouteModule } from '../../app/routes/types'
import { parseChallenge } from '../../shared/routing/challenge'
import { FounderModeRoute } from './FounderModeRoute'
import {
  createDefaultFounderSave,
  FOUNDER_SAVE_KEY,
  founderStore,
  progressBadgeForFounderSave,
} from './persistence/founderSave'

export function founderProgressBadge(): GameProgressBadge {
  const loaded = founderStore.load()
  if (loaded.status === 'ready') {
    return progressBadgeForFounderSave(loaded.value)
  }
  if (loaded.status === 'empty') {
    return progressBadgeForFounderSave(createDefaultFounderSave())
  }
  return Object.freeze({
    label: 'Founder streak',
    value: 'Recovery required',
    tone: 'warning',
  })
}

function FounderModeEntry() {
  return <FounderModeRoute />
}

export const gameRoute: GameRouteModule = {
  metadata: FOUNDER_MODE_METADATA,
  Entry: FounderModeEntry,
  saveKey: FOUNDER_SAVE_KEY,
  reset: () => {
    const cleared = founderStore.clear()
    if (!cleared.ok) {
      throw new Error('Founder Mode game save reset failed: ' + cleared.reason)
    }
    const progress = resetGameProgress('founder-mode')
    if (!progress.ok) {
      throw new Error('Founder Mode progress reset failed: ' + progress.reason)
    }
  },
  getProgressBadge: founderProgressBadge,
  parseChallenge,
}
