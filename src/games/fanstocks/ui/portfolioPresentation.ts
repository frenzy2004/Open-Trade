import { STOCK_BY_TICKER } from '../content/stocks'
import type { Ticker } from '../content/types'
import { FANSTOCKS_RULES, type ParticipantId } from '../engine/rules'
import type { Portfolio, PortfolioMap } from '../engine/types'

function exactKnownTickers(value: unknown): readonly Ticker[] | null {
  if (!Array.isArray(value) || value.length !== FANSTOCKS_RULES.cardsPerPortfolio) return null
  const tickers: Ticker[] = []
  const seen = new Set<Ticker>()
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return null
    const ticker: unknown = value[index]
    if (typeof ticker !== 'string' || !STOCK_BY_TICKER.has(ticker) || seen.has(ticker)) return null
    seen.add(ticker)
    tickers.push(ticker)
  }
  return tickers
}

export function portfolioForDisplay(
  portfolios: PortfolioMap,
  participantId: ParticipantId,
): Portfolio | null {
  if (typeof portfolios !== 'object' || portfolios === null || !Object.hasOwn(portfolios, participantId)) return null
  const candidate: unknown = (portfolios as unknown as Record<string, unknown>)[participantId]
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return null
  const record = candidate as Record<PropertyKey, unknown>
  if (record.participantId !== participantId) return null
  const tickers = exactKnownTickers(record.tickers)
  return tickers === null ? null : { participantId, tickers }
}
