import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'

export interface TutorialDialogProps {
  open: boolean
  onDismiss: () => void
}

export function TutorialDialog({
  open,
  onDismiss,
}: TutorialDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      title="How to play"
      description="Four steps to Friday close"
    >
      <ol>
        <li>
          Pick one stock in each of three rounds. Together they start as your
          $50 portfolio.
        </li>
        <li>
          Momentum, Contrarian, and Balanced build their own $50 portfolios.
        </li>
        <li>
          Select an opponent to offer a one-for-one stock trade; decide
          incoming offers with Accept or Pass.
        </li>
        <li>
          The highest simulated portfolio value at Friday close wins. Tied
          leaders share first place.
        </li>
      </ol>
      <Button variant="primary" onClick={onDismiss}>
        Got it
      </Button>
    </Dialog>
  )
}
