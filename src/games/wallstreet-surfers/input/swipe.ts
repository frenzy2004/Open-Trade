import type { RunnerCommand } from '../engine/types'

export interface SwipePoint {
  readonly x: number
  readonly y: number
}

export const DEFAULT_SWIPE_THRESHOLD_PX = 40

export function resolveSwipe(
  start: SwipePoint,
  end: SwipePoint,
  thresholdPx = DEFAULT_SWIPE_THRESHOLD_PX,
): RunnerCommand | null {
  if (!Number.isFinite(thresholdPx) || thresholdPx <= 0) {
    throw new RangeError('Swipe threshold must be finite and positive')
  }
  if (
    !Number.isFinite(start.x)
    || !Number.isFinite(start.y)
    || !Number.isFinite(end.x)
    || !Number.isFinite(end.y)
  ) {
    return null
  }

  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const absoluteX = Math.abs(deltaX)
  const absoluteY = Math.abs(deltaY)
  if (absoluteX === absoluteY) return null
  if (absoluteX > absoluteY) {
    if (absoluteX < thresholdPx) return null
    return deltaX < 0 ? 'MOVE_LEFT' : 'MOVE_RIGHT'
  }
  if (absoluteY < thresholdPx) return null
  return deltaY < 0 ? 'JUMP' : 'ROLL'
}
