import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../shared/ui'
import type { RunnerState } from '../engine/types'

export interface RunnerGameOverProps {
  readonly state: RunnerState
  readonly onRunAgain: () => void
  readonly onShare: () => void
}

export function RunnerGameOver({ state, onRunAgain, onShare }: RunnerGameOverProps) {
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (state.phase === 'gameOver') dialogRef.current?.focus()
  }, [state.phase])
  if (state.phase !== 'gameOver') return null
  const failure = state.lastFailure ?? {
    message: 'The market caught you',
    tip: 'Read the next hazard and move early',
  }
  return (
    <section
      ref={dialogRef}
      className="runner-game-over"
      role="alertdialog"
      tabIndex={-1}
      aria-labelledby="runner-game-over-title"
    >
      <p className="eyebrow">Run over</p>
      <h2 id="runner-game-over-title">{failure.message}</h2>
      <p>{failure.tip}</p>
      <p>
        Score {state.score.toLocaleString('en-US')} · Best{' '}
        {state.bestScore.toLocaleString('en-US')}
      </p>
      <div className="runner-game-over__actions">
        <Button onClick={onRunAgain}>Run again</Button>
        <Button variant="secondary" onClick={onShare}>Challenge a friend</Button>
        <Link className="ui-button ui-button--ghost" to="/">Back to games</Link>
      </div>
    </section>
  )
}
