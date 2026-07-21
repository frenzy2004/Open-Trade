import { Button } from '../../../shared/ui'
import type { RunnerState } from '../engine/types'

export interface RunnerHudProps {
  readonly state: RunnerState
  readonly onPause: () => void
}

export function RunnerHud({ state, onPause }: RunnerHudProps) {
  const paused = state.phase === 'paused'
  return (
    <section className="runner-hud" aria-label="Run status">
      <dl className="runner-hud__stats">
        <div><dt>Score</dt><dd>{state.score.toLocaleString('en-US')}</dd></div>
        <div><dt>Distance</dt><dd>{Math.floor(state.distanceM).toLocaleString('en-US')} m</dd></div>
        <div><dt>Coins</dt><dd data-runner-hud="coins">{state.coins.toLocaleString('en-US')}</dd></div>
        <div><dt>Streak</dt><dd>{state.streak.toLocaleString('en-US')}×</dd></div>
        <div>
          <dt>Powell gap</dt>
          <dd>{Math.round(state.powellGap)}%</dd>
        </div>
      </dl>
      <progress
        aria-label="Powell gap"
        max={100}
        value={state.powellGap}
      />
      {state.phase === 'running' || paused ? (
        <Button variant="secondary" onClick={onPause}>
          {paused ? 'Resume run' : 'Pause run'}
        </Button>
      ) : null}
      {paused ? <p className="runner-hud__paused">Run paused</p> : null}
    </section>
  )
}
