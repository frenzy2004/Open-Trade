import { describe, expect, it, vi } from 'vitest'
import type { RunnerCommand } from '../engine/types'
import { RunnerInput, type RunnerGamepadLike } from './RunnerInput'
import { resolveSwipe } from './swipe'

describe('resolveSwipe', () => {
  it.each([
    [{ x: 0, y: 0 }, { x: -40, y: 4 }, 'MOVE_LEFT'],
    [{ x: 0, y: 0 }, { x: 40, y: -4 }, 'MOVE_RIGHT'],
    [{ x: 0, y: 0 }, { x: 3, y: -40 }, 'JUMP'],
    [{ x: 0, y: 0 }, { x: -3, y: 40 }, 'ROLL'],
  ] as const)('maps a dominant 40px gesture %#', (start, end, expected) => {
    expect(resolveSwipe(start, end)).toBe(expected)
  })

  it('rejects short, diagonal, non-finite, and invalid-threshold gestures', () => {
    expect(resolveSwipe({ x: 0, y: 0 }, { x: 39, y: 0 })).toBeNull()
    expect(resolveSwipe({ x: 0, y: 0 }, { x: 50, y: 50 })).toBeNull()
    expect(resolveSwipe({ x: 0, y: 0 }, { x: Number.NaN, y: 0 })).toBeNull()
    expect(() => resolveSwipe({ x: 0, y: 0 }, { x: 50, y: 0 }, 0)).toThrow(
      /threshold/i,
    )
  })
})

