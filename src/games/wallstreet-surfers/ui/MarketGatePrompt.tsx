import { Button } from '../../../shared/ui'
import { SafeImage } from '../../../shared/assets/SafeImage'
import { runnerTextureAsset } from '../assets/runnerAssets'
import type { MarketDirection } from '../content/marketGates'
import type { RunnerState } from '../engine/types'

export interface MarketGatePromptProps {
  readonly state: RunnerState
  readonly onAnswer: (answer: MarketDirection) => void
}

export function MarketGatePrompt({ state, onAnswer }: MarketGatePromptProps) {
  const longArrow = runnerTextureAsset('ws-long-arrow')
  const shortArrow = runnerTextureAsset('ws-short-arrow')
  const active = state.currentGate
  if (active !== null) {
    return (
      <section
        className="runner-gate"
        role="region"
        aria-live="assertive"
        aria-atomic="true"
        aria-labelledby="runner-gate-title"
      >
        <p className="eyebrow">Market gate · {active.gate.ticker}</p>
        <h2 id="runner-gate-title">Make the call</h2>
        <p>{active.gate.setup}</p>
        <div role="group" aria-label="Market direction">
          <Button onClick={() => onAnswer('long')}>
            <span className="runner-gate__answer">
              <SafeImage
                src={longArrow.url}
                alt=""
                fallbackLabel="Up"
                className="runner-gate__arrow"
              />
              <span>LONG · Up / Jump</span>
            </span>
          </Button>
          <Button variant="secondary" onClick={() => onAnswer('short')}>
            <span className="runner-gate__answer">
              <SafeImage
                src={shortArrow.url}
                alt=""
                fallbackLabel="Down"
                className="runner-gate__arrow"
              />
              <span>SHORT · Down / Roll</span>
            </span>
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
