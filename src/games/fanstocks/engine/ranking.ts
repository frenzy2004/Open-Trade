import type { ParticipantId } from './rules';
import {
  FANSTOCKS_RULES,
  PARTICIPANT_ORDER,
  TOTAL_MARKET_TICKS,
} from './rules';
import type { PriceFrame } from './priceEngine';
import { portfolioValue } from './priceEngine';
import { isCanonicalPortfolioMap } from './portfolioValidation';
import type { TradeEvent } from './trades';
import type { PortfolioMap } from './types';

export interface RankedPortfolio {
  readonly participantId: ParticipantId;
  readonly rank: number;
  readonly value: number;
  readonly returnPercent: number;
  readonly decisiveTicker: string;
  readonly tied: boolean;
}

export interface FanStocksResult {
  readonly rows: readonly RankedPortfolio[];
  readonly winnerIds: readonly ParticipantId[];
  readonly isTie: boolean;
  readonly acceptedTrades: readonly TradeEvent[];
}

const INVALID_PORTFOLIOS_MESSAGE = 'Portfolios must contain every FanStocks participant with matching ids and valid three-card portfolios';
const INVALID_FRAME_MESSAGE = 'Price frame must contain a valid tick and finite portfolio multipliers';

function assertValidPortfolios(portfolios: PortfolioMap): void {
  if (!isCanonicalPortfolioMap(portfolios)) {
    throw new RangeError(INVALID_PORTFOLIOS_MESSAGE);
  }
}

function assertValidFrame(portfolios: PortfolioMap, frame: PriceFrame): void {
  if (typeof frame !== 'object' || frame === null) {
    throw new RangeError(INVALID_FRAME_MESSAGE);
  }

  const multipliers = frame.multipliers as Readonly<Record<string, unknown>>;
  if (
    !Number.isSafeInteger(frame.tick)
    || frame.tick < 0
    || frame.tick > TOTAL_MARKET_TICKS
    || typeof multipliers !== 'object'
    || multipliers === null
    || PARTICIPANT_ORDER.some((participantId) => (
      portfolios[participantId].tickers.some((ticker) => (
        !Object.hasOwn(multipliers, ticker)
        || typeof multipliers[ticker] !== 'number'
        || !Number.isFinite(multipliers[ticker])
      ))
    ))
  ) {
    throw new RangeError(INVALID_FRAME_MESSAGE);
  }
}

function multiplierFor(frame: PriceFrame, ticker: string): number {
  const multiplier = frame.multipliers[ticker];
  if (multiplier === undefined) throw new RangeError(INVALID_FRAME_MESSAGE);
  return multiplier;
}

export function rankPortfolios(
  portfolios: PortfolioMap,
  frame: PriceFrame,
): readonly RankedPortfolio[] {
  assertValidPortfolios(portfolios);
  assertValidFrame(portfolios, frame);

  const rows = PARTICIPANT_ORDER.map((participantId) => {
    const portfolio = portfolios[participantId];
    const value = portfolioValue(portfolio, frame);
    const decisiveTicker = [...portfolio.tickers].sort((left, right) => (
      multiplierFor(frame, right) - multiplierFor(frame, left)
      || left.localeCompare(right)
    ))[0];
    if (decisiveTicker === undefined) {
      throw new RangeError(INVALID_PORTFOLIOS_MESSAGE);
    }
    return {
      participantId,
      value,
      returnPercent: Math.round(
        (value / FANSTOCKS_RULES.startingValue - 1) * 10_000,
      ) / 100,
      decisiveTicker,
    };
  }).sort((left, right) => (
    right.value - left.value
    || PARTICIPANT_ORDER.indexOf(left.participantId)
      - PARTICIPANT_ORDER.indexOf(right.participantId)
  ));

  return Object.freeze(rows.map((row) => {
    const rank = rows.findIndex(({ value }) => value === row.value) + 1;
    const tied = rows.some((candidate) => (
      candidate.participantId !== row.participantId
      && candidate.value === row.value
    ));
    return Object.freeze({ ...row, rank, tied });
  }));
}

export function buildFanStocksResult(
  portfolios: PortfolioMap,
  frame: PriceFrame,
  tradeLog: readonly TradeEvent[],
): FanStocksResult {
  const rows = rankPortfolios(portfolios, frame);
  const winnerIds = Object.freeze(
    rows.filter(({ rank }) => rank === 1).map(({ participantId }) => participantId),
  );
  const acceptedTrades = Object.freeze(
    tradeLog
      .filter(({ status }) => status === 'accepted')
      .map((event) => Object.freeze({ ...event })),
  );

  return Object.freeze({
    rows,
    winnerIds,
    isTie: winnerIds.length > 1,
    acceptedTrades,
  });
}
