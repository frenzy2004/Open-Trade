import { useState } from 'react'
import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
  Button,
  Dialog,
  ProgressBar,
  ToastProvider,
  useToasts,
} from './index'

function DialogHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Explain this game</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="How it works"
        description="Read the rules before playing."
      >
        <p>Make deliberate choices and compare the result.</p>
      </Dialog>
    </>
  )
}

function FocusTrapDialogHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open focus trap</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Focus trap"
        actions={
          <>
            <Button disabled>Disabled action</Button>
            <Button>Last action</Button>
          </>
        }
      >
        <Button>First action</Button>
        <Button hidden>Hidden action</Button>
        <Button tabIndex={-1}>Programmatic action</Button>
      </Dialog>
    </>
  )
}

function ToastHarness() {
  const { addToast } = useToasts()

  return (
    <Button onClick={() => addToast('Progress reset', 'success')}>
      Reset progress
    </Button>
  )
}

function SameTitleDialogsHarness() {
  return (
    <>
      <Dialog
        open={false}
        onClose={() => undefined}
        title="Shared title"
        description="First description"
      >
        <p>First dialog body</p>
      </Dialog>
      <Dialog
        open={false}
        onClose={() => undefined}
        title="Shared title"
        description="Second description"
      >
        <p>Second dialog body</p>
      </Dialog>
    </>
  )
}

test('dialog closes on Escape and returns focus to its trigger', async () => {
  const screen = await render(<DialogHarness />)
  const trigger = screen.getByRole('button', { name: 'Explain this game' })

  await trigger.click()
  await expect.element(
    screen.getByRole('dialog', { name: 'How it works' }),
  ).toBeVisible()

  await userEvent.keyboard('{Escape}')
  expect(document.querySelector('dialog')?.open).toBe(false)
  await expect.element(trigger).toHaveFocus()
})

test('dialog traps forward and reverse focus among visible enabled controls', async () => {
  const screen = await render(<FocusTrapDialogHarness />)
  await screen.getByRole('button', { name: 'Open focus trap' }).click()

  const dialog = screen.getByRole('dialog', { name: 'Focus trap' })
  const close = screen.getByRole('button', { name: 'Close Focus trap' })
  const first = screen.getByRole('button', { name: 'First action' })
  const last = screen.getByRole('button', { name: 'Last action' })
  await expect.element(close).toHaveFocus()

  await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
  await expect.element(last).toHaveFocus()
  expect(dialog.element().contains(document.activeElement)).toBe(true)

  await userEvent.keyboard('{Tab}')
  await expect.element(close).toHaveFocus()
  await userEvent.keyboard('{Tab}')
  await expect.element(first).toHaveFocus()
  await userEvent.keyboard('{Tab}')
  await expect.element(last).toHaveFocus()
  expect(dialog.element().contains(document.activeElement)).toBe(true)
})

test('same-title dialogs reference their own headings and descriptions', async () => {
  await render(<SameTitleDialogsHarness />)
  const dialogs = document.querySelectorAll('dialog')
  const [firstDialog, secondDialog] = Array.from(dialogs)
  const firstTitleId = firstDialog?.getAttribute('aria-labelledby')
  const secondTitleId = secondDialog?.getAttribute('aria-labelledby')
  const firstDescriptionId = firstDialog?.getAttribute('aria-describedby')
  const secondDescriptionId = secondDialog?.getAttribute('aria-describedby')

  expect(firstTitleId).toBeTruthy()
  expect(secondTitleId).toBeTruthy()
  expect(firstTitleId).not.toBe(secondTitleId)
  expect(firstDescriptionId).not.toBe(secondDescriptionId)
  expect(firstDialog?.querySelector('h2')?.id).toBe(firstTitleId)
  expect(secondDialog?.querySelector('h2')?.id).toBe(secondTitleId)
  expect(firstDialog?.querySelector('p')?.id).toBe(firstDescriptionId)
  expect(secondDialog?.querySelector('p')?.id).toBe(secondDescriptionId)
})

test('controlled dialog close explicitly focuses the original trigger', async () => {
  const screen = await render(<DialogHarness />)
  const trigger = screen.getByRole('button', { name: 'Explain this game' })

  await trigger.click()
  const triggerElement = document.querySelector<HTMLButtonElement>('button')
  expect(triggerElement).toBeTruthy()
  const originalFocus = triggerElement?.focus.bind(triggerElement)
  let focusCallCount = 0

  if (triggerElement !== null && originalFocus !== undefined) {
    triggerElement.focus = () => {
      focusCallCount += 1
      originalFocus()
    }
  }

  await screen.getByRole('button', { name: 'Close How it works' }).click()

  expect(focusCallCount).toBeGreaterThan(0)
  await expect.element(trigger).toHaveFocus()
})

test('progress bar exposes a text label and numeric state', async () => {
  const screen = await render(
    <ProgressBar label="Draft progress" value={2} max={3} />,
  )

  await expect.element(
    screen.getByRole('progressbar', { name: 'Draft progress' }),
  ).toHaveAttribute('aria-valuenow', '2')
})

test('toast announcements are visible in a polite live region', async () => {
  const screen = await render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>,
  )

  await screen.getByRole('button', { name: 'Reset progress' }).click()
  await expect.element(screen.getByText('Progress reset')).toBeVisible()
  await expect.element(screen.getByRole('status')).toHaveAttribute(
    'aria-live',
    'polite',
  )
})
