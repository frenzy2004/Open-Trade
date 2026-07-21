import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import type { AiId } from './content/types'
import type { FanStocksPhase, FanStocksState } from './engine/fanStocksReducer'
import { useFanStocksController } from './useFanStocksController'
import { DraftScreen } from './ui/DraftScreen'
import { FanStocksIntro } from './ui/FanStocksIntro'
import { IncomingTradeCard } from './ui/IncomingTradeCard'
import { incomingTradeForDisplay } from './ui/incomingTradePresentation'
import { LeagueScreen } from './ui/LeagueScreen'
import { OutgoingTradeDialog } from './ui/OutgoingTradeDialog'
import { ResultsScreen } from './ui/ResultsScreen'
import { TradeTransferAnimation } from './ui/TradeTransferAnimation'
import { TutorialDialog } from './ui/TutorialDialog'
import './fanstocks.css'

const PHASES: readonly FanStocksPhase[] = Object.freeze([
  'intro',
  'tutorial',
  'draft',
  'ai-drafting',
  'market',
  'results',
])

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stateForDisplay(value: unknown): FanStocksState | null {
  if (
    !isRecord(value)
    || !Object.hasOwn(value, 'phase')
    || !PHASES.some((phase) => phase === value.phase)
  ) return null

  if (
    value.phase === 'draft'
    && !Object.hasOwn(value, 'draft')
  ) return null
  if (
    value.phase === 'market'
    && (
      !Object.hasOwn(value, 'portfolios')
      || value.portfolios === null
      || !Object.hasOwn(value, 'priceHistory')
      || !Array.isArray(value.priceHistory)
      || !Object.hasOwn(value, 'paused')
      || typeof value.paused !== 'boolean'
      || !Object.hasOwn(value, 'speed')
      || (value.speed !== 1 && value.speed !== 2 && value.speed !== 4)
      || !Object.hasOwn(value, 'pendingTrade')
    )
  ) return null
  if (
    value.phase === 'results'
    && (!Object.hasOwn(value, 'result') || value.result === null)
  ) return null
  return value as unknown as FanStocksState
}

