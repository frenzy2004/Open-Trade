import type { SeededRng } from '../../../shared/rng/seededRng';
import type { StockCard, Ticker } from '../content/types';
import { validateStocks } from '../content/validateStocks';
import { FANSTOCKS_RULES, TOTAL_MARKET_TICKS } from './rules';
import type { Portfolio } from './types';

export interface PriceFrame {
  readonly tick: number;
  readonly multipliers: Readonly<Record<Ticker, number>>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const MIN_MULTIPLIER = 0.65;
const MAX_MULTIPLIER = 1.45;
const MIN_RETURN = -0.035;
const MAX_RETURN = 0.035;

const clamp = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, value))
);

const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

function normalish(rng: SeededRng): number {
  let sum = 0;
  for (let sample = 0; sample < 6; sample += 1) {
    const value = rng.next();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('RNG values must be finite numbers from 0 inclusive to 1 exclusive');
    }
    sum += value;
  }
  return (sum - 3) / 3;
}

function assertValidCards(cards: readonly StockCard[]): void {
  if (cards.length === 0 || validateStocks(cards).length > 0) {
    throw new RangeError('Card registry must contain valid unique cards');
  }
}

function assertValidFrameTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0 || tick > TOTAL_MARKET_TICKS) {
    throw new RangeError(
      `Price frame tick must be an integer from 0 to ${TOTAL_MARKET_TICKS}`,
    );
  }
}

function assertFrameMatchesCards(
  frame: PriceFrame,
  cards: readonly StockCard[],
): void {
  const multipliers = frame.multipliers as Readonly<Record<string, unknown>>;
  if (typeof multipliers !== 'object' || multipliers === null) {
    throw new RangeError('Price frame must match the card registry');
  }

  const frameTickers = Object.keys(multipliers);
  if (
    frameTickers.length !== cards.length
    || cards.some(({ ticker }) => (
      !Object.hasOwn(multipliers, ticker)
      || typeof multipliers[ticker] !== 'number'
      || !Number.isFinite(multipliers[ticker])
      || multipliers[ticker] < MIN_MULTIPLIER
      || multipliers[ticker] > MAX_MULTIPLIER
    ))
  ) {
    throw new RangeError('Price frame must match the card registry');
  }
}

export function createInitialPriceFrame(cards: readonly StockCard[]): PriceFrame {
  assertValidCards(cards);
  return Object.freeze({
    tick: 0,
    multipliers: Object.freeze(Object.fromEntries(
      cards.map(({ ticker }) => [ticker, 1]),
    )),
  });
}

export function advancePriceFrame(
  previous: PriceFrame,
  cards: readonly StockCard[],
  sessionRng: SeededRng,
): PriceFrame {
  assertValidFrameTick(previous.tick);
  if (previous.tick === TOTAL_MARKET_TICKS) return previous;

  assertValidCards(cards);
  assertFrameMatchesCards(previous, cards);

  const tick = previous.tick + 1;
  const tickRng = sessionRng.fork(`market:${tick}`);
  const marketShock = normalish(tickRng.fork('market'));
  const groupShocks = new Map(
    [...new Set(cards.map(({ correlationGroup }) => correlationGroup))]
      .map((group) => [
        group,
        normalish(tickRng.fork(`group:${group}`)),
      ] as const),
  );
  const multipliers = Object.fromEntries(cards.map((card) => {
    const groupShock = groupShocks.get(card.correlationGroup);
    if (groupShock === undefined) {
      throw new Error(`Missing market shock for ${card.correlationGroup}`);
    }
    const stockShock = normalish(tickRng.fork(`stock:${card.ticker}`));
    const rawReturn = card.momentumBias * 0.0006
      + marketShock * 0.006
      + groupShock * 0.009
      + stockShock * card.volatility * 0.018;
    const prior = previous.multipliers[card.ticker];
    if (prior === undefined) {
      throw new RangeError('Price frame must match the card registry');
    }
    const next = clamp(
      prior * (1 + clamp(rawReturn, MIN_RETURN, MAX_RETURN)),
      MIN_MULTIPLIER,
      MAX_MULTIPLIER,
    );
    return [card.ticker, round6(next)];
  }));

  return Object.freeze({
    tick,
    multipliers: Object.freeze(multipliers),
  });
}

export function portfolioValue(portfolio: Portfolio, frame: PriceFrame): number {
  if (
    portfolio.tickers.length === 0
    || portfolio.tickers.some((ticker) => (
      !Object.hasOwn(frame.multipliers, ticker)
      || typeof frame.multipliers[ticker] !== 'number'
      || !Number.isFinite(frame.multipliers[ticker])
    ))
  ) {
    throw new RangeError('Portfolio must contain known tickers');
  }

  const average = portfolio.tickers.reduce(
    (sum, ticker) => {
      const multiplier = frame.multipliers[ticker];
      if (multiplier === undefined) {
        throw new RangeError('Portfolio must contain known tickers');
      }
      return sum + multiplier;
    },
    0,
  ) / portfolio.tickers.length;
  return Math.round(FANSTOCKS_RULES.startingValue * average * 100) / 100;
}

export function marketLabel(
  tick: number,
): { day: string; tickInDay: number; closed: boolean } {
  if (!Number.isSafeInteger(tick) || tick < 0 || tick > TOTAL_MARKET_TICKS) {
    throw new RangeError(
      `Market tick must be an integer from 0 to ${TOTAL_MARKET_TICKS}`,
    );
  }
  if (tick === TOTAL_MARKET_TICKS) {
    return {
      day: 'Friday close',
      tickInDay: FANSTOCKS_RULES.ticksPerDay,
      closed: true,
    };
  }
  const day = DAYS[Math.floor(tick / FANSTOCKS_RULES.ticksPerDay)];
  if (day === undefined) throw new RangeError('Market tick does not map to a trading day');
  return {
    day,
    tickInDay: tick % FANSTOCKS_RULES.ticksPerDay,
    closed: false,
  };
}