describe('RunnerInput', () => {
  it.each([
    ['ArrowLeft', 'MOVE_LEFT'],
    ['KeyA', 'MOVE_LEFT'],
    ['ArrowRight', 'MOVE_RIGHT'],
    ['KeyD', 'MOVE_RIGHT'],
    ['ArrowUp', 'JUMP'],
    ['KeyW', 'JUMP'],
    ['Space', 'JUMP'],
    ['ArrowDown', 'ROLL'],
    ['KeyS', 'ROLL'],
    ['Escape', 'PAUSE'],
    ['KeyP', 'PAUSE'],
  ] as const)('maps active event.code %s to %s', (code, expected) => {
    const target = new EventTarget()
    const dispatch = vi.fn<(command: RunnerCommand) => void>()
    const input = new RunnerInput(dispatch)
    input.attach(target)
    const event = new KeyboardEvent('keydown', { code, cancelable: true })

    target.dispatchEvent(event)

    expect(dispatch).toHaveBeenCalledWith(expected)
    expect(event.defaultPrevented).toBe(true)
    input.detach()
  })

  it('ignores repeats and unmapped keys, then stops preventing after detach', () => {
    const target = new EventTarget()
    const dispatch = vi.fn<(command: RunnerCommand) => void>()
    const input = new RunnerInput(dispatch)
    input.attach(target)
    const repeat = new KeyboardEvent('keydown', {
      code: 'ArrowLeft',
      repeat: true,
      cancelable: true,
    })
    const unmapped = new KeyboardEvent('keydown', {
      code: 'KeyZ',
      cancelable: true,
    })
    target.dispatchEvent(repeat)
    target.dispatchEvent(unmapped)
    input.detach()
    const detached = new KeyboardEvent('keydown', {
      code: 'ArrowRight',
      cancelable: true,
    })
    target.dispatchEvent(detached)

    expect(dispatch).not.toHaveBeenCalled()
    expect(repeat.defaultPrevented).toBe(true)
    expect(unmapped.defaultPrevented).toBe(false)
    expect(detached.defaultPrevented).toBe(false)
  })

  it('maps pointer swipes only while attached', () => {
    const target = new EventTarget()
    const dispatch = vi.fn<(command: RunnerCommand) => void>()
    const input = new RunnerInput(dispatch)
    input.attach(target)
    const start = new Event('pointerdown')
    Object.assign(start, { clientX: 10, clientY: 10, pointerId: 1, isPrimary: true })
    const end = new Event('pointerup', { cancelable: true })
    Object.assign(end, { clientX: 55, clientY: 12, pointerId: 1, isPrimary: true })

    target.dispatchEvent(start)
    target.dispatchEvent(end)

    expect(dispatch).toHaveBeenCalledWith('MOVE_RIGHT')
    expect(end.defaultPrevented).toBe(true)
    input.detach()
  })

  it('captures a pointer, ignores a foreign release, and cancels cleanly', () => {
    const target = document.createElement('div')
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    Object.assign(target, { setPointerCapture, releasePointerCapture })
    const dispatch = vi.fn<(command: RunnerCommand) => void>()
    const input = new RunnerInput(dispatch)
    input.attach(target)
    const pointer = (type: string, pointerId: number, x: number) => {
      const event = new Event(type, { cancelable: true })
      Object.assign(event, { clientX: x, clientY: 0, pointerId, isPrimary: true })
      return event
    }

    target.dispatchEvent(pointer('pointerdown', 4, 0))
    target.dispatchEvent(pointer('pointerup', 9, 50))
    expect(dispatch).not.toHaveBeenCalled()
    target.dispatchEvent(pointer('pointerup', 4, 50))
    expect(dispatch).toHaveBeenCalledWith('MOVE_RIGHT')
    expect(setPointerCapture).toHaveBeenCalledWith(4)
    expect(releasePointerCapture).toHaveBeenCalledWith(4)

    target.dispatchEvent(pointer('pointerdown', 5, 0))
    target.dispatchEvent(pointer('pointercancel', 5, 0))
    target.dispatchEvent(pointer('pointerup', 5, 50))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(releasePointerCapture).toHaveBeenCalledWith(5)
    input.detach()
  })

  it('edge-triggers standard gamepad D-pad/stick, A, B, and Start', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }))
    const gamepad: RunnerGamepadLike = {
      connected: true,
      mapping: 'standard',
      axes: [0, 0],
      buttons,
    }
    const dispatch = vi.fn<(command: RunnerCommand) => void>()
    const input = new RunnerInput(dispatch, { getGamepads: () => [gamepad] })

    const dpadLeft = buttons[14]
    const primary = buttons[0]
    const secondary = buttons[1]
    const start = buttons[9]
    if (
      dpadLeft === undefined
      || primary === undefined
      || secondary === undefined
      || start === undefined
    ) {
      throw new Error('Expected standard gamepad buttons')
    }
    dpadLeft.pressed = true
    primary.pressed = true
    input.pollGamepad()
    input.pollGamepad()
    expect(dispatch.mock.calls).toEqual([
      ['MOVE_LEFT'],
      ['JUMP'],
    ])

    dpadLeft.pressed = false
    primary.pressed = false
    input.pollGamepad()
    gamepad.axes = [0.7, 0.8]
    secondary.pressed = true
    start.pressed = true
    input.pollGamepad()
    expect(dispatch.mock.calls.slice(2)).toEqual([
      ['MOVE_RIGHT'],
      ['ROLL'],
      ['PAUSE'],
    ])
  })

  it('scans a non-iterable ArrayLike gamepad list without array helpers', () => {
    const gamepad: RunnerGamepadLike = {
      connected: true,
      mapping: 'standard',
      axes: [-0.8, 0],
      buttons: [],
    }
    const gamepads: ArrayLike<RunnerGamepadLike | null> = {
      0: gamepad,
      length: 1,
    }
    const dispatch = vi.fn<(command: RunnerCommand) => void>()
    const input = new RunnerInput(dispatch, { getGamepads: () => gamepads })

    input.pollGamepad()
    input.pollGamepad()

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith('MOVE_LEFT')
  })

  it('uses the native default GamepadList without iterating or cloning it', () => {
    const gamepad: RunnerGamepadLike = {
      connected: true,
      mapping: 'standard',
      axes: [-0.8, 0],
      buttons: [],
    }
    const nativeList = {
      0: gamepad,
      length: 1,
      [Symbol.iterator]: () => {
        throw new Error('The native adapter must not iterate to clone GamepadList')
      },
    }
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'getGamepads')
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => nativeList,
    })
    const dispatch = vi.fn<(command: RunnerCommand) => void>()
    try {
      new RunnerInput(dispatch).pollGamepad()
      expect(dispatch).toHaveBeenCalledWith('MOVE_LEFT')
    } finally {
      if (descriptor === undefined) {
        Reflect.deleteProperty(navigator, 'getGamepads')
      } else {
        Object.defineProperty(navigator, 'getGamepads', descriptor)
      }
    }
  })

  it('yields global shortcuts to handled events, controls, and open dialogs', () => {
    const dispatch = vi.fn<(command: RunnerCommand) => void>()
    const runnerInput = new RunnerInput(dispatch)
    runnerInput.attach(window)
    const formInput = document.createElement('input')
    const editable = document.createElement('div')
    const button = document.createElement('button')
    editable.contentEditable = 'true'
    document.body.append(formInput, editable, button)

    const send = (target: EventTarget, code: string, prevented = false) => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code,
      })
      if (prevented) event.preventDefault()
      target.dispatchEvent(event)
      return event
    }

    try {
      expect(send(formInput, 'Space').defaultPrevented).toBe(false)
      expect(send(editable, 'ArrowLeft').defaultPrevented).toBe(false)
      expect(send(button, 'Space').defaultPrevented).toBe(false)
      send(window, 'ArrowRight', true)

      const dialog = document.createElement('dialog')
      dialog.setAttribute('open', '')
      document.body.append(dialog)
      expect(send(window, 'Escape').defaultPrevented).toBe(false)
      dialog.remove()

      const runnerSurface = document.createElement('div')
      document.body.append(runnerSurface)
      const runnerEvent = send(runnerSurface, 'ArrowRight')
      expect(runnerEvent.defaultPrevented).toBe(true)
      expect(dispatch).toHaveBeenCalledTimes(1)
      expect(dispatch).toHaveBeenCalledWith('MOVE_RIGHT')
      runnerSurface.remove()
    } finally {
      runnerInput.detach()
      formInput.remove()
      editable.remove()
      button.remove()
    }
  })

  it('rejects duplicate attachment and tolerates unavailable gamepads', () => {
    const target = new EventTarget()
    const input = new RunnerInput(vi.fn(), { getGamepads: () => [null] })
    input.attach(target)
    expect(() => input.attach(target)).toThrow(/already attached/i)
    expect(() => input.pollGamepad()).not.toThrow()
    input.detach()
    expect(() => input.detach()).not.toThrow()
  })
})
