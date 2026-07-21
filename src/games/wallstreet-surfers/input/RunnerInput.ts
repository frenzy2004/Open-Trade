import type { RunnerCommand } from '../engine/types'
import { resolveSwipe, type SwipePoint } from './swipe'

const KEYBOARD_COMMANDS: Readonly<Record<string, RunnerCommand>> = Object.freeze({
  ArrowLeft: 'MOVE_LEFT',
  KeyA: 'MOVE_LEFT',
  ArrowRight: 'MOVE_RIGHT',
  KeyD: 'MOVE_RIGHT',
  ArrowUp: 'JUMP',
  KeyW: 'JUMP',
  Space: 'JUMP',
  ArrowDown: 'ROLL',
  KeyS: 'ROLL',
  Escape: 'PAUSE',
  KeyP: 'PAUSE',
})
const GAMEPAD_DEAD_ZONE = 0.6
const GAMEPAD_LEFT = 1 << 0
const GAMEPAD_RIGHT = 1 << 1
const GAMEPAD_JUMP = 1 << 2
const GAMEPAD_ROLL = 1 << 3
const GAMEPAD_PAUSE = 1 << 4
const MAX_SCANNED_GAMEPADS = 16
const EMPTY_GAMEPADS = Object.freeze([]) as readonly (RunnerGamepadLike | null)[]
const INTERACTIVE_SELECTOR = [
  'input',
  'select',
  'textarea',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
].join(',')

export interface RunnerGamepadButtonLike {
  pressed: boolean
}

export interface RunnerGamepadLike {
  connected: boolean
  mapping: string
  axes: readonly number[]
  buttons: readonly RunnerGamepadButtonLike[]
}

export interface RunnerInputOptions {
  readonly getGamepads?: () => ArrayLike<RunnerGamepadLike | null>
}

interface PointerLike {
  readonly clientX: number
  readonly clientY: number
  readonly pointerId: number
  readonly isPrimary?: boolean
}

function defaultGetGamepads(): ArrayLike<RunnerGamepadLike | null> {
  if (
    typeof navigator === 'undefined'
    || typeof navigator.getGamepads !== 'function'
  ) {
    return EMPTY_GAMEPADS
  }
  return navigator.getGamepads() as unknown as ArrayLike<RunnerGamepadLike | null>
}

function openModalExists(): boolean {
  return typeof document !== 'undefined'
    && document.querySelector(
      'dialog[open], [role="dialog"][aria-modal="true"]',
    ) !== null
}

function isContentEditableTarget(target: Element): boolean {
  let current: Element | null = target
  while (current !== null) {
    if (
      current instanceof HTMLElement
      && (
        current.isContentEditable === true
        || (
          typeof current.contentEditable === 'string'
          && current.contentEditable.toLowerCase() === 'true'
        )
      )
    ) {
      return true
    }
    current = current.parentElement
  }
  return false
}

function eventBelongsToInterface(event: Event): boolean {
  if (event.defaultPrevented || openModalExists()) return true
  if (!(event.target instanceof Element)) return false
  return event.target.closest(INTERACTIVE_SELECTOR) !== null
    || isContentEditableTarget(event.target)
}

function isPressed(gamepad: RunnerGamepadLike, index: number): boolean {
  return gamepad.buttons[index]?.pressed === true
}

