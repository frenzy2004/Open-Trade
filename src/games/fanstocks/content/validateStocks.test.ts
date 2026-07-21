import { describe, expect, it } from 'vitest';
import { AI_PERSONALITIES } from './personalities';
import { STOCK_BY_TICKER, STOCKS } from './stocks';
import type { StockCard } from './types';
import { validateStocks } from './validateStocks';

describe('FanStocks content', () => {
  it('contains twelve valid and unique synthetic-demo cards', () => {
    expect(STOCKS).toHaveLength(12);
    expect(STOCKS.map(({ ticker }) => ticker)).toEqual([
      'XLE', 'DKNG', 'HUBS', 'AMZN', 'ODFL', 'SBUX',
      'LOW', 'MPC', 'IWM', 'SMCI', 'CTRI', 'BMY',
    ]);
    expect(validateStocks(STOCKS)).toEqual([]);
    expect(new Set(STOCKS.map(({ ticker }) => ticker)).size).toBe(12);
    expect(STOCKS.every(({ syntheticDemo }) => syntheticDemo)).toBe(true);
  });

  it('assigns every card to one of the differentiated local art treatments', () => {
    expect(new Set(STOCKS.map(({ artworkKey }) => artworkKey))).toEqual(new Set([
      'consumer',
      'energy',
      'healthcare',
      'industrials',
      'small-cap',
      'software',
      'sportsbook',
    ]));
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

  it('deep-freezes stock content', () => {
    expect(Object.isFrozen(STOCKS)).toBe(true);
    expect(STOCKS.every((stock) => Object.isFrozen(stock))).toBe(true);
    expect(STOCKS.every((stock) => Object.isFrozen(stock.evidence))).toBe(true);
    expect(AI_PERSONALITIES.every((personality) => Object.isFrozen(personality))).toBe(true);

    const evidence = (STOCKS[0] as StockCard).evidence as unknown as string[];
    expect(() => { evidence[0] = 'mutated'; }).toThrow(TypeError);
  });

  it('exposes a frozen mutation-safe ticker index with ReadonlyMap behavior', () => {
    expect(Object.isFrozen(STOCK_BY_TICKER)).toBe(true);
    const mutationSurface = STOCK_BY_TICKER as ReadonlyMap<string, StockCard> & {
      set?: unknown;
      delete?: unknown;
      clear?: unknown;
    };
    expect(mutationSurface.set).toBeUndefined();
    expect(mutationSurface.delete).toBeUndefined();
    expect(mutationSurface.clear).toBeUndefined();

    const mapsSeenByForEach = new Set<ReadonlyMap<string, StockCard>>();
    const tickerOrder: string[] = [];
    const context = { expected: true };
    STOCK_BY_TICKER.forEach(function (this: typeof context, stock, ticker, map) {
      expect(this).toBe(context);
      expect(stock).toBe(STOCK_BY_TICKER.get(ticker));
      mapsSeenByForEach.add(map);
      tickerOrder.push(ticker);
    }, context);
    expect(mapsSeenByForEach).toEqual(new Set([STOCK_BY_TICKER]));
    expect(STOCK_BY_TICKER.size).toBe(STOCKS.length);
    expect(STOCK_BY_TICKER.has('XLE')).toBe(true);
    expect(STOCK_BY_TICKER.has('NOPE')).toBe(false);
    expect([...STOCK_BY_TICKER.keys()]).toEqual(tickerOrder);
    expect([...STOCK_BY_TICKER.values()]).toEqual(STOCKS);
    expect([...STOCK_BY_TICKER.entries()]).toEqual(
      STOCKS.map((stock) => [stock.ticker, stock]),
    );
    expect([...STOCK_BY_TICKER]).toEqual([...STOCK_BY_TICKER.entries()]);
    expect(STOCKS.every((stock) => STOCK_BY_TICKER.get(stock.ticker) === stock)).toBe(true);
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

  it('reports wrong runtime field types and invalid enums without throwing', () => {
    const malformed = {
      ticker: 'BAD',
      company: undefined,
      sector: 'finance',
      volatility: '0.5',
      momentumBias: null,
      correlationGroup: 'macro',
      thesis: undefined,
      evidence: null,
      artworkKey: undefined,
      syntheticDemo: false,
    } as unknown as StockCard;

    expect(validateStocks([malformed])).toEqual([
      'BAD company must be non-empty',
      'BAD sector must be one of consumer, energy, healthcare, industrials, small-cap, technology',
      'BAD volatility must be between 0 and 1',
      'BAD momentumBias must be between -1 and 1',
      'BAD correlationGroup must be one of consumer-cycle, energy-cycle, growth, defensive, small-cap',
      'BAD thesis must be non-empty',
      'BAD evidence must contain 3 non-empty bullets',
      'BAD artworkKey must be a safe CSS artwork token',
      'BAD syntheticDemo must be true',
    ]);
  });

  it('rejects non-string evidence items without throwing', () => {
    const malformed = {
      ...STOCKS[0],
      evidence: ['one', 2, 'three'],
    } as unknown as StockCard;

    expect(validateStocks([malformed])).toEqual([
      'XLE evidence must contain 3 non-empty bullets',
    ]);
  });
});
