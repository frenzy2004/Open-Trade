import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiId } from '../content/types';
import { PARTICIPANT_ORDER, TOTAL_MARKET_TICKS } from '../engine/rules';
import {
  createFanStocksState,
  fanStocksReducer,
  type FanStocksState,
} from '../engine/fanStocksReducer';
import {
  createFanStocksSave,
  fanStocksSaveCodec,
  fanStocksStore,
  getFanStocksProgressBadge,
  resetFanStocksProgress,
} from './fanStocksSave';

const SAVED_AT = '2026-07-21T00:00:00.000Z';

function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error(`Missing test value ${index}`);
  return value;
}

function tutorialState(seed = 'save-test'): FanStocksState {
  return fanStocksReducer(createFanStocksState(seed), { type: 'START_LEAGUE' });
}

function draftState(seed = 'save-test'): FanStocksState {
  return fanStocksReducer(tutorialState(seed), { type: 'DISMISS_TUTORIAL' });
}

function draftOne(state = draftState()): FanStocksState {
  const ticker = state.draft.groups[0]?.[0];
  if (ticker === undefined) throw new Error('Missing first draft candidate');
  return fanStocksReducer(state, { type: 'DRAFT', ticker });
}

function aiDraftingState(seed = 'save-test'): FanStocksState {
  let state = draftState(seed);
  for (let round = 0; round < 3; round += 1) {
    const ticker = state.draft.groups[round]?.[0];
    if (ticker === undefined) throw new Error(`Missing draft round ${round}`);
    state = fanStocksReducer(state, { type: 'DRAFT', ticker });
  }
  return state;
}

function marketState(seed = 'save-test'): FanStocksState {
  return fanStocksReducer(aiDraftingState(seed), { type: 'AI_DRAFTS_READY' });
}

function advanceToTick(
  start: FanStocksState,
  target: number,
  decision: 'accepted' | 'passed' = 'passed',
): FanStocksState {
  let state = start;
  while (state.phase === 'market' && (state.priceHistory.at(-1)?.tick ?? -1) < target) {
    state = state.pendingTrade === null
      ? fanStocksReducer(state, { type: 'MARKET_TICK' })
      : fanStocksReducer(state, { type: 'DECIDE_INCOMING', decision });
  }
  return state;
}

function resultsState(seed = 'save-test'): FanStocksState {
  return advanceToTick(marketState(seed), TOTAL_MARKET_TICKS);
}

function outgoingState(status: 'accepted' | 'rejected'): FanStocksState {
  for (const opponentId of PARTICIPANT_ORDER.slice(1) as readonly AiId[]) {
    const state = marketState(`save-outgoing-${status}-${opponentId}`);
    if (state.portfolios === null) continue;
    for (const playerGives of state.portfolios.player.tickers) {
      for (const playerReceives of state.portfolios[opponentId].tickers) {
        const next = fanStocksReducer(state, {
          type: 'SUBMIT_OUTGOING',
          opponentId,
          playerGives,
          playerReceives,
        });
        if (next.tradeLog.at(-1)?.status === status) return next;
      }
    }
  }
  throw new Error(`Missing deterministic outgoing ${status} state`);
}

function encodedState(state: FanStocksState): Record<string, unknown> {
  return structuredClone(
    fanStocksSaveCodec.encode(createFanStocksSave(state, SAVED_AT)),
  ) as Record<string, unknown>;
}

function stateRecord(raw: Record<string, unknown>): Record<string, unknown> {
  return raw.state as Record<string, unknown>;
}