function axis(gamepad: RunnerGamepadLike, index: number): number {
  const value = gamepad.axes[index]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asPointer(event: Event): PointerLike | null {
  const candidate = event as Event & Partial<PointerLike>
  return typeof candidate.clientX === 'number'
    && typeof candidate.clientY === 'number'
    && typeof candidate.pointerId === 'number'
    ? {
        clientX: candidate.clientX,
        clientY: candidate.clientY,
        pointerId: candidate.pointerId,
        ...(candidate.isPrimary === undefined
          ? {}
          : { isPrimary: candidate.isPrimary }),
      }
    : null
}

export class RunnerInput {
  private target: EventTarget | null = null
  private pointerStart: (SwipePoint & { readonly pointerId: number }) | null = null
  private gamepadMask = 0
  private readonly getGamepads: () => ArrayLike<RunnerGamepadLike | null>

  constructor(
    private readonly dispatch: (command: RunnerCommand) => void,
    options: RunnerInputOptions = {},
  ) {
    if (typeof dispatch !== 'function') {
      throw new TypeError('Runner input dispatch must be a function')
    }
    if (
      options.getGamepads !== undefined
      && typeof options.getGamepads !== 'function'
    ) {
      throw new TypeError('Runner input getGamepads must be a function')
    }
    this.getGamepads = options.getGamepads ?? defaultGetGamepads
  }

  private readonly handleKeyDown = (rawEvent: Event) => {
    const event = rawEvent as KeyboardEvent
    const command = KEYBOARD_COMMANDS[event.code]
    if (command === undefined || eventBelongsToInterface(event)) return
    event.preventDefault()
    if (!event.repeat) this.dispatch(command)
  }

  private readonly handlePointerDown = (event: Event) => {
    if (eventBelongsToInterface(event)) return
    const pointer = asPointer(event)
    if (pointer === null || pointer.isPrimary === false) return
    this.pointerStart = {
      x: pointer.clientX,
      y: pointer.clientY,
      pointerId: pointer.pointerId,
    }
    const captureTarget = this.target as EventTarget & {
      setPointerCapture?: (pointerId: number) => void
    }
    try {
      captureTarget.setPointerCapture?.(pointer.pointerId)
    } catch {
      // Some browser targets expose the method but reject capture before layout.
    }
  }

  private releasePointer(pointerId: number): void {
    const captureTarget = this.target as (EventTarget & {
      releasePointerCapture?: (capturedPointerId: number) => void
    }) | null
    try {
      captureTarget?.releasePointerCapture?.(pointerId)
    } catch {
      // The browser may have released capture after a native cancellation.
    }
  }

  private readonly handlePointerUp = (event: Event) => {
    const pointer = asPointer(event)
    const start = this.pointerStart
    if (
      eventBelongsToInterface(event)
      || pointer === null
      || pointer.isPrimary === false
      || start === null
      || start.pointerId !== pointer.pointerId
    ) {
      return
    }
    this.pointerStart = null
    this.releasePointer(pointer.pointerId)
    const command = resolveSwipe(start, {
      x: pointer.clientX,
      y: pointer.clientY,
    })
    if (command === null) return
    event.preventDefault()
    this.dispatch(command)
  }

  private readonly handlePointerCancel = (event: Event) => {
    const pointer = asPointer(event)
    const start = this.pointerStart
    if (start === null || (pointer !== null && pointer.pointerId !== start.pointerId)) {
      return
    }
    this.pointerStart = null
    this.releasePointer(start.pointerId)
  }

  attach(target: EventTarget): void {
    if (this.target !== null) {
      throw new Error('Runner input is already attached')
    }
    if (
      target === null
      || typeof target.addEventListener !== 'function'
      || typeof target.removeEventListener !== 'function'
    ) {
      throw new TypeError('Runner input target must be an EventTarget')
    }
    this.target = target
    target.addEventListener('keydown', this.handleKeyDown)
    target.addEventListener('pointerdown', this.handlePointerDown)
    target.addEventListener('pointerup', this.handlePointerUp)
    target.addEventListener('pointercancel', this.handlePointerCancel)
  }

  detach(): void {
    const target = this.target
    if (target === null) return
    target.removeEventListener('keydown', this.handleKeyDown)
    target.removeEventListener('pointerdown', this.handlePointerDown)
    target.removeEventListener('pointerup', this.handlePointerUp)
    target.removeEventListener('pointercancel', this.handlePointerCancel)
    if (this.pointerStart !== null) this.releasePointer(this.pointerStart.pointerId)
    this.target = null
    this.pointerStart = null
    this.gamepadMask = 0
  }

  pollGamepad(): void {
    let nextMask = 0
    try {
      const gamepads = this.getGamepads()
      const rawLength = gamepads.length
      const scanLength = Number.isSafeInteger(rawLength) && rawLength >= 0
        ? Math.min(rawLength, MAX_SCANNED_GAMEPADS)
        : 0
      for (let index = 0; index < scanLength; index += 1) {
        const gamepad = gamepads[index]
        if (gamepad?.connected !== true || gamepad.mapping !== 'standard') continue
        const horizontal = axis(gamepad, 0)
        const vertical = axis(gamepad, 1)
        if (isPressed(gamepad, 14) || horizontal <= -GAMEPAD_DEAD_ZONE) {
          nextMask |= GAMEPAD_LEFT
        }
        if (isPressed(gamepad, 15) || horizontal >= GAMEPAD_DEAD_ZONE) {
          nextMask |= GAMEPAD_RIGHT
        }
        if (isPressed(gamepad, 12) || isPressed(gamepad, 0) || vertical <= -GAMEPAD_DEAD_ZONE) {
          nextMask |= GAMEPAD_JUMP
        }
        if (isPressed(gamepad, 13) || isPressed(gamepad, 1) || vertical >= GAMEPAD_DEAD_ZONE) {
          nextMask |= GAMEPAD_ROLL
        }
        if (isPressed(gamepad, 9)) nextMask |= GAMEPAD_PAUSE
        break
      }
    } catch {
      nextMask = 0
    }

    const pressed = nextMask & ~this.gamepadMask
    if ((pressed & GAMEPAD_LEFT) !== 0) this.dispatch('MOVE_LEFT')
    if ((pressed & GAMEPAD_RIGHT) !== 0) this.dispatch('MOVE_RIGHT')
    if ((pressed & GAMEPAD_JUMP) !== 0) this.dispatch('JUMP')
    if ((pressed & GAMEPAD_ROLL) !== 0) this.dispatch('ROLL')
    if ((pressed & GAMEPAD_PAUSE) !== 0) this.dispatch('PAUSE')
    this.gamepadMask = nextMask
  }
}
