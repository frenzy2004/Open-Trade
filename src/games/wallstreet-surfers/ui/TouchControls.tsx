import { Button } from '../../../shared/ui'
import type { RunnerCommand } from '../engine/types'

export interface TouchControlsProps {
  readonly onCommand: (command: RunnerCommand) => void
  readonly disabled?: boolean
}

const CONTROLS = Object.freeze([
  { label: 'Move left', text: '←', command: 'MOVE_LEFT' },
  { label: 'Move right', text: '→', command: 'MOVE_RIGHT' },
  { label: 'Jump or LONG', text: '↑ Jump · LONG', command: 'JUMP' },
  { label: 'Roll or SHORT', text: '↓ Roll · SHORT', command: 'ROLL' },
  { label: 'Pause', text: 'Pause', command: 'PAUSE' },
] as const satisfies readonly {
  readonly label: string
  readonly text: string
  readonly command: RunnerCommand
}[])

export function TouchControls({ onCommand, disabled = false }: TouchControlsProps) {
  return (
    <div className="runner-touch-controls" role="group" aria-label="Runner touch controls">
      {CONTROLS.map((control) => (
        <Button
          key={control.command}
          variant="secondary"
          aria-label={control.label}
          disabled={disabled}
          onClick={() => onCommand(control.command)}
        >
          {control.text}
        </Button>
      ))}
    </div>
  )
}
