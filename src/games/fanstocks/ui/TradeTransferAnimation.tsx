import { useEffect, useState } from 'react'
import { STOCK_BY_TICKER } from '../content/stocks'
import type { TradeEvent } from '../engine/trades'

const EVENT_FIELDS: readonly (keyof TradeEvent)[] = Object.freeze([
  'id', 'direction', 'opponentId', 'playerGives', 'playerReceives', 'createdAtTick', 'status',
])

function acceptedEvent(value: TradeEvent | null): TradeEvent | null {
  if (
    typeof value !== 'object' || value === null || Array.isArray(value) ||
    !EVENT_FIELDS.every((field) => Object.hasOwn(value, field)) ||
    value.status !== 'accepted' ||
    typeof value.id !== 'string' || value.id === '' ||
    (value.direction !== 'incoming' && value.direction !== 'outgoing') ||
    (value.opponentId !== 'momentum' && value.opponentId !== 'contrarian' && value.opponentId !== 'balanced') ||
    typeof value.playerGives !== 'string' || !STOCK_BY_TICKER.has(value.playerGives) ||
    typeof value.playerReceives !== 'string' || !STOCK_BY_TICKER.has(value.playerReceives) ||
    value.playerGives === value.playerReceives ||
    !Number.isSafeInteger(value.createdAtTick) || value.createdAtTick < 0
  ) return null
  return value
}

export function TradeTransferAnimation({ event, reducedMotion }: {
  readonly event: TradeEvent | null
  readonly reducedMotion: boolean
}) {
  const accepted = acceptedEvent(event)
  const [hiddenEventId, setHiddenEventId] = useState<string | null>(null)
  const visible = accepted !== null && !reducedMotion && hiddenEventId !== accepted.id
  useEffect(() => {
    if (accepted === null || reducedMotion) return
    const timer = window.setTimeout(() => setHiddenEventId(accepted.id), 700)
    return () => window.clearTimeout(timer)
  }, [accepted, reducedMotion])

  if (accepted === null) return null
  return (
    <>
      <p className="sr-only" role="status" aria-atomic="true">
        Trade complete: received {accepted.playerReceives} and gave {accepted.playerGives}
      </p>
      {visible ? (
        <div className="trade-flight" data-testid="trade-flight" aria-hidden="true">
          <span>{accepted.playerReceives}</span>
          <span>{accepted.playerGives}</span>
        </div>
      ) : null}
    </>
  )
}
