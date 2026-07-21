import {
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react'
import { Button } from './Button'

const TABBABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
  '[contenteditable="true"]',
].join(', ')

function getTabbableElements(dialog: HTMLDialogElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR),
  )
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => {
      const style = window.getComputedStyle(element)
      return (
        element.tabIndex >= 0 &&
        !element.matches(':disabled') &&
        element.closest('[inert], [aria-hidden="true"]') === null &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        element.getClientRects().length > 0
      )
    })
    .sort((left, right) => {
      const leftOrder =
        left.element.tabIndex === 0
          ? Number.MAX_SAFE_INTEGER
          : left.element.tabIndex
      const rightOrder =
        right.element.tabIndex === 0
          ? Number.MAX_SAFE_INTEGER
          : right.element.tabIndex
      return leftOrder - rightOrder || left.index - right.index
    })
    .map(({ element }) => element)
}

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
      const tabbableElements = getTabbableElements(dialog)
      const firstControl =
        tabbableElements.find((element) =>
          element.hasAttribute('data-autofocus'),
        ) ?? tabbableElements[0]
      firstControl?.focus()
      return
    }

    if (dialog.open) {
      dialog.close()
    }
    const previousFocus = previousFocusRef.current
    previousFocusRef.current = null
    previousFocus?.focus()
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
      const previousFocus = previousFocusRef.current
      previousFocusRef.current = null
      if (previousFocus?.isConnected === true) {
        previousFocus.focus()
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
      onKeyDown={(event) => {
        if (
          event.key !== 'Tab' ||
          event.defaultPrevented ||
          !(event.target instanceof Element) ||
          event.target.closest('dialog') !== event.currentTarget
        ) {
          return
        }

        const tabbableElements = getTabbableElements(event.currentTarget)
        const firstControl = tabbableElements[0]
        const lastControl = tabbableElements.at(-1)
        if (firstControl === undefined || lastControl === undefined) {
          return
        }

        const activeElement = document.activeElement
        const focusOutsideDialog =
          !(activeElement instanceof Node) ||
          !event.currentTarget.contains(activeElement)
        if (
          event.shiftKey &&
          (activeElement === firstControl || focusOutsideDialog)
        ) {
          event.preventDefault()
          lastControl.focus()
        } else if (
          !event.shiftKey &&
          (activeElement === lastControl || focusOutsideDialog)
        ) {
          event.preventDefault()
          firstControl.focus()
        }
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
