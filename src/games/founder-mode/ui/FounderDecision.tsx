import { Button } from '../../../shared/ui/Button'
import { ProgressBar } from '../../../shared/ui/ProgressBar'
import type { FounderEpisode } from '../content/types'
import type { FounderRunState } from '../engine/founderState'

interface FounderDecisionProps {
  readonly episode: FounderEpisode
  readonly run: FounderRunState
  readonly onChoose: (choiceId: string) => void
}

export function FounderDecision({
  episode,
  run,
  onChoose,
}: FounderDecisionProps) {
  const decision = episode.decisions[run.decisionIndex]
  if (!decision) {
    return (
      <section className="founder-screen" role="alert">
        <h1>Decision unavailable</h1>
        <p>This episode could not find the requested board decision.</p>
      </section>
    )
  }

  const decisionNumber = run.decisionIndex + 1
  return (
    <section className="founder-screen founder-decision" aria-labelledby="decision-title">
      <div className="founder-run-header">
        <div>
          <div className="founder-kicker">{decision.year} board meeting</div>
          <p className="founder-decision-count">
            Decision {decisionNumber} of {episode.decisions.length}
          </p>
        </div>
        <p className="founder-current-value">
          Company value <strong>${run.currentValueBn.toFixed(1)}B</strong>
        </p>
      </div>
      <ProgressBar
        label="Episode progress"
        value={run.decisionIndex}
        max={episode.decisions.length}
      />
      <h1 id="decision-title">Make the call</h1>
      <p className="founder-dilemma">{decision.prompt[run.style]}</p>
      <fieldset className="founder-choice-fieldset">
        <legend>Choose one response</legend>
        <div className="founder-choice-list">
          {decision.choices.map((choice, index) => (
            <Button
              key={choice.id}
              className="founder-choice-card"
              variant="secondary"
              onClick={() => onChoose(choice.id)}
            >
              <span aria-hidden="true">{String.fromCharCode(65 + index)}</span>
              <strong>{choice.label}</strong>
            </Button>
          ))}
        </div>
      </fieldset>
    </section>
  )
}
