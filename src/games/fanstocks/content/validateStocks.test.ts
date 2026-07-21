import { describe, expect, it } from 'vitest';
import { AI_PERSONALITIES } from './personalities';
import { STOCK_BY_TICKER, STOCKS } from './stocks';
import type { StockCard } from './types';
import { validateStocks } from './validateStocks';

describe('FanStocks content', () => {
  it('contains twelve valid and unique synthetic-demo cards', () => {
    expect(STOCKS).toHaveLength(12);
    expect(validateStocks(STOCKS)).toEqual([]);
    expect(new Set(STOCKS.map(({ ticker }) => ticker)).size).toBe(12);
    expect(STOCKS.every(({ syntheticDemo }) => syntheticDemo)).toBe(true);
  });

  it('defines the three required personalities in stable seat order', () => {
    expect(AI_PERSONALITIES.map(({ id }) => id)).toEqual([
      'momentum', 'contrarian', 'balanced',
    ]);
  });

  it('reports every invalid field with a ticker-prefixed message', () => {
    const broken = { ...STOCKS[0], volatility: 2, evidence: ['one'], artworkKey: '../remote' } as unknown as StockCard;
    expect(validateStocks([broken])).toEqual([
      'XLE volatility must be between 0 and 1',
      'XLE evidence must contain 3 non-empty bullets',
      'XLE artworkKey must be a safe CSS artwork token',
    ]);
  });

  it('freezes both registries and indexes every card by ticker', () => {
    expect(Object.isFrozen(STOCKS)).toBe(true);
    expect(STOCKS.every((stock) => Object.isFrozen(stock))).toBe(true);
    expect(AI_PERSONALITIES.every((personality) => Object.isFrozen(personality))).toBe(true);
    expect([...STOCK_BY_TICKER.values()]).toEqual(STOCKS);
  });

  it('accepts numeric boundaries and reports remaining violations in deterministic order', () => {
    const first = STOCKS[0] as StockCard;
    const lowerBoundary = {
      ...first,
      ticker: 'ZERO',
      volatility: 0,
      momentumBias: -1,
      artworkKey: 'zero',
    } as StockCard;
    const upperBoundary = {
      ...first,
      ticker: 'ONE',
      volatility: 1,
      momentumBias: 1,
      artworkKey: 'one',
    } as StockCard;
    expect(validateStocks([lowerBoundary, upperBoundary])).toEqual([]);

    const malformed = {
      ...first,
      ticker: 'bad6',
      company: ' ',
      volatility: Number.NaN,
      momentumBias: 2,
      thesis: ' ',
      evidence: ['', 'two', 'three'],
      artworkKey: 'BAD/key',
      syntheticDemo: false,
    } as unknown as StockCard;
    expect(validateStocks([malformed, first, first])).toEqual([
      'bad6 ticker must contain 1-5 uppercase letters',
      'bad6 company must be non-empty',
      'bad6 volatility must be between 0 and 1',
      'bad6 momentumBias must be between -1 and 1',
      'bad6 thesis must be non-empty',
      'bad6 evidence must contain 3 non-empty bullets',
      'bad6 artworkKey must be a safe CSS artwork token',
      'bad6 syntheticDemo must be true',
      'XLE ticker must be unique',
    ]);
  });
});
