import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'
import type { GameStore } from '../../shared/persistence/gameStore'
import { createGuestSeed, parseChallenge } from '../../shared/routing/challenge'
import { useSettings } from '../../shared/settings/SettingsContext'
import { Button } from '../../shared/ui'
import type { RunnerState } from './engine/types'
import {
  createRunnerGame,
  type CreateRunnerGameOptions,
  type RunnerGameHandle,
} from './phaser/createRunnerGame'
import {
  createRunnerSave,
  runnerStore,
  type RunnerSaveV1,
} from './persistence/runnerSave'

export interface WallstreetSurfersRouteProps {
  readonly createGame?: (
    parent: HTMLElement,
    options: CreateRunnerGameOptions,
  ) => RunnerGameHandle
  readonly store?: GameStore<RunnerSaveV1>
}

export function WallstreetSurfersRoute({
  createGame = createRunnerGame,
  store = runnerStore,
}: WallstreetSurfersRouteProps) {
  const { search } = useLocation()
  const { settings } = useSettings()
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<RunnerGameHandle | null>(null)
  const initialLoad = useMemo(() => store.load(), [store])
  const challenge = useMemo(() => parseChallenge(search), [search])
  const hasExplicitChallenge = useMemo(() => {
    const params = new URLSearchParams(search)
    return params.has('seed') || params.has('rules')
  }, [search])
  const invalidChallenge = hasExplicitChallenge
    && (challenge === null || challenge.rulesetVersion !== 1)
  const seed = useMemo(
    () => challenge?.rulesetVersion === 1
      ? challenge.seed
      : initialLoad.status === 'ready'
        ? initialLoad.value.seed
        : createGuestSeed(),
    [challenge, initialLoad],
  )
  const bestScore = initialLoad.status === 'ready'
    ? initialLoad.value.bestScore
    : 0
  const tutorialComplete = initialLoad.status === 'ready'
    ? initialLoad.value.tutorialComplete
    : false
  const [startupOptions] = useState(() => ({
    reducedMotion: settings.reducedMotion,
    tutorialComplete,
  }))
  const [snapshot, setSnapshot] = useState<RunnerState | null>(null)
  const [showRecovery, setShowRecovery] = useState(
    initialLoad.status === 'recovery-required',
  )
  const [saveError, setSaveError] = useState(false)
  const persistState = useCallback((state: RunnerState) => {
    const result = store.save(
      createRunnerSave(
        state.seed,
        Math.max(state.bestScore, state.score),
        tutorialComplete,
      ),
      { seed: state.seed },
    )
    setSaveError(!result.ok)
  }, [store, tutorialComplete])
  const handleSnapshot = useCallback((state: RunnerState) => {
    setSnapshot(state)
    if (state.phase === 'gameOver') persistState(state)
  }, [persistState])

  useEffect(() => {
    const parent = mountRef.current
    if (parent === null) return
    const game = createGame(parent, {
      seed,
      reducedMotion: startupOptions.reducedMotion,
      bestScore,
      tutorialComplete: startupOptions.tutorialComplete,
      onSnapshot: handleSnapshot,
    })
    gameRef.current = game
    return () => {
      try {
        persistState(game.snapshot())
      } finally {
        game.destroy()
        if (gameRef.current === game) gameRef.current = null
      }
    }
  }, [
    bestScore,
    createGame,
    handleSnapshot,
    seed,
    persistState,
    startupOptions,
  ])

  useEffect(() => {
    gameRef.current?.setReducedMotion?.(settings.reducedMotion)
  }, [settings.reducedMotion])

  return (
    <section className="runner-route" aria-labelledby="runner-title">
      <header>
        <p className="eyebrow">Three-lane market runner</p>
        <h1 id="runner-title">Wallstreet Surfers</h1>
        <p>Switch lanes, jump barriers, roll under signs, and call the market.</p>
      </header>
      {showRecovery ? (
        <div role="alert">
          <p>Saved run data could not be read. A safe new run is active.</p>
          <Button
            variant="secondary"
            onClick={() => {
              const result = store.clear()
              if (result.ok) setShowRecovery(false)
            }}
          >
            Clear damaged run
          </Button>
        </div>
      ) : null}
      {invalidChallenge ? (
        <div role="alert">
          This challenge link is invalid or uses unsupported rules. A normal local run is active.
        </div>
      ) : null}
      {saveError ? (
        <div role="alert">
          Your latest score could not save. Check browser storage before leaving.
        </div>
      ) : null}
      <div
        ref={mountRef}
        className="runner-canvas-mount"
        data-testid="runner-canvas-mount"
        role="img"
        aria-label="Wallstreet Surfers three-lane game world"
      />
      <p>
        Score {snapshot?.score ?? 0}. Best {snapshot?.bestScore ?? bestScore}.
      </p>
    </section>
  )
}