function expectCorrupt(raw: unknown): void {
  expect(() => fanStocksSaveCodec.decode(raw)).not.toThrow();
  expect(fanStocksSaveCodec.decode(raw)).toEqual({ ok: false, reason: 'corrupt' });
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

function saveToStorage(state: FanStocksState): void {
  expect(fanStocksStore.save(createFanStocksSave(state, SAVED_AT), {
    seed: state.seed,
    savedAt: SAVED_AT,
  })).toEqual({ ok: true });
}

describe('fanStocksSave', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips reducer-generated states in every phase deterministically', () => {
    const states = [
      createFanStocksState('phase-intro'),
      tutorialState('phase-tutorial'),
      draftOne(draftState('phase-draft')),
      aiDraftingState('phase-ai'),
      advanceToTick(marketState('phase-market'), 11),
      resultsState('phase-results'),
      fanStocksReducer(resultsState('phase-rematch'), { type: 'REMATCH' }),
    ];

    for (const state of states) {
      const save = createFanStocksSave(state, SAVED_AT);
      const first = fanStocksSaveCodec.encode(save);
      const second = fanStocksSaveCodec.encode(save);
      expect(first).toEqual(second);
      expect(fanStocksSaveCodec.decode(first)).toEqual({ ok: true, value: save });
    }
  });

  it('detaches and deeply freezes created, encoded, and decoded graphs', () => {
    const state = advanceToTick(marketState('detach'), 11);
    const stateBefore = structuredClone(state);
    const save = createFanStocksSave(state, SAVED_AT);
    expect(state).toEqual(stateBefore);
    expect(save.state).not.toBe(state);
    expectDeepFrozen(save);

    const encoded = fanStocksSaveCodec.encode(save) as Record<string, unknown>;
    expect(encoded).not.toBe(save);
    const raw = structuredClone(encoded) as Record<string, unknown>;
    const decoded = fanStocksSaveCodec.decode(raw);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expectDeepFrozen(decoded.value);
    const decodedSeed = decoded.value.state.seed;
    stateRecord(raw).seed = 'later-mutation';
    expect(decoded.value.state.seed).toBe(decodedSeed);
  });

  it('accepts reducer-generated accepted and rejected outgoing trade logs', () => {
    for (const status of ['accepted', 'rejected'] as const) {
      let state = outgoingState(status);
      state = fanStocksReducer(state, { type: 'SET_SPEED', speed: 4 });
      state = fanStocksReducer(state, { type: 'SET_PAUSED', paused: true });
      const save = createFanStocksSave(state, SAVED_AT);
      expect(fanStocksSaveCodec.decode(fanStocksSaveCodec.encode(save))).toEqual({
        ok: true,
        value: save,
      });
    }
  });

  it('classifies only well-formed non-v1 schema or rules versions as incompatible', () => {
    const base = encodedState(createFanStocksState('versions'));
    expect(fanStocksSaveCodec.decode({ ...base, schemaVersion: 2 })).toEqual({
      ok: false,
      reason: 'incompatible',
    });
    expect(fanStocksSaveCodec.decode({ ...base, rulesetVersion: 2 })).toEqual({
      ok: false,
      reason: 'incompatible',
    });

    for (const bad of [
      { ...base, schemaVersion: undefined },
      { ...base, schemaVersion: 1.5 },
      { ...base, rulesetVersion: '2' },
      { savedAt: SAVED_AT, state: base.state },
    ]) expectCorrupt(bad);
  });

  it('rejects non-canonical timestamps in decode and create', () => {
    const base = encodedState(createFanStocksState('timestamp'));
    for (const savedAt of [
      '2026-07-21',
      '2026-07-21T00:00:00Z',
      '2026-07-21T08:00:00.000+08:00',
      'not-a-date',
      '',
    ]) {
      expectCorrupt({ ...base, savedAt });
      expect(() => createFanStocksSave(createFanStocksState('timestamp'), savedAt)).toThrow(
        'canonical ISO timestamp',
      );
    }
  });

  it('is total for nulls, arrays, cycles, accessors, and hostile proxies', () => {
    expectCorrupt(null);
    expectCorrupt([]);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expectCorrupt(cycle);
    const accessor = encodedState(createFanStocksState('accessor'));
    Object.defineProperty(accessor, 'savedAt', {
      enumerable: true,
      get() { throw new Error('must not read accessor'); },
    });
    expectCorrupt(accessor);
    const hostile = new Proxy({}, {
      ownKeys() { throw new Error('hostile ownKeys'); },
    });
    expectCorrupt(hostile);
  });

  it.each([
    ['state versions', (raw: Record<string, unknown>) => { stateRecord(raw).schemaVersion = 2; }],
    ['seed', (raw: Record<string, unknown>) => { stateRecord(raw).seed = 'bad seed'; }],
    ['rematch index', (raw: Record<string, unknown>) => { stateRecord(raw).rematchIndex = -1; }],
    ['phase', (raw: Record<string, unknown>) => { stateRecord(raw).phase = 'unknown'; }],
    ['pause', (raw: Record<string, unknown>) => { stateRecord(raw).paused = 'false'; }],
    ['speed', (raw: Record<string, unknown>) => { stateRecord(raw).speed = 3; }],
  ])('rejects corrupt %s values', (_label, mutate) => {
    const raw = encodedState(marketState('state-scalars'));
    mutate(raw);
    expectCorrupt(raw);
  });

  it.each([
    ['groups', (draft: Record<string, unknown>) => {
      const groups = draft.groups as string[][];
      groups[0]?.reverse();
    }],
    ['round', (draft: Record<string, unknown>) => { draft.roundIndex = 2; }],
    ['picks', (draft: Record<string, unknown>) => { draft.picks = ['XLE']; }],
    ['inspection', (draft: Record<string, unknown>) => {
      draft.inspectedTicker = (draft.groups as string[][])[0]?.[0] ?? 'XLE';
    }],
    ['status', (draft: Record<string, unknown>) => { draft.status = 'complete'; }],
  ])('rejects noncanonical draft %s', (_label, mutate) => {
    const raw = encodedState(draftOne(draftState('draft-corrupt')));
    mutate(stateRecord(raw).draft as Record<string, unknown>);
    expectCorrupt(raw);
  });

  it('rejects impossible phase combinations', () => {
    const cases = [
      [createFanStocksState('phase-combo-a'), 'tutorialSeen', true],
      [tutorialState('phase-combo-b'), 'portfolios', {}],
      [draftState('phase-combo-c'), 'priceHistory', [{ tick: 0, multipliers: {} }]],
      [aiDraftingState('phase-combo-d'), 'phase', 'market'],
      [marketState('phase-combo-e'), 'result', {}],
      [resultsState('phase-combo-f'), 'paused', false],
    ] as const;
    for (const [state, key, value] of cases) {
      const raw = encodedState(state);
      stateRecord(raw)[key] = value;
      expectCorrupt(raw);
    }
  });

  it('rejects discontinuous, incomplete, unbounded, non-finite, and deterministic-price tampering', () => {
    const mutationCases = [
      (history: Array<Record<string, unknown>>) => { at(history, 1).tick = 2; },
      (history: Array<Record<string, unknown>>) => {
        delete (at(history, 1).multipliers as Record<string, unknown>).XLE;
      },
      (history: Array<Record<string, unknown>>) => {
        (at(history, 1).multipliers as Record<string, unknown>).XLE = 1.46;
      },
      (history: Array<Record<string, unknown>>) => {
        (at(history, 1).multipliers as Record<string, unknown>).XLE = Number.NaN;
      },
      (history: Array<Record<string, unknown>>) => {
        (at(history, 1).multipliers as Record<string, unknown>).XLE = 1;
      },
    ];
    for (const mutate of mutationCases) {
      const raw = encodedState(advanceToTick(marketState('price-corrupt'), 2));
      mutate(stateRecord(raw).priceHistory as Array<Record<string, unknown>>);
      expectCorrupt(raw);
    }
  });

  it('rejects noncanonical portfolios and pending incoming offers', () => {
    const market = advanceToTick(marketState('portfolio-corrupt'), 10);
    const portfolioRaw = encodedState(market);
    const portfolios = stateRecord(portfolioRaw).portfolios as Record<string, Record<string, unknown>>;
    const playerPortfolio = portfolios.player;
    const momentumPortfolio = portfolios.momentum;
    if (playerPortfolio === undefined || momentumPortfolio === undefined) {
      throw new Error('Missing encoded portfolios');
    }
    (playerPortfolio.tickers as string[])[0] = at(
      momentumPortfolio.tickers as string[],
      0,
    );
    expectCorrupt(portfolioRaw);

    const pendingRaw = encodedState(market);
    const pending = stateRecord(pendingRaw).pendingTrade as Record<string, unknown>;
    pending.direction = 'outgoing';
    expectCorrupt(pendingRaw);
  });

  it('replays trades and rejects bad directions, statuses, ticks, ids, ownership, or final holdings', () => {
    const traded = fanStocksReducer(
      advanceToTick(marketState('trade-corrupt'), 10),
      { type: 'DECIDE_INCOMING', decision: 'accepted' },
    );
    const mutationCases = [
      (event: Record<string, unknown>) => { event.direction = 'outgoing'; },
      (event: Record<string, unknown>) => { event.status = 'rejected'; },
      (event: Record<string, unknown>) => { event.createdAtTick = 11; },
      (event: Record<string, unknown>) => { event.id = 'tampered'; },
      (event: Record<string, unknown>) => { event.playerGives = 'BMY'; },
    ];
    for (const mutate of mutationCases) {
      const raw = encodedState(traded);
      mutate(at(stateRecord(raw).tradeLog as Array<Record<string, unknown>>, 0));
      expectCorrupt(raw);
    }
    const holdingsRaw = encodedState(traded);
    const portfolios = stateRecord(holdingsRaw).portfolios as Record<string, Record<string, unknown>>;
    const playerPortfolio = portfolios.player;
    const momentumPortfolio = portfolios.momentum;
    if (playerPortfolio === undefined || momentumPortfolio === undefined) {
      throw new Error('Missing encoded portfolios');
    }
    const player = playerPortfolio.tickers as string[];
    const momentum = momentumPortfolio.tickers as string[];
    const playerTicker = at(player, 0);
    player[0] = at(momentum, 0);
    momentum[0] = playerTicker;
    expectCorrupt(holdingsRaw);
  });

  it('rejects malformed or inconsistent result summaries', () => {
    const mutationCases = [
      (result: Record<string, unknown>) => { result.winnerIds = ['balanced']; },
      (result: Record<string, unknown>) => { result.isTie = !result.isTie; },
      (result: Record<string, unknown>) => {
        at(result.rows as Array<Record<string, unknown>>, 0).value = 999;
      },
      (result: Record<string, unknown>) => { result.acceptedTrades = []; },
    ];
    let complete = advanceToTick(marketState('result-corrupt'), 10, 'accepted');
    complete = fanStocksReducer(complete, {
      type: 'DECIDE_INCOMING',
      decision: 'accepted',
    });
    complete = advanceToTick(complete, TOTAL_MARKET_TICKS);
    for (const mutate of mutationCases) {
      const raw = encodedState(complete);
      mutate(stateRecord(raw).result as Record<string, unknown>);
      expectCorrupt(raw);
    }
  });

  it('loads ready, corrupt, incompatible, and storage-unavailable outcomes', () => {
    saveToStorage(draftState('storage-ready'));
    expect(fanStocksStore.load()).toMatchObject({ status: 'ready' });

    localStorage.setItem(fanStocksSaveCodec.key, '{broken');
    expect(fanStocksStore.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
    });

    const future = encodedState(createFanStocksState('storage-future'));
    future.rulesetVersion = 2;
    localStorage.setItem(fanStocksSaveCodec.key, JSON.stringify({
      version: 1,
      savedAt: SAVED_AT,
      seed: null,
      data: future,
    }));
    expect(fanStocksStore.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'incompatible',
    });

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    try {
      expect(fanStocksStore.load()).toMatchObject({
        status: 'recovery-required',
        reason: 'storage-unavailable',
      });
    } finally {
      getItem.mockRestore();
    }
  });

  it('reports accurate ready, draft, AI, market, results, and recovery badges', () => {
    expect(getFanStocksProgressBadge()).toBeNull();
    const cases = [
      [createFanStocksState('badge-ready'), 'League ready'],
      [draftOne(draftState('badge-draft')), 'Draft round 2 of 3'],
      [aiDraftingState('badge-ai'), 'AI portfolios drafting'],
      [advanceToTick(marketState('badge-market'), 12), 'Tuesday market'],
      [resultsState('badge-results'), 'League complete'],
    ] as const;
    for (const [state, value] of cases) {
      saveToStorage(state);
      expect(getFanStocksProgressBadge()).toEqual({
        label: 'FanStocks',
        value,
        tone: 'positive',
      });
    }
    localStorage.setItem(fanStocksSaveCodec.key, '{broken');
    expect(getFanStocksProgressBadge()).toEqual({
      label: 'FanStocks',
      value: 'Progress needs reset',
      tone: 'warning',
    });
  });

  it('clears only the FanStocks save key', () => {
    localStorage.setItem('unrelated', 'keep');
    saveToStorage(createFanStocksState('clear'));
    resetFanStocksProgress();
    expect(fanStocksStore.load()).toEqual({ status: 'empty' });
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
});
