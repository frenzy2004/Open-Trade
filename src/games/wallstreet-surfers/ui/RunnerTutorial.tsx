import { Button } from '../../../shared/ui'
import type { TutorialAction, TutorialStep } from './tutorialState'

export interface RunnerTutorialProps {
  readonly step: TutorialStep
  readonly onAction: (action: TutorialAction) => void
}

const STEP_COPY: Readonly<Record<Exclude<TutorialStep, 'complete'>, string>> = {
  lane: 'First, change lane with Left or Right.',
  jump: 'Nice. Jump over the next barrier.',
  roll: 'Now roll under the market sign.',
  gate: 'Sample call: earnings beat expectations. Choose Up / Jump for LONG. Down / Roll is SHORT.',
}

export function RunnerTutorial({ step, onAction }: RunnerTutorialProps) {
  if (step === 'complete') return null
  return (
    <aside className="runner-tutorial" aria-label="Runner tutorial">
      <p role="status">{STEP_COPY[step]}</p>
      {step === 'gate' ? (
        <div className="runner-tutorial__answers" role="group" aria-label="Sample market call">
          <Button onClick={() => onAction('ANSWER_LONG')}>LONG</Button>
          <Button variant="secondary" onClick={() => onAction('ANSWER_SHORT')}>
            SHORT
          </Button>
        </div>
      ) : null}
    </aside>
  )
}
