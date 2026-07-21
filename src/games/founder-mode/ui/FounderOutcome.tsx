import { Button } from '../../../shared/ui/Button'
import type { FounderEpisode } from '../content/types'
import type { FounderRunState } from '../engine/founderState'
import { ValuationChart } from './ValuationChart'

interface FounderOutcomeProps {
  readonly episode: FounderEpisode
  readonly run: FounderRunState
  readonly onContinue: () => void
}

export function FounderOutcome({
  episode,
  run,
  onContinue,
}: FounderOutcomeProps) {
  const decision = episode.decisions[run.decisionIndex]
  const historyItem = run.history.at(-1)
  const choice = decision?.choices.find(({ id }) => id === historyItem?.choiceId)
  if (!decision || !historyItem || !choice) {
    return (
      <section className="founder-screen" role="alert">
        <h1>Outcome unavailable</h1>
        <p>This decision result could not be reconstructed.</p>
      </section>
    )
  }

  const isLast = run.decisionIndex === episode.decisions.length - 1
  const delta =
    Math.round((historyItem.valueAfterBn - historyItem.valueBeforeBn) * 10) /
    10
  const signedDelta =
    delta > 0
      ? `+$${delta.toFixed(1)}B`
      : delta < 0
        ? `−$${Math.abs(delta).toFixed(1)}B`
        : '±$0.0B'
  return (
    <section className="founder-screen founder-outcome" aria-labelledby="outcome-title">
      <div className="founder-kicker">The market responds</div>
      <h1 id="outcome-title">Your call is in</h1>
      <div className="founder-outcome-grid">
        <div>
          <p className="founder-choice-summary">{choice.label}</p>
          <div className="founder-verdicts">
            <p>Matched history: {choice.matchedHistory ? 'yes' : 'no'}</p>
            <p>Outcome: {choice.worked ? 'worked' : 'did not work'}</p>
          </div>
          <p className="founder-deck">{choice.outcome[run.style]}</p>
          <p className="founder-value-change">
            <span>
              ${historyItem.valueBeforeBn.toFixed(1)}B → $
              {historyItem.valueAfterBn.toFixed(1)}B
            </span>
            <strong data-tone={delta >= 0 ? 'gain' : 'loss'}>
              {signedDelta}
            </strong>
          </p>
          <p className="founder-value-result" aria-label={`Company value $${run.currentValueBn.toFixed(1)} billion`}>
            ${run.currentValueBn.toFixed(1)}B
          </p>
        </div>
        <ValuationChart
          realityBn={episode.historicalEndValueBn}
          playerBn={run.currentValueBn}
          history={run.history}
        />
      </div>
      <Button onClick={onContinue}>
        {isLast
          ? 'See your result'
          : `Continue to decision ${run.decisionIndex + 2}`}
      </Button>
    </section>
  )
}
