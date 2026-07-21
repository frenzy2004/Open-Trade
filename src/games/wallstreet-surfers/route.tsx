/* eslint-disable react-refresh/only-export-components */

import { lazy, Suspense } from 'react'
import { WALLSTREET_SURFERS_METADATA } from '../../app/routes/metadata'
import {
  resetGameProgress,
} from '../../app/routes/progressStore'
import type { GameRouteModule } from '../../app/routes/types'
import { parseChallenge } from '../../shared/routing/challenge'
import {
  getRunnerProgressBadge,
  RUNNER_SAVE_KEY,
  runnerStore,
} from './persistence/runnerSave'

const LazyWallstreetSurfersRoute = lazy(async () => {
  const module = await import('./WallstreetSurfersRoute')
  return { default: module.WallstreetSurfersRoute }
})

function WallstreetSurfersEntry() {
  return (
    <Suspense fallback={<p role="status">Loading Wallstreet Surfers…</p>}>
      <LazyWallstreetSurfersRoute />
    </Suspense>
  )
}

export const gameRoute: GameRouteModule = {
  metadata: WALLSTREET_SURFERS_METADATA,
  Entry: WallstreetSurfersEntry,
  saveKey: RUNNER_SAVE_KEY,
  reset: () => {
    const cleared = runnerStore.clear()
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
  getProgressBadge: getRunnerProgressBadge,
  parseChallenge,
}
