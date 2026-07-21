import { describe, expect, it } from 'vitest';
import { createSeededRng, type SeededRng } from '../../../shared/rng/seededRng';
import { STOCKS } from '../content/stocks';
import type { StockCard } from '../content/types';
import { TOTAL_MARKET_TICKS } from './rules';
import type { PriceFrame } from './priceEngine';
import {
  advancePriceFrame,
  createInitialPriceFrame,
  marketLabel,
  portfolioValue,
} from './priceEngine';

const PLAYER_PORTFOLIO = {
  participantId: 'player',
  tickers: ['XLE', 'DKNG', 'HUBS'],
} as const;

function path(seed: string): PriceFrame[] {
  const rng = createSeededRng(seed);
  let frame = createInitialPriceFrame(STOCKS);
  const frames = [frame];
  for (let tick = 0; tick < TOTAL_MARKET_TICKS; tick += 1) {
    frame = advancePriceFrame(frame, STOCKS, rng);
    frames.push(frame);
  }
  return frames;
}

function poisonRng(): SeededRng {
  const fail = (): never => {
    throw new Error('RNG must not be used');
  };
  return {
    seed: 0,
    next: fail,
    int: fail,
    pick: fail,
    shuffle: fail,
    fork: fail,
  };
}

describe('priceEngine', () => {
  it('starts every three-card portfolio at exactly $50', () => {
    const frame = createInitialPriceFrame(STOCKS);

    expect(portfolioValue(PLAYER_PORTFOLIO, frame)).toBe(50);
  });

  it('applies the exact tick-indexed market, group, and stock shock formula', () => {
    const next = advancePriceFrame(
      createInitialPriceFrame(STOCKS),
      STOCKS,
      createSeededRng('week-1'),
    );

    expect(next.tick).toBe(1);
    expect(next.multipliers.XLE).toBe(1.000281);
    expect(next.multipliers.DKNG).toBe(1.004482);
    expect(next.multipliers.HUBS).toBe(1.00131);
  });

  it('generates identical bounded 60-tick paths for identical seeds', () => {
    const first = path('week-1');

    expect(first).toEqual(path('week-1'));
    expect(first).toHaveLength(TOTAL_MARKET_TICKS + 1);
    expect(first.at(-1)?.tick).toBe(TOTAL_MARKET_TICKS);
    expect(first.flatMap(({ multipliers }) => Object.values(multipliers))
      .every((value) => value >= 0.65 && value <= 1.45)).toBe(true);
  });

  it('generates observably different paths for different seeds', () => {
    expect(path('week-1')).not.toEqual(path('week-2'));
  });

  it('maps ticks to an inspectable five-day label', () => {
    expect(marketLabel(0)).toEqual({ day: 'Monday', tickInDay: 0, closed: false });
    expect(marketLabel(12)).toEqual({ day: 'Tuesday', tickInDay: 0, closed: false });
    expect(marketLabel(59)).toEqual({ day: 'Friday', tickInDay: 11, closed: false });
    expect(marketLabel(60)).toEqual({ day: 'Friday close', tickInDay: 12, closed: true });
  });

  it('deep-freezes initial and advanced frames without mutating inputs', () => {
    const cards = [...STOCKS];
    const initial = createInitialPriceFrame(cards);
    const initialSnapshot = structuredClone(initial);
    const next = advancePriceFrame(initial, cards, createSeededRng('immutable'));

    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(initial.multipliers)).toBe(true);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.multipliers)).toBe(true);
    expect(initial).toEqual(initialSnapshot);
    expect(cards).toEqual(STOCKS);
  });

  it('does not advance the session RNG or use it after the market closes', () => {
    const used = createSeededRng('session');
    const untouched = createSeededRng('session');
    advancePriceFrame(createInitialPriceFrame(STOCKS), STOCKS, used);

    expect(used.next()).toBe(untouched.next());

    const closed = path('closed').at(-1);
    if (closed === undefined) throw new Error('Expected a closed frame fixture');
    expect(advancePriceFrame(closed, [], poisonRng())).toBe(closed);
  });

  it('rejects empty, duplicate, and malformed card registries explicitly', () => {
    const duplicate = [...STOCKS, STOCKS[0] as StockCard];
    const malformed = STOCKS.map((card) => (
      card.ticker === 'XLE' ? { ...card, volatility: Number.NaN } : card
    ));

    expect(() => createInitialPriceFrame([])).toThrow('Card registry must contain valid unique cards');
    expect(() => createInitialPriceFrame(duplicate)).toThrow('Card registry must contain valid unique cards');
    expect(() => createInitialPriceFrame(malformed)).toThrow('Card registry must contain valid unique cards');
  });

  it('rejects missing or unknown frame cards before touching RNG', () => {
    const initial = createInitialPriceFrame(STOCKS);

    expect(() => advancePriceFrame(initial, STOCKS.slice(1), poisonRng()))
      .toThrow('Price frame must match the card registry');
    expect(() => advancePriceFrame(initial, [...STOCKS, {
      ...STOCKS[0] as StockCard,
      ticker: 'NOPE',
    }], poisonRng())).toThrow('Price frame must match the card registry');
  });

  it('rejects empty and unknown portfolios rather than emitting NaN', () => {
    const frame = createInitialPriceFrame(STOCKS);

    expect(() => portfolioValue({ participantId: 'player', tickers: [] }, frame))
      .toThrow('Portfolio must contain known tickers');
    expect(() => portfolioValue({ participantId: 'player', tickers: ['NOPE'] }, frame))
      .toThrow('Portfolio must contain known tickers');
  });

  it.each([-1, 61, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid market tick %s',
    (tick) => {
      expect(() => marketLabel(tick)).toThrow('Market tick must be an integer from 0 to 60');
    },
  );

  it('rejects invalid frame ticks before touching RNG', () => {
    const invalid = {
      ...createInitialPriceFrame(STOCKS),
      tick: -1,
    };

    expect(() => advancePriceFrame(invalid, STOCKS, poisonRng()))
      .toThrow('Price frame tick must be an integer from 0 to 60');
  });
});
