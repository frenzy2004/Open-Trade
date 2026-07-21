import { STOCKS, STOCK_BY_TICKER } from '../content/stocks';
import { FANSTOCKS_RULES, PARTICIPANT_ORDER } from './rules';
import type { Portfolio, PortfolioMap } from './types';

export function isCanonicalPortfolioMap(value: unknown): value is PortfolioMap {
  if (typeof value !== 'object' || value === null) return false;

  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== PARTICIPANT_ORDER.length
    || PARTICIPANT_ORDER.some((participantId) => {
      if (!Object.hasOwn(record, participantId)) return true;
      const portfolio = record[participantId] as Partial<Portfolio> | undefined;
      return (
        typeof portfolio !== 'object'
        || portfolio === null
        || portfolio.participantId !== participantId
        || !Array.isArray(portfolio.tickers)
        || portfolio.tickers.length !== FANSTOCKS_RULES.cardsPerPortfolio
        || portfolio.tickers.some((ticker) => (
          typeof ticker !== 'string' || !STOCK_BY_TICKER.has(ticker)
        ))
        || new Set(portfolio.tickers).size !== portfolio.tickers.length
      );
    })
  ) {
    return false;
  }

  const allTickers = PARTICIPANT_ORDER.flatMap((participantId) => (
    (record[participantId] as Portfolio).tickers
  ));
  const uniqueTickers = new Set(allTickers);
  return allTickers.length === STOCKS.length
    && uniqueTickers.size === STOCKS.length
    && STOCKS.every(({ ticker }) => uniqueTickers.has(ticker));
}
