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

function ToastHarness() {
  const { addToast } = useToasts()

  return (
    <Button onClick={() => addToast('Progress reset', 'success')}>
      Reset progress
    </Button>
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
