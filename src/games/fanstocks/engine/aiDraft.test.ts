import { describe, expect, it } from 'vitest';
import { createSeededRng, type SeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import { STOCK_BY_TICKER, STOCKS } from '../content/stocks';
import type { StockCard } from '../content/types';
import { completeAiDrafts, scoreCardForPersonality } from './aiDraft';

const PLAYER_PICKS = ['XLE', 'ODFL', 'IWM'] as const;

function stock(ticker: string): StockCard {
  const card = STOCK_BY_TICKER.get(ticker);
  if (card === undefined) {
    throw new Error(`Missing stock fixture: ${ticker}`);
  }
  return card;
}

function personality(index: number) {
  const value = AI_PERSONALITIES[index];
  if (value === undefined) {
    throw new Error(`Missing personality fixture at index ${index}`);
  }
  return value;
}

function tieCard(ticker: string): StockCard {
  return {
    ticker,
    company: `${ticker} Company`,
    sector: 'technology',
    volatility: 0.5,
    momentumBias: 0,
    correlationGroup: 'growth',
    thesis: `${ticker} synthetic thesis`,
    evidence: ['First signal', 'Second signal', 'Third signal'],
    artworkKey: ticker.toLowerCase(),
    syntheticDemo: true,
  };
}

describe('completeAiDrafts', () => {
  it('fills four legal three-card portfolios without creating or losing cards', () => {
    const portfolios = completeAiDrafts(PLAYER_PICKS, STOCKS, createSeededRng('roster'));
    const all = Object.values(portfolios).flatMap(({ tickers }) => tickers);

    expect(Object.keys(portfolios)).toEqual(['player', 'momentum', 'contrarian', 'balanced']);
    expect(Object.values(portfolios).map(({ tickers }) => tickers.length)).toEqual([3, 3, 3, 3]);
    expect(new Set(all).size).toBe(12);
    expect(new Set(all)).toEqual(new Set(STOCKS.map(({ ticker }) => ticker)));
  });

  it('is repeatable for the same seed', () => {
    const run = () => completeAiDrafts(PLAYER_PICKS, STOCKS, createSeededRng('same'));

    expect(run()).toEqual(run());
  });

  it.each([
    { label: 'incomplete', picks: ['XLE', 'ODFL'] },
    { label: 'duplicate', picks: ['XLE', 'XLE', 'IWM'] },
    { label: 'unknown', picks: ['XLE', 'ODFL', 'NOPE'] },
  ])('rejects a $label player hand', ({ picks }) => {
    expect(() => completeAiDrafts(picks, STOCKS, createSeededRng('bad')))
      .toThrow('Player draft must contain 3 unique known tickers');
  });

  it('rejects malformed and duplicate card registries before drafting', () => {
    const malformed = STOCKS.map((card) => (
      card.ticker === 'SMCI' ? { ...card, volatility: Number.NaN } : card
    ));
    const duplicated = [...STOCKS.slice(0, -1), stock('XLE')];

    expect(() => completeAiDrafts(PLAYER_PICKS, malformed, createSeededRng('malformed')))
      .toThrow('Card registry must contain 12 valid unique cards');
    expect(() => completeAiDrafts(PLAYER_PICKS, duplicated, createSeededRng('duplicate')))
      .toThrow('Card registry must contain 12 valid unique cards');
  });

  it('does not mutate either input collection', () => {
    const playerPicks = [...PLAYER_PICKS];
    const cards = [...STOCKS];
    const originalPlayerPicks = [...playerPicks];
    const originalCards = [...cards];

    completeAiDrafts(playerPicks, cards, createSeededRng('immutable-inputs'));

    expect(playerPicks).toEqual(originalPlayerPicks);
    expect(cards).toEqual(originalCards);
  });

  it('deep-freezes the portfolio map, each portfolio, and every ticker list', () => {
    const portfolios = completeAiDrafts(PLAYER_PICKS, STOCKS, createSeededRng('frozen'));

    expect(Object.isFrozen(portfolios)).toBe(true);
    for (const portfolio of Object.values(portfolios)) {
      expect(Object.isFrozen(portfolio)).toBe(true);
      expect(Object.isFrozen(portfolio.tickers)).toBe(true);
    }
  });

  it('uses one seeded shuffle as the stable tie order throughout round-robin drafting', () => {
    const tickers = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH', 'III', 'JJJ', 'KKK', 'LLL'];
    const tiedCards = tickers.map(tieCard);
    const shuffleCalls: unknown[][] = [];
    const shuffle = <T>(values: readonly T[]): T[] => {
      shuffleCalls.push([...values]);
      return [...values].reverse();
    };
    const rng: SeededRng = {
      seed: 1,
      next: () => 0,
      int: () => 0,
      pick: <T>(values: readonly T[]) => {
        const value = values[0];
        if (value === undefined) throw new Error('Cannot pick from an empty fixture');
        return value;
      },
      shuffle,
      fork: () => rng,
    };

    const portfolios = completeAiDrafts(tickers.slice(0, 3), tiedCards, rng);

    expect(shuffleCalls).toEqual([tickers.slice(3)]);
    expect(portfolios).toEqual({
      player: { participantId: 'player', tickers: ['AAA', 'BBB', 'CCC'] },
      momentum: { participantId: 'momentum', tickers: ['LLL', 'III', 'FFF'] },
      contrarian: { participantId: 'contrarian', tickers: ['KKK', 'HHH', 'EEE'] },
      balanced: { participantId: 'balanced', tickers: ['JJJ', 'GGG', 'DDD'] },
    });
  });
});

describe('scoreCardForPersonality', () => {
  it('uses the exact Momentum, Contrarian, and Balanced scoring formulas', () => {
    const smci = stock('SMCI');

    expect(scoreCardForPersonality(personality(0), smci, [])).toBeCloseTo(1.758);
    expect(scoreCardForPersonality(personality(1), smci, [])).toBeCloseTo(-0.864);
    expect(scoreCardForPersonality(personality(2), smci, [])).toBeCloseTo(0.088);
  });

  it('makes Momentum prefer SMCI while Contrarian prefers BMY', () => {
    const smci = stock('SMCI');
    const bmy = stock('BMY');

    expect(scoreCardForPersonality(personality(0), smci, []))
      .toBeGreaterThan(scoreCardForPersonality(personality(0), bmy, []));
    expect(scoreCardForPersonality(personality(1), bmy, []))
      .toBeGreaterThan(scoreCardForPersonality(personality(1), smci, []));
  });

  it('penalizes Balanced for repeated groups and repeated sectors', () => {
    const balanced = personality(2);
    const sbux = stock('SBUX');
    const odfl = stock('ODFL');
    const amzn = stock('AMZN');
    const diversified = scoreCardForPersonality(balanced, sbux, []);

    expect(scoreCardForPersonality(balanced, sbux, [odfl])).toBeCloseTo(diversified - 1.2);
    expect(scoreCardForPersonality(balanced, sbux, [amzn])).toBeCloseTo(diversified - 0.45);
  });
});
