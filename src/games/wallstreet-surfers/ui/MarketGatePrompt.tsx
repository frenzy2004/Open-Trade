import { Button } from '../../../shared/ui'
import type { MarketDirection } from '../content/marketGates'
import type { RunnerState } from '../engine/types'

export interface MarketGatePromptProps {
  readonly state: RunnerState
  readonly onAnswer: (answer: MarketDirection) => void
}

export function MarketGatePrompt({ state, onAnswer }: MarketGatePromptProps) {
  const active = state.currentGate
  if (active !== null) {
    return (
      <section className="runner-gate" aria-labelledby="runner-gate-title">
        <p className="eyebrow">Market gate · {active.gate.ticker}</p>
        <h2 id="runner-gate-title">Make the call</h2>
        <p>{active.gate.setup}</p>
        <div role="group" aria-label="Market direction">
          <Button onClick={() => onAnswer('long')}>LONG · Up / Jump</Button>
          <Button variant="secondary" onClick={() => onAnswer('short')}>
            SHORT · Down / Roll
          </Button>
        </div>
      </section>
    )
  }

  const feedback = state.lastGateFeedback
  if (feedback === null) return null
  const summary = feedback.timedOut
    ? `Time expired. ${feedback.expected.toUpperCase()} was the call.`
    : feedback.correct
      ? `Correct. +${feedback.scoreDelta.toLocaleString('en-US')}.`
      : `Incorrect. ${feedback.expected.toUpperCase()} was the call.`
  return (
    <section className="runner-gate runner-gate--feedback" role="status">
      <strong>{summary}</strong>
      <p>{feedback.explanation}</p>
    </section>
  )
}