export default function FanStocksRoute() {
  const game = useFanStocksController()
  const navigate = useNavigate()
  const state = stateForDisplay(game.state)
  const phase = state?.phase ?? null
  const [outgoingOpponent, setOutgoingOpponent] = useState<AiId | null>(null)
  const [shareStatus, setShareStatus] = useState('')
  const [resetConfirmation, setResetConfirmation] = useState(false)
  const pendingTrade = state !== null && phase === 'market'
    ? incomingTradeForDisplay(state.pendingTrade)
    : null
  const invalidPendingTrade = state !== null
    && phase === 'market'
    && state.pendingTrade !== null
    && pendingTrade === null
  const blockingProblem = game.saveProblem?.source === 'challenge'
    || game.saveProblem?.source === 'load'
    ? game.saveProblem
    : null
  const persistenceProblem = game.saveProblem?.source === 'save'
    || game.saveProblem?.source === 'reset'
    ? game.saveProblem
    : null

  useEffect(() => {
    // Phase and seed changes each begin a distinct route transaction.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOutgoingOpponent(null)
    setShareStatus('')
  }, [phase, state?.seed])

  useEffect(() => {
    // Recovery source changes begin a distinct consent transaction.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResetConfirmation(false)
  }, [game.saveProblem?.source])

  const share = async () => {
    try {
      if (navigator.clipboard?.writeText === undefined) {
        throw new Error('Clipboard unavailable')
      }
      await navigator.clipboard.writeText(window.location.href)
      setShareStatus('Challenge link copied.')
    } catch {
      setShareStatus('Challenge link could not be copied.')
    }
  }

  return (
    <div className="fanstocks-app">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {shareStatus}
      </p>

      {state === null ? (
        <section className="fanstocks-unavailable" aria-label="FanStocks unavailable">
          <h1>Fantasy Stock Leagues</h1>
          <p role="status">FanStocks is unavailable.</p>
          <Link to="/">Return to games</Link>
        </section>
      ) : null}

      {state !== null && (phase === 'intro' || phase === 'tutorial') ? (
        <FanStocksIntro onStart={game.startLeague} />
      ) : null}
      <TutorialDialog
        open={phase === 'tutorial'}
        onDismiss={game.dismissTutorial}
      />

      {state !== null && phase === 'draft' ? (
        <DraftScreen
          draft={state.draft}
          onOpenDetail={game.openDetail}
          onMoveDetail={game.moveDetail}
          onCloseDetail={game.closeDetail}
          onDraft={game.draft}
        />
      ) : null}

      {phase === 'ai-drafting' ? (
        <section className="ai-drafting" aria-label="Draft complete">
          <h1>Draft complete</h1>
          <p role="status" aria-live="polite">
            AI opponents are building their portfolios.
          </p>
        </section>
      ) : null}

      {state !== null && phase === 'market' && state.portfolios !== null ? (
        <>
          <LeagueScreen
            portfolios={state.portfolios}
            frames={state.priceHistory}
            paused={state.paused}
            speed={state.speed}
            pendingTrade={pendingTrade}
            onSetPaused={game.setPaused}
            onSetSpeed={game.setSpeed}
            onSelectOpponent={setOutgoingOpponent}
            onShare={() => { void share() }}
          />
          {pendingTrade === null ? null : (
            <IncomingTradeCard
              offer={pendingTrade}
              onAccept={() => game.decideIncoming('accepted')}
              onPass={() => game.decideIncoming('passed')}
            />
          )}
          {invalidPendingTrade ? (
            <section
              className="fanstocks-invalid-trade"
              role="status"
              aria-label="Invalid trade offer"
            >
              <p>Trade offer unavailable.</p>
              <Button variant="secondary" onClick={() => game.decideIncoming('passed')}>
                Pass invalid trade offer
              </Button>
            </section>
          ) : null}
          <OutgoingTradeDialog
            open={pendingTrade === null && !invalidPendingTrade && outgoingOpponent !== null}
            opponentId={outgoingOpponent}
            portfolios={state.portfolios}
            onClose={() => setOutgoingOpponent(null)}
            onSubmit={(opponentId, gives, receives) => {
              game.submitOutgoing(opponentId, gives, receives)
              setOutgoingOpponent(null)
            }}
          />
          <TradeTransferAnimation
            key={game.lastAcceptedTrade?.id ?? 'none'}
            event={game.lastAcceptedTrade}
            reducedMotion={game.reducedMotion}
          />
        </>
      ) : null}

      {state !== null && phase === 'results' && state.result !== null ? (
        <ResultsScreen
          result={state.result}
          onRematch={game.rematch}
          onNewLeague={game.newLeague}
          onShare={() => { void share() }}
        />
      ) : null}

      <Dialog
        open={blockingProblem !== null}
        onClose={() => navigate('/')}
        title={blockingProblem?.source === 'challenge'
          ? 'FanStocks challenge could not be opened'
          : 'FanStocks progress could not be loaded'}
        description={blockingProblem?.source === 'challenge'
          ? 'The challenge link is malformed or uses an incompatible ruleset.'
          : 'The saved league is corrupt, inaccessible, or belongs to an incompatible ruleset.'}
      >
        {blockingProblem === null ? null : (
          <>
            <p>{blockingProblem.detail}</p>
            {resetConfirmation ? (
              <div className="fanstocks-recovery__confirmation">
                <p>This permanently removes the saved FanStocks league.</p>
                <Button
                  variant="danger"
                  onClick={() => {
                    setResetConfirmation(false)
                    game.resetBrokenSave()
                  }}
                >
                  Confirm reset
                </Button>
                <Button variant="secondary" onClick={() => setResetConfirmation(false)}>
                  Keep saved progress
                </Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setResetConfirmation(true)}>
                Reset FanStocks progress
              </Button>
            )}
            <Link to="/">Return to games</Link>
          </>
        )}
      </Dialog>

      {persistenceProblem === null ? null : (
        <section className="fanstocks-persistence-alert" role="alert">
          <h2>
            {persistenceProblem.source === 'save'
              ? 'FanStocks progress could not be saved'
              : 'FanStocks progress could not be reset'}
          </h2>
          <p>{persistenceProblem.detail}</p>
          {persistenceProblem.source === 'save' ? (
            <>
              <p>Your current league remains open, but changes may not persist.</p>
              {resetConfirmation ? (
                <div className="fanstocks-recovery__confirmation">
                  <p>Starting over permanently removes the saved FanStocks league.</p>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setResetConfirmation(false)
                      game.resetBrokenSave()
                    }}
                  >
                    Confirm new league
                  </Button>
                  <Button variant="secondary" onClick={() => setResetConfirmation(false)}>
                    Keep current league
                  </Button>
                </div>
              ) : (
                <Button variant="danger" onClick={() => setResetConfirmation(true)}>
                  Reset and start a new league
                </Button>
              )}
            </>
          ) : (
            <Button variant="secondary" onClick={game.resetBrokenSave}>
              Try reset again
            </Button>
          )}
          <Link to="/">Return to games</Link>
        </section>
      )}
    </div>
  )
}
