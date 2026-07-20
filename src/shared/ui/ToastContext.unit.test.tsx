import { act, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import {
  ToastProvider,
  type ToastTone,
  useToasts,
} from './ToastContext'

type AddToast = (message: string, tone?: ToastTone) => void

function ToastCapture({ capture }: { capture: (addToast: AddToast) => void }) {
  capture(useToasts().addToast)
  return null
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('clears a later active toast timer when the provider unmounts', () => {
  vi.useFakeTimers()
  const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
  const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout')
  let addToast: AddToast | undefined
  const { unmount } = render(
    <ToastProvider>
      <ToastCapture capture={(capturedAddToast) => {
        addToast = capturedAddToast
      }} />
    </ToastProvider>,
  )

  act(() => {
    addToast?.('First toast')
  })
  const firstTimer = setTimeoutSpy.mock.results.at(-1)?.value

  act(() => {
    vi.advanceTimersByTime(4000)
  })

  act(() => {
    addToast?.('Second toast')
  })
  const secondTimer = setTimeoutSpy.mock.results.at(-1)?.value

  expect(firstTimer).toBeDefined()
  expect(secondTimer).toBeDefined()
  expect(secondTimer).not.toBe(firstTimer)

  unmount()

  expect(clearTimeoutSpy).toHaveBeenCalledWith(secondTimer)
})
