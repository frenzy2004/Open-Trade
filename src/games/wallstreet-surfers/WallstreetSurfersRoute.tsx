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
import { createChallengeHash } from './challenge'
import type { MarketDirection } from './content/marketGates'
import type { RunnerCommand, RunnerState } from './engine/types'
import { RunnerInput } from './input/RunnerInput'
import {
  createRunnerGame,
  type CreateRunnerGameOptions,
  type RunnerDiagnostics,
  type RunnerGameHandle,
} from './phaser/createRunnerGame'
import {
  createRunnerSave,
  runnerStore,
  type RunnerSaveV1,
} from './persistence/runnerSave'
import {
  RunnerTutorial,
} from './ui/RunnerTutorial'
import { MarketGatePrompt } from './ui/MarketGatePrompt'
import { RunnerDebugOverlay } from './ui/RunnerDebugOverlay'
import { RunnerGameOver } from './ui/RunnerGameOver'
import { RunnerHud } from './ui/RunnerHud'
import { TouchControls } from './ui/TouchControls'
import {
  advanceTutorial,
  type TutorialAction,
  type TutorialStep,
} from './ui/tutorialState'

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
  const debugEnabled = useMemo(
    () => new URLSearchParams(search).get('debug') === '1',
    [search],
  )
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
  const initialTutorialComplete = initialLoad.status === 'ready'
    ? initialLoad.value.tutorialComplete
    : false
  const tutorialCompleteRef = useRef(initialTutorialComplete)
  const [startupOptions] = useState(() => ({
    reducedMotion: settings.reducedMotion,
    tutorialComplete: initialTutorialComplete,
  }))
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(
    initialTutorialComplete ? 'complete' : 'lane',
  )
  const [snapshot, setSnapshot] = useState<RunnerState | null>(null)
  const [diagnostics, setDiagnostics] = useState<RunnerDiagnostics | null>(null)
  const [showRecovery, setShowRecovery] = useState(
    initialLoad.status === 'recovery-required',
  )
  const [saveError, setSaveError] = useState(false)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const persistState = useCallback((state: RunnerState) => {
    const result = store.save(
      createRunnerSave(
        state.seed,
        Math.max(state.bestScore, state.score),
        tutorialCompleteRef.current,
      ),
      { seed: state.seed },
    )
    setSaveError(!result.ok)
  }, [store])
  const handleSnapshot = useCallback((state: RunnerState) => {
    setSnapshot(state)
    setDiagnostics(gameRef.current?.diagnostics?.() ?? null)
    if (state.phase === 'gameOver') persistState(state)
  }, [persistState])
  const handleRunnerCommand = useCallback((command: RunnerCommand) => {
    gameRef.current?.dispatch(command)
    setTutorialStep((current) => advanceTutorial(current, command))
  }, [])
  const handleTutorialAction = useCallback((action: TutorialAction) => {
    if (action === 'ANSWER_LONG' || action === 'ANSWER_SHORT') {
      setTutorialStep((current) => advanceTutorial(current, action))
      return
    }
    handleRunnerCommand(action)
  }, [handleRunnerCommand])
  const handleGateAnswer = useCallback((answer: MarketDirection) => {
    handleRunnerCommand(answer === 'long' ? 'JUMP' : 'ROLL')
  }, [handleRunnerCommand])
  const handleRunAgain = useCallback(() => {
    setShareStatus(null)
    handleRunnerCommand('RESTART')
  }, [handleRunnerCommand])
  const handleShare = useCallback(async () => {
    const hash = createChallengeHash(seed, 1)
    const url = `${window.location.origin}${window.location.pathname}${hash}`
    try {
      if (navigator.clipboard === undefined) {
        throw new Error('Clipboard unavailable')
      }
      await navigator.clipboard.writeText(url)
      setShareStatus('Challenge link copied.')
    } catch {
      setShareStatus('Could not copy the challenge link.')
    }
  }, [seed])

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

  useEffect(() => {
    if (tutorialStep !== 'complete' || tutorialCompleteRef.current) return
    tutorialCompleteRef.current = true
    const game = gameRef.current
    game?.completeTutorial?.()
    if (game !== null) persistState(game.snapshot())
  }, [persistState, tutorialStep])

  useEffect(() => {
    const input = new RunnerInput(handleRunnerCommand)
    input.attach(window)
    let animationFrame: number | null = null
    const poll = () => {
      input.pollGamepad()
      animationFrame = window.requestAnimationFrame(poll)
    }
    if (typeof window.requestAnimationFrame === 'function') {
      animationFrame = window.requestAnimationFrame(poll)
    }
    return () => {
      input.detach()
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
    }
  }, [handleRunnerCommand])

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
      {snapshot !== null ? (
        <>
          <RunnerHud
            state={snapshot}
            onPause={() => handleRunnerCommand('PAUSE')}
          />
          <MarketGatePrompt state={snapshot} onAnswer={handleGateAnswer} />
          <RunnerDebugOverlay
            state={snapshot}
            enabled={debugEnabled}
            diagnostics={diagnostics}
          />
          <RunnerGameOver
            state={snapshot}
            onRunAgain={handleRunAgain}
            onShare={() => { void handleShare() }}
          />
        </>
      ) : null}
      <RunnerTutorial step={tutorialStep} onAction={handleTutorialAction} />
      <TouchControls
        onCommand={handleRunnerCommand}
        disabled={snapshot?.phase === 'gameOver'}
      />
      {shareStatus !== null ? (
        <p className="runner-share-status" role="status" aria-live="polite">
          {shareStatus}
        </p>
      ) : null}
    </section>
  )
}
