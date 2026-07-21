import { describe, expect, it, vi } from 'vitest';
import { AI_PERSONALITIES } from '../content/personalities';
import type { AiId, Ticker } from '../content/types';
import { PARTICIPANT_ORDER, TOTAL_MARKET_TICKS } from './rules';
import {
  createFanStocksState,
  fanStocksReducer,
  type FanStocksAction,
  type FanStocksState,
} from './fanStocksReducer';

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

function enterDraft(seed = 'flow'): FanStocksState {
  const initial = createFanStocksState(seed);
  const tutorial = fanStocksReducer(initial, { type: 'START_LEAGUE' });
  return fanStocksReducer(tutorial, { type: 'DISMISS_TUTORIAL' });
}

function finishPlayerDraft(seed = 'flow'): FanStocksState {
  let state = enterDraft(seed);
  for (let round = 0; round < 3; round += 1) {
    const group = state.draft.groups[round];
    const ticker = group?.[0];
    if (ticker === undefined) throw new Error(`Missing draft group ${round}`);
    state = fanStocksReducer(state, { type: 'DRAFT', ticker });
  }
  return state;
}

function enterMarket(seed = 'flow'): FanStocksState {
  return fanStocksReducer(finishPlayerDraft(seed), { type: 'AI_DRAFTS_READY' });
}

function advanceToTick(
  state: FanStocksState,
  targetTick: number,
  incomingDecision: 'accepted' | 'passed' = 'passed',
): FanStocksState {
  let current = state;
  while (current.phase === 'market') {
    const tick = current.priceHistory.at(-1)?.tick;
    if (tick === undefined || tick >= targetTick) return current;
    current = current.pendingTrade === null
      ? fanStocksReducer(current, { type: 'MARKET_TICK' })
      : fanStocksReducer(current, {
          type: 'DECIDE_INCOMING',
          decision: incomingDecision,
        });
  }
  return current;
}

function allHeldTickers(state: FanStocksState): Ticker[] {
  const portfolios = state.portfolios;
  if (portfolios === null) throw new Error('Expected completed portfolios');
  return PARTICIPANT_ORDER.flatMap(
    (participantId) => [...portfolios[participantId].tickers],
  );
}

function findOutgoingDecision(
  wanted: 'accepted' | 'rejected',
): Readonly<{ before: FanStocksState; after: FanStocksState }> {
  for (const opponentId of PARTICIPANT_ORDER.slice(1) as readonly AiId[]) {
    const state = enterMarket(`outgoing-${wanted}-${opponentId}`);
    if (state.portfolios === null) continue;
    for (const playerGives of state.portfolios.player.tickers) {
      for (const playerReceives of state.portfolios[opponentId].tickers) {
        const after = fanStocksReducer(state, {
          type: 'SUBMIT_OUTGOING',
          opponentId,
          playerGives,
          playerReceives,
        });
        if (after.tradeLog.at(-1)?.status === wanted) {
          return Object.freeze({ before: state, after });
        }
      }
    }
  }
  throw new Error(`No deterministic ${wanted} outgoing decision found`);
}

