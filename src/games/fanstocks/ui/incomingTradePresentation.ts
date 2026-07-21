import { STOCK_BY_TICKER } from '../content/stocks'
import type { TradeOffer } from '../engine/trades'

const OFFER_FIELDS: readonly (keyof TradeOffer)[] = Object.freeze([
  'id',
  'direction',
  'opponentId',
  'playerGives',
  'playerReceives',
  'createdAtTick',
])

export function incomingTradeForDisplay(value: TradeOffer | null): TradeOffer | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const candidate = value as Partial<Record<keyof TradeOffer, unknown>>
  if (
    !OFFER_FIELDS.every((field) => Object.hasOwn(candidate, field))
    || typeof candidate.id !== 'string'
    || candidate.id.trim() === ''
    || candidate.direction !== 'incoming'
    || (
      candidate.opponentId !== 'momentum'
      && candidate.opponentId !== 'contrarian'
      && candidate.opponentId !== 'balanced'
    )
    || typeof candidate.playerGives !== 'string'
    || !STOCK_BY_TICKER.has(candidate.playerGives)
    || typeof candidate.playerReceives !== 'string'
    || !STOCK_BY_TICKER.has(candidate.playerReceives)
    || candidate.playerGives === candidate.playerReceives
    || !Number.isSafeInteger(candidate.createdAtTick)
    || (candidate.createdAtTick as number) < 0
  ) return null
  return value
}
