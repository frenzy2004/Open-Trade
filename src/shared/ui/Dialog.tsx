import {
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react'
import { Button } from './Button'

export interface DialogProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  actions?: ReactNode
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  actions,
  children,
}: PropsWithChildren<DialogProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = 'dialog-title-' + useId()
  const descriptionId = titleId + '-description'

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) {
      return
    }

    if (open) {
      if (dialog.open) {
        return
      }

      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      dialog.showModal()
      const firstControl = dialog.querySelector<HTMLElement>(
        '[data-autofocus], button, [href], input, select, textarea',
      )
      firstControl?.focus()
      return
    }

    if (dialog.open) {
      dialog.close()
    }
    previousFocusRef.current?.focus()
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current

    return () => {
      if (dialog === null) {
        return
      }

      if (dialog.open) {
        dialog.close()
      }
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="ui-dialog"
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="ui-dialog__surface">
        <div className="ui-dialog__heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description === undefined ? null : (
              <p id={descriptionId}>{description}</p>
            )}
          </div>
          <Button
            variant="secondary"
            aria-label={'Close ' + title}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
        <div className="ui-dialog__body">{children}</div>
        {actions === undefined ? null : (
          <div className="ui-dialog__actions">{actions}</div>
        )}
      </div>
    </dialog>
  )
}