describe('fanStocksReducer', () => {
  it('validates that seeds are nonempty strings', () => {
    expect(() => createFanStocksState('')).toThrow('FanStocks seed must be non-empty');
    expect(() => createFanStocksState('   ')).toThrow('FanStocks seed must be non-empty');
    expect(() => createFanStocksState(7 as unknown as string)).toThrow(
      'FanStocks seed must be non-empty',
    );
  });

  it('moves intro to tutorial and dismisses it into the draft', () => {
    const initial = createFanStocksState('phase-intro');
    expect(initial).toMatchObject({
      phase: 'intro',
      tutorialSeen: false,
      schemaVersion: 1,
      rulesetVersion: 1,
    });

    const tutorial = fanStocksReducer(initial, { type: 'START_LEAGUE' });
    expect(tutorial).toMatchObject({ phase: 'tutorial', tutorialSeen: false });
    const draft = fanStocksReducer(tutorial, { type: 'DISMISS_TUTORIAL' });
    expect(draft).toMatchObject({ phase: 'draft', tutorialSeen: true });
  });

  it('delegates detail actions and advances exactly three draft rounds', () => {
    let state = enterDraft('draft-boundaries');
    const firstGroup = state.draft.groups[0];
    const first = firstGroup?.[0];
    const second = firstGroup?.[1];
    if (first === undefined || second === undefined) throw new Error('Missing cards');

    state = fanStocksReducer(state, { type: 'OPEN_DETAIL', ticker: first });
    expect(state.draft.inspectedTicker).toBe(first);
    state = fanStocksReducer(state, { type: 'MOVE_DETAIL', direction: 1 });
    expect(state.draft.inspectedTicker).toBe(second);
    state = fanStocksReducer(state, { type: 'CLOSE_DETAIL' });
    expect(state.draft.inspectedTicker).toBeNull();

    for (let round = 0; round < 3; round += 1) {
      const ticker = state.draft.groups[round]?.[0];
      if (ticker === undefined) throw new Error(`Missing group ${round}`);
      state = fanStocksReducer(state, { type: 'DRAFT', ticker });
      expect(state.draft.roundIndex).toBe(round + 1);
      expect(state.phase).toBe(round === 2 ? 'ai-drafting' : 'draft');
    }
  });

  it('completes seeded AI portfolios and opens market at tick zero', () => {
    const state = enterMarket('ai-market');
    expect(state.phase).toBe('market');
    expect(state.priceHistory).toHaveLength(1);
    expect(state.priceHistory[0]?.tick).toBe(0);
    expect(state.portfolios).not.toBeNull();
    expect(
      PARTICIPANT_ORDER.every(
        (participantId) => state.portfolios?.[participantId].tickers.length === 3,
      ),
    ).toBe(true);
    const holdings = allHeldTickers(state);
    expect(new Set(holdings)).toHaveProperty('size', 12);
  });

  it('supports 1x, 2x, 4x and preserves identity for unchanged or invalid speed', () => {
    let state = enterMarket('speed');
    expect(state.speed).toBe(1);
    expect(fanStocksReducer(state, { type: 'SET_SPEED', speed: 1 })).toBe(state);
    for (const speed of [2, 4, 1] as const) {
      state = fanStocksReducer(state, { type: 'SET_SPEED', speed });
      expect(state.speed).toBe(speed);
    }
    const invalid = { type: 'SET_SPEED', speed: 3 } as unknown as FanStocksAction;
    expect(fanStocksReducer(state, invalid)).toBe(state);
  });

  it('pauses market ticks and treats setting the same pause value as a no-op', () => {
    const market = enterMarket('pause');
    expect(fanStocksReducer(market, { type: 'SET_PAUSED', paused: false })).toBe(market);
    const paused = fanStocksReducer(market, { type: 'SET_PAUSED', paused: true });
    expect(paused.paused).toBe(true);
    expect(fanStocksReducer(paused, { type: 'SET_PAUSED', paused: true })).toBe(paused);
    expect(fanStocksReducer(paused, { type: 'MARKET_TICK' })).toBe(paused);
  });

  it('creates incoming offers for Momentum, Contrarian, and Balanced only at ticks 10, 25, and 40', () => {
    let state = enterMarket('scheduled-offers');
    const schedule = [
      [10, 'momentum'],
      [25, 'contrarian'],
      [40, 'balanced'],
    ] as const;

    for (const [tick, opponentId] of schedule) {
      state = advanceToTick(state, tick);
      expect(state.priceHistory.at(-1)?.tick).toBe(tick);
      expect(state.pendingTrade).toMatchObject({
        direction: 'incoming',
        opponentId,
        createdAtTick: tick,
      });
      const blocked = fanStocksReducer(state, { type: 'MARKET_TICK' });
      expect(blocked).toBe(state);
      state = fanStocksReducer(state, {
        type: 'DECIDE_INCOMING',
        decision: 'passed',
      });
      expect(state.pendingTrade).toBeNull();
    }

    state = advanceToTick(state, 59);
    const offerTicks = state.tradeLog
      .filter(({ direction }) => direction === 'incoming')
      .map(({ createdAtTick }) => createdAtTick);
    expect(offerTicks).toEqual([10, 25, 40]);
  });

  it('keeps one frame per completed tick and never advances through a pending offer', () => {
    let state = advanceToTick(enterMarket('history'), 10);
    expect(state.priceHistory.map(({ tick }) => tick)).toEqual(
      Array.from({ length: 11 }, (_, tick) => tick),
    );
    const blocked = fanStocksReducer(state, { type: 'MARKET_TICK' });
    expect(blocked).toBe(state);
    expect(blocked.priceHistory).toHaveLength(11);
    state = fanStocksReducer(state, { type: 'DECIDE_INCOMING', decision: 'passed' });
    state = fanStocksReducer(state, { type: 'MARKET_TICK' });
    expect(state.priceHistory.at(-1)?.tick).toBe(11);
    expect(state.priceHistory).toHaveLength(12);
  });

  it('passes incoming trades without changing holdings and logs the decision', () => {
    const offered = advanceToTick(enterMarket('incoming-pass'), 10);
    const portfolios = offered.portfolios;
    const state = fanStocksReducer(offered, {
      type: 'DECIDE_INCOMING',
      decision: 'passed',
    });
    expect(state.portfolios).toBe(portfolios);
    expect(state.pendingTrade).toBeNull();
    expect(state.tradeLog.at(-1)).toMatchObject({
      direction: 'incoming',
      status: 'passed',
      createdAtTick: 10,
    });
  });

  it('accepts incoming trades as a one-for-one ownership swap', () => {
    const offered = advanceToTick(enterMarket('incoming-accept'), 10);
    const offer = offered.pendingTrade;
    if (offer === null || offered.portfolios === null) throw new Error('Missing offer');
    const beforeHoldings = [...allHeldTickers(offered)].sort();
    const opponentBefore = offered.portfolios[offer.opponentId].tickers;

    const state = fanStocksReducer(offered, {
      type: 'DECIDE_INCOMING',
      decision: 'accepted',
    });
    expect(state.portfolios?.player.tickers).toContain(offer.playerReceives);
    expect(state.portfolios?.player.tickers).not.toContain(offer.playerGives);
    expect(state.portfolios?.[offer.opponentId].tickers).toContain(offer.playerGives);
    expect(state.portfolios?.[offer.opponentId].tickers).not.toContain(
      offer.playerReceives,
    );
    expect(state.portfolios?.[offer.opponentId].tickers).not.toBe(opponentBefore);
    expect([...allHeldTickers(state)].sort()).toEqual(beforeHoldings);
    expect(state.tradeLog.at(-1)?.status).toBe('accepted');
  });

  it('records synchronous personality-based accepted and rejected outgoing decisions', () => {
    const accepted = findOutgoingDecision('accepted');
    const rejected = findOutgoingDecision('rejected');

    expect(accepted.after.tradeLog.at(-1)).toMatchObject({
      direction: 'outgoing',
      status: 'accepted',
    });
    expect(rejected.after.tradeLog.at(-1)).toMatchObject({
      direction: 'outgoing',
      status: 'rejected',
    });
    expect(accepted.after.portfolios).not.toBe(accepted.before.portfolios);
    expect(rejected.after.portfolios).toBe(rejected.before.portfolios);
    expect([...allHeldTickers(accepted.after)].sort()).toEqual(
      [...allHeldTickers(accepted.before)].sort(),
    );
    expect([...allHeldTickers(rejected.after)].sort()).toEqual(
      [...allHeldTickers(rejected.before)].sort(),
    );
  });

  it('replays the same seed and actions exactly and diverges for another seed', () => {
    const run = (seed: string) => {
      let state = enterMarket(seed);
      state = advanceToTick(state, 26, 'passed');
      return state;
    };

    const first = run('deterministic');
    const replay = run('deterministic');
    const different = run('different');
    expect(replay).toEqual(first);
    expect(different.draft.groups).not.toEqual(first.draft.groups);
    expect(different.priceHistory).not.toEqual(first.priceHistory);
  });

  it('closes exactly on tick 60 with ranked results and accepted trade recap', () => {
    let state = advanceToTick(enterMarket('close-result'), 10);
    state = fanStocksReducer(state, {
      type: 'DECIDE_INCOMING',
      decision: 'accepted',
    });
    state = advanceToTick(state, TOTAL_MARKET_TICKS - 1);
    expect(state.phase).toBe('market');
    expect(state.priceHistory.at(-1)?.tick).toBe(59);

    state = fanStocksReducer(state, { type: 'MARKET_TICK' });
    expect(state).toMatchObject({ phase: 'results', paused: true });
    expect(state.priceHistory.at(-1)?.tick).toBe(TOTAL_MARKET_TICKS);
    expect(state.priceHistory).toHaveLength(TOTAL_MARKET_TICKS + 1);
    expect(state.result?.rows).toHaveLength(4);
    expect(state.result?.acceptedTrades).toHaveLength(1);
    expect(state.result?.acceptedTrades[0]?.direction).toBe('incoming');
    expect(fanStocksReducer(state, { type: 'MARKET_TICK' })).toBe(state);
  });

  it('derives a clean rematch seed, skips tutorial, and increments rematch index', () => {
    const result = advanceToTick(enterMarket('rematch'), TOTAL_MARKET_TICKS);
    expect(result.phase).toBe('results');
    const rematch = fanStocksReducer(result, { type: 'REMATCH' });
    expect(rematch).toMatchObject({
      seed: 'rematch:rematch:1',
      rematchIndex: 1,
      phase: 'draft',
      tutorialSeen: true,
      portfolios: null,
      paused: false,
      speed: 1,
      pendingTrade: null,
      result: null,
    });
    expect(rematch.tradeLog).toEqual([]);
    expect(rematch.priceHistory).toEqual([]);
    expect(rematch.draft.picks).toEqual([]);
    expect(rematch.draft.groups).not.toEqual(result.draft.groups);
  });

  it('starts a clean new league from any phase and validates its seed', () => {
    const market = advanceToTick(enterMarket('old-league'), 10);
    const next = fanStocksReducer(market, { type: 'NEW_LEAGUE', seed: 'new-league' });
    expect(next).toEqual(createFanStocksState('new-league'));
    expect(next).toMatchObject({
      phase: 'intro',
      tutorialSeen: false,
      rematchIndex: 0,
      portfolios: null,
      pendingTrade: null,
      result: null,
    });
    expect(() => fanStocksReducer(market, { type: 'NEW_LEAGUE', seed: ' ' })).toThrow(
      'FanStocks seed must be non-empty',
    );
  });

  it('returns the identical state for invalid, out-of-phase, and no-op actions', () => {
    const intro = createFanStocksState('invalid-actions');
    const unknownAction = ({
      type: 'NOT_A_FANSTOCKS_ACTION',
    } as unknown) as FanStocksAction;
    expect(fanStocksReducer(intro, unknownAction)).toBe(intro);
    const introActions: readonly FanStocksAction[] = [
      { type: 'DISMISS_TUTORIAL' },
      { type: 'AI_DRAFTS_READY' },
      { type: 'MARKET_TICK' },
      { type: 'SET_PAUSED', paused: true },
      { type: 'SET_SPEED', speed: 2 },
      { type: 'DECIDE_INCOMING', decision: 'accepted' },
      { type: 'REMATCH' },
    ];
    for (const action of introActions) {
      expect(fanStocksReducer(intro, action)).toBe(intro);
    }

    const draft = enterDraft('invalid-draft');
    expect(fanStocksReducer(draft, { type: 'CLOSE_DETAIL' })).toBe(draft);
    expect(fanStocksReducer(draft, { type: 'DRAFT', ticker: 'NOT-A-CARD' })).toBe(
      draft,
    );

    const market = enterMarket('invalid-market');
    if (market.portfolios === null) throw new Error('Missing portfolios');
    const balancedTicker = market.portfolios.balanced.tickers[0];
    if (balancedTicker === undefined) throw new Error('Missing Balanced holding');
    const invalidOutgoing = {
      type: 'SUBMIT_OUTGOING',
      opponentId: 'balanced',
      playerGives: 'NOT-OWNED',
      playerReceives: balancedTicker,
    } satisfies FanStocksAction;
    expect(fanStocksReducer(market, invalidOutgoing)).toBe(market);
  });

  it('freezes every state graph and does not mutate an input state', () => {
    const before = enterMarket('freeze');
    const snapshot = structuredClone(before);
    const after = fanStocksReducer(before, { type: 'MARKET_TICK' });
    expect(before).toEqual(snapshot);
    expect(after).not.toBe(before);
    expectDeepFrozen(before);
    expectDeepFrozen(after);
    expect(() => {
      (after as unknown as { phase: string }).phase = 'intro';
    }).toThrow();
    expect(() => {
      (after.priceHistory as unknown as unknown[]).push('mutation');
    }).toThrow();
  });

  it('has no wall-clock or ambient random dependency', () => {
    const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now must not be called');
    });
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called');
    });
    try {
      let state = enterMarket('no-clock');
      state = advanceToTick(state, 11, 'accepted');
      expect(state.priceHistory.at(-1)?.tick).toBe(11);
    } finally {
      dateNow.mockRestore();
      mathRandom.mockRestore();
    }
  });

  it('uses the declared AI order for the three scheduled opponents', () => {
    expect(AI_PERSONALITIES.map(({ id }) => id)).toEqual([
      'momentum',
      'contrarian',
      'balanced',
    ]);
  });
});
