import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../../shared/rng/seededRng';
import { STOCKS } from '../content/stocks';
import {
  createDraftState,
  currentDraftLabel,
  draftReducer,
} from './draftReducer';
import {
  FANSTOCKS_RULES,
  PARTICIPANT_ORDER,
  TOTAL_MARKET_TICKS,
} from './rules';

const TICKERS = STOCKS.map((stock) => stock.ticker);

function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Expected a value at index ${index}`);
  }
  return value;
}

describe('FanStocks rules', () => {
  it('publishes the exact immutable version-one rules', () => {
    expect(FANSTOCKS_RULES).toEqual({
      rulesetVersion: 1,
      draftRounds: 3,
      candidatesPerRound: 3,
      cardsPerPortfolio: 3,
      startingValue: 50,
      ticksPerDay: 12,
      tradingDays: 5,
      baseTickMs: 5_000,
      incomingTradeTicks: [10, 25, 40],
    });
    expect(TOTAL_MARKET_TICKS).toBe(60);
    expect(PARTICIPANT_ORDER).toEqual([
      'player',
      'momentum',
      'contrarian',
      'balanced',
    ]);
    expect(Object.isFrozen(FANSTOCKS_RULES)).toBe(true);
    expect(Object.isFrozen(FANSTOCKS_RULES.incomingTradeTicks)).toBe(true);
    expect(Object.isFrozen(PARTICIPANT_ORDER)).toBe(true);
  });
});

describe('draftReducer', () => {
  it('deals three deterministic groups of three without duplicates', () => {
    const a = createDraftState(TICKERS, createSeededRng('draft-a'));
    const b = createDraftState(TICKERS, createSeededRng('draft-a'));

    expect(a.groups).toEqual(b.groups);
    expect(a.groups.map((group) => group.length)).toEqual([3, 3, 3]);
    expect(new Set(a.groups.flat()).size).toBe(9);
  });

  it('rejects fewer than nine unique tickers without consuming the random source', () => {
    const rng = createSeededRng('too-small');
    const expectedFirstValue = createSeededRng('too-small').next();

    expect(() =>
      createDraftState(
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'A'],
        rng,
      ),
    ).toThrow('FanStocks needs at least 9 unique tickers');
    expect(rng.next()).toBe(expectedFirstValue);
  });

  it('deep-freezes the created state and does not mutate the ticker input', () => {
    const tickers = Object.freeze([...TICKERS]);
    const before = [...tickers];
    const state = createDraftState(tickers, createSeededRng('immutable'));

    expect(tickers).toEqual(before);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.groups)).toBe(true);
    expect(state.groups.every((group) => Object.isFrozen(group))).toBe(true);
    expect(Object.isFrozen(state.picks)).toBe(true);
  });

  it('opens only current-round detail and closes it without changing other state', () => {
    const initial = createDraftState(TICKERS, createSeededRng('open-close'));
    const currentTicker = at(at(initial.groups, 0), 1);
    const unavailableTicker = at(at(initial.groups, 1), 0);

    expect(
      draftReducer(initial, { type: 'OPEN_DETAIL', ticker: unavailableTicker }),
    ).toBe(initial);

    const opened = draftReducer(initial, {
      type: 'OPEN_DETAIL',
      ticker: currentTicker,
    });
    expect(opened).not.toBe(initial);
    expect(opened.inspectedTicker).toBe(currentTicker);
    expect(opened.groups).toBe(initial.groups);
    expect(opened.picks).toBe(initial.picks);
    expect(Object.isFrozen(opened)).toBe(true);

    const closed = draftReducer(opened, { type: 'CLOSE_DETAIL' });
    expect(closed.inspectedTicker).toBeNull();
    expect(Object.isFrozen(closed)).toBe(true);
    expect(draftReducer(closed, { type: 'CLOSE_DETAIL' })).toBe(closed);
  });

  it('wraps detail navigation in both directions inside the current group', () => {
    const initial = createDraftState(TICKERS, createSeededRng('detail'));
    const currentGroup = at(initial.groups, 0);
    const opened = draftReducer(initial, {
      type: 'OPEN_DETAIL',
      ticker: at(currentGroup, 0),
    });

    expect(
      draftReducer(opened, { type: 'MOVE_DETAIL', direction: -1 })
        .inspectedTicker,
    ).toBe(currentGroup[2]);

    const lastOpened = draftReducer(initial, {
      type: 'OPEN_DETAIL',
      ticker: at(currentGroup, 2),
    });
    expect(
      draftReducer(lastOpened, { type: 'MOVE_DETAIL', direction: 1 })
        .inspectedTicker,
    ).toBe(currentGroup[0]);
    expect(
      draftReducer(initial, { type: 'MOVE_DETAIL', direction: 1 }),
    ).toBe(initial);
  });

  it('accepts exactly one current-group pick per round', () => {
    const initial = createDraftState(TICKERS, createSeededRng('legal-picks'));
    const firstPick = at(at(initial.groups, 0), 0);
    const opened = draftReducer(initial, {
      type: 'OPEN_DETAIL',
      ticker: firstPick,
    });
    const roundTwo = draftReducer(opened, { type: 'DRAFT', ticker: firstPick });

    expect(roundTwo).toMatchObject({
      roundIndex: 1,
      picks: [firstPick],
      inspectedTicker: null,
      status: 'selecting',
    });
    expect(Object.isFrozen(roundTwo)).toBe(true);
    expect(Object.isFrozen(roundTwo.picks)).toBe(true);
    expect(roundTwo.groups).toBe(initial.groups);

    const previousRoundTicker = at(at(initial.groups, 0), 1);
    const futureRoundTicker = at(at(initial.groups, 2), 0);
    expect(
      draftReducer(roundTwo, {
        type: 'DRAFT',
        ticker: previousRoundTicker,
      }),
    ).toBe(roundTwo);
    expect(
      draftReducer(roundTwo, { type: 'DRAFT', ticker: futureRoundTicker }),
    ).toBe(roundTwo);
    expect(
      draftReducer(roundTwo, { type: 'DRAFT', ticker: firstPick }),
    ).toBe(roundTwo);
    expect(
      draftReducer(roundTwo, { type: 'DRAFT', ticker: 'ZZZZ' }),
    ).toBe(roundTwo);
  });

  it('completes after three picks and preserves identity after completion', () => {
    let state = createDraftState(TICKERS, createSeededRng('complete'));

    for (let round = 0; round < 3; round += 1) {
      expect(currentDraftLabel(state)).toBe(
        `Round ${round + 1} of 3 · Pick 1 stock`,
      );
      state = draftReducer(state, {
        type: 'DRAFT',
        ticker: at(at(state.groups, round), 0),
      });
    }

    expect(state).toMatchObject({ status: 'complete', roundIndex: 3 });
    expect(state.picks).toHaveLength(3);
    expect(currentDraftLabel(state)).toBe('Draft complete');
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.picks)).toBe(true);

    expect(
      draftReducer(state, {
        type: 'OPEN_DETAIL',
        ticker: at(at(state.groups, 0), 0),
      }),
    ).toBe(state);
    expect(draftReducer(state, { type: 'MOVE_DETAIL', direction: 1 })).toBe(
      state,
    );
    expect(draftReducer(state, { type: 'CLOSE_DETAIL' })).toBe(state);
    expect(
      draftReducer(state, {
        type: 'DRAFT',
        ticker: at(at(state.groups, 0), 0),
      }),
    ).toBe(state);
  });

  it('does not mutate the prior state while reducing', () => {
    const initial = createDraftState(TICKERS, createSeededRng('no-mutation'));
    const before = structuredClone(initial);

    const next = draftReducer(initial, {
      type: 'DRAFT',
      ticker: at(at(initial.groups, 0), 0),
    });

    expect(initial).toEqual(before);
    expect(next).not.toBe(initial);
  });
});
