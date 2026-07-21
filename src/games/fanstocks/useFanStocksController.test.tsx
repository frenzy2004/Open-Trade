import { act, renderHook, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import {
  MemoryRouter,
  useLocation,
  useNavigate,
  useNavigationType,
  type NavigateFunction,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStore } from '../../shared/persistence/gameStore';
import { createSeededRng } from '../../shared/rng/seededRng';
import { SettingsProvider } from '../../shared/settings/SettingsContext';
import type { AppSettings } from '../../shared/settings/settingsStore';
import { ToastProvider } from '../../shared/ui/ToastContext';
import { AI_PERSONALITIES } from './content/personalities';
import { STOCKS } from './content/stocks';
import type { AiId, Ticker } from './content/types';
import {
  createFanStocksState,
  fanStocksReducer,
  type FanStocksState,
} from './engine/fanStocksReducer';
import {
  createOutgoingTrade,
  decideOutgoingTrade,
} from './engine/trades';
import {
  createFanStocksSave,
  fanStocksSaveCodec,
  fanStocksStore,
} from './persistence/fanStocksSave';
import {
  useFanStocksController,
  type FanStocksController,
} from './useFanStocksController';

const SAVED_AT = '2026-07-21T06:00:00.000Z';
const ORIGINAL_VISIBILITY = Object.getOwnPropertyDescriptor(
  document,
  'visibilityState',
);

const settingsStore: GameStore<AppSettings> = {
  load: () => ({ status: 'empty' }),
  save: () => ({ ok: true }),
  clear: () => ({ ok: true }),
};

interface RouteRecord {
  readonly action: string;
  readonly value: string;
}

interface RouteControl {
  readonly publish: (navigate: NavigateFunction | null) => void;
  readonly read: () => NavigateFunction | null;
}

function createRouteControl(): RouteControl {
  let current: NavigateFunction | null = null;
  return {
    publish(navigate) {
      current = navigate;
    },
    read() {
      return current;
    },
  };
}

function RouteObserver({
  control,
  records,
}: {
  readonly control: RouteControl | undefined;
  readonly records: RouteRecord[];
}) {
  const location = useLocation();
  const action = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    if (control === undefined) return;
    control.publish(navigate);
    return () => {
      control.publish(null);
    };
  }, [control, navigate]);
  useEffect(() => {
    records.push({
      action,
      value: `${location.pathname}${location.search}`,
    });
  }, [action, location.pathname, location.search, records]);
  return null;
}

function makeWrapper(
  initialEntry = '/fanstocks?seed=hook-seed&rules=1',
  options: {
    readonly reducedMotion?: boolean;
    readonly routeControl?: RouteControl;
    readonly routeRecords?: RouteRecord[];
  } = {},
) {
  const initialSettings = {
    muted: false,
    reducedMotion: options.reducedMotion ?? false,
  };
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        <SettingsProvider
          store={settingsStore}
          initialSettings={initialSettings}
        >
          <ToastProvider>
            {options.routeRecords === undefined ? null : (
              <RouteObserver
                control={options.routeControl}
                records={options.routeRecords}
              />
            )}
            {children}
          </ToastProvider>
        </SettingsProvider>
      </MemoryRouter>
    );
  };
}

function navigateExternally(control: RouteControl, to: string): void {
  const navigate = control.read();
  if (navigate === null) throw new Error('Route control is not mounted');
  act(() => navigate(to));
}

function latestTimerIndex(
  calls: readonly (readonly unknown[])[],
  delay: number,
): number {
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    if (calls[index]?.[1] === delay) return index;
  }
  return -1;
}

function saveState(state: FanStocksState): void {
  expect(fanStocksStore.save(createFanStocksSave(state, SAVED_AT), {
    seed: state.seed,
    savedAt: SAVED_AT,
  })).toEqual({ ok: true });
}

function firstCandidate(state: FanStocksState, round: number): Ticker {
  const ticker = state.draft.groups[round]?.[0];
  if (ticker === undefined) throw new Error(`Missing draft round ${round}`);
  return ticker;
}

function reachAiDrafting(controller: FanStocksController): void {
  act(() => controller.startLeague());
  act(() => controller.dismissTutorial());
  for (let round = 0; round < 3; round += 1) {
    act(() => controller.draft(firstCandidate(controller.state, round)));
  }
}

function reachMarket(result: { current: FanStocksController }): void {
  reachAiDrafting(result.current);
  act(() => vi.advanceTimersByTime(650));
  expect(result.current.state.phase).toBe('market');
}

function createMarketState(seed: string): FanStocksState {
  let state = createFanStocksState(seed);
  state = fanStocksReducer(state, { type: 'START_LEAGUE' });
  state = fanStocksReducer(state, { type: 'DISMISS_TUTORIAL' });
  for (let round = 0; round < 3; round += 1) {
    state = fanStocksReducer(state, {
      type: 'DRAFT',
      ticker: firstCandidate(state, round),
    });
  }
  return fanStocksReducer(state, { type: 'AI_DRAFTS_READY' });
}

function tickState(
  initial: FanStocksState,
  count: number,
  incomingDecision: 'accepted' | 'passed' = 'passed',
): FanStocksState {
  let state = initial;
  for (let index = 0; index < count; index += 1) {
    state = fanStocksReducer(state, { type: 'MARKET_TICK' });
    if (state.pendingTrade !== null) {
      state = fanStocksReducer(state, {
        type: 'DECIDE_INCOMING',
        decision: incomingDecision,
      });
    }
  }
  return state;
}

function setVisibility(value: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
}

describe('useFanStocksController initialization and persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SAVED_AT));
    setVisibility('visible');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (ORIGINAL_VISIBILITY === undefined) {
      Reflect.deleteProperty(document, 'visibilityState');
    } else {
      Object.defineProperty(document, 'visibilityState', ORIGINAL_VISIBILITY);
    }
  });

  it('uses a compatible explicit challenge instead of a different ready save', () => {
    saveState(fanStocksReducer(createFanStocksState('saved-seed'), {
      type: 'START_LEAGUE',
    }));
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.state.seed).toBe('hook-seed');
    expect(result.current.state.phase).toBe('intro');
    expect(result.current.saveProblem).toBeNull();
  });

  it.each([
    ['/fanstocks?seed=bad%20seed&rules=1', 'malformed'],
    ['/fanstocks?seed=explicit-seed&rules=2', 'incompatible'],
  ])('surfaces explicit invalid challenge intent at %s', (entry, reason) => {
    saveState(fanStocksReducer(createFanStocksState('saved-seed'), {
      type: 'START_LEAGUE',
    }));
    const records: RouteRecord[] = [];
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(entry, { routeRecords: records }),
    });
    expect(result.current.state.seed).not.toBe('saved-seed');
    expect(result.current.saveProblem).toMatchObject({
      source: 'challenge',
      reason,
    });
    expect(records.at(-1)?.value).toBe(entry);
  });

  it('loads a ready save when no explicit challenge is present', () => {
    saveState(fanStocksReducer(createFanStocksState('saved-seed'), {
      type: 'START_LEAGUE',
    }));
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks'),
    });
    expect(result.current.state).toMatchObject({
      seed: 'saved-seed',
      phase: 'tutorial',
    });
    expect(result.current.saveProblem).toBeNull();
  });

  it('creates and canonicalizes a fresh guest league for empty storage', () => {
    const records: RouteRecord[] = [];
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks', { routeRecords: records }),
    });
    expect(result.current.state.phase).toBe('intro');
    expect(result.current.state.seed).toMatch(/^[a-z0-9_-]{1,64}$/i);
    expect(result.current.saveProblem).toBeNull();
    expect(records.at(-1)).toEqual({
      action: 'REPLACE',
      value: `/fanstocks?seed=${result.current.state.seed}&rules=1`,
    });
  });

  it.each([
    ['corrupt', '{broken'],
    ['incompatible', JSON.stringify({
      version: 2,
      savedAt: SAVED_AT,
      seed: 'old-seed',
      data: {},
    })],
  ])('starts fresh but protects %s stored data', (reason, raw) => {
    localStorage.setItem(fanStocksSaveCodec.key, raw);
    const records: RouteRecord[] = [];
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks', { routeRecords: records }),
    });
    expect(result.current.state.phase).toBe('intro');
    expect(result.current.saveProblem).toMatchObject({ source: 'load', reason });
    expect(localStorage.getItem(fanStocksSaveCodec.key)).toBe(raw);
    expect(records.at(-1)?.value).toBe('/fanstocks');
    act(() => result.current.startLeague());
    expect(localStorage.getItem(fanStocksSaveCodec.key)).toBe(raw);
  });

  it('surfaces storage-unavailable loads without throwing or rewriting the URL', () => {
    const records: RouteRecord[] = [];
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks', { routeRecords: records }),
    });
    expect(result.current.state.phase).toBe('intro');
    expect(result.current.saveProblem).toMatchObject({
      source: 'load',
      reason: 'storage-unavailable',
    });
    expect(records.at(-1)?.value).toBe('/fanstocks');
  });

  it('does not overwrite a broken save even when a valid challenge wins state priority', () => {
    localStorage.setItem(fanStocksSaveCodec.key, '{broken');
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.state.seed).toBe('hook-seed');
    expect(result.current.saveProblem).toMatchObject({
      source: 'load',
      reason: 'corrupt',
    });
    expect(localStorage.getItem(fanStocksSaveCodec.key)).toBe('{broken');
  });

  it('autosaves canonical ISO state and envelope metadata after transitions', () => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.startLeague());
    const loaded = fanStocksStore.load();
    expect(loaded).toMatchObject({
      status: 'ready',
      seed: 'hook-seed',
      savedAt: SAVED_AT,
      value: {
        savedAt: SAVED_AT,
        state: { phase: 'tutorial', seed: 'hook-seed' },
      },
    });
    if (loaded.status === 'ready') {
      expect(new Date(loaded.value.savedAt).toISOString()).toBe(loaded.value.savedAt);
    }
  });

  it('captures storage save failures and recovers on a successful new league', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota');
    });
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.saveProblem).toMatchObject({
      source: 'save',
      reason: 'storage-unavailable',
    });
    setItem.mockRestore();
    act(() => result.current.newLeague());
    expect(result.current.saveProblem).toBeNull();
    expect(fanStocksStore.load()).toMatchObject({ status: 'ready' });
  });

  it('captures timestamp/encode failures instead of throwing', () => {
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
      throw new RangeError('clock unavailable');
    });
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.saveProblem).toMatchObject({
      source: 'save',
      reason: 'encode-failed',
    });
  });

  it('clears a recovery problem only after reset succeeds', () => {
    localStorage.setItem(fanStocksSaveCodec.key, '{broken');
    const records: RouteRecord[] = [];
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks', { routeRecords: records }),
    });
    act(() => result.current.resetBrokenSave());
    expect(result.current.saveProblem).toBeNull();
    expect(fanStocksStore.load()).toMatchObject({
      status: 'ready',
      value: { state: { phase: 'intro' } },
    });
    expect(records.at(-1)?.value).toBe(
      `/fanstocks?seed=${result.current.state.seed}&rules=1`,
    );
  });

  it('keeps reset failure recoverable and preserves the evidence', () => {
    localStorage.setItem(fanStocksSaveCodec.key, '{broken');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });
    const records: RouteRecord[] = [];
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks', { routeRecords: records }),
    });
    const seedBefore = result.current.state.seed;
    act(() => result.current.resetBrokenSave());
    expect(result.current.state.seed).toBe(seedBefore);
    expect(result.current.saveProblem).toMatchObject({
      source: 'reset',
      reason: 'storage-unavailable',
    });
    expect(localStorage.getItem(fanStocksSaveCodec.key)).toBe('{broken');
    expect(records.at(-1)?.value).toBe('/fanstocks');
  });
});

describe('useFanStocksController routing and public API', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SAVED_AT));
    setVisibility('visible');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (ORIGINAL_VISIBILITY === undefined) {
      Reflect.deleteProperty(document, 'visibilityState');
    } else {
      Object.defineProperty(document, 'visibilityState', ORIGINAL_VISIBILITY);
    }
  });

  it('uses replace navigation without churn and synchronizes rematch seeds', () => {
    saveState(tickState(createMarketState('result-seed'), 60));
    const records: RouteRecord[] = [];
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks', { routeRecords: records }),
    });
    expect(records).toEqual([
      { action: 'POP', value: '/fanstocks' },
      { action: 'REPLACE', value: '/fanstocks?seed=result-seed&rules=1' },
    ]);
    act(() => result.current.rematch());
    expect(result.current.state.seed).toMatch(/^rematch-1-/);
    expect(records.at(-1)).toEqual({
      action: 'REPLACE',
      value: `/fanstocks?seed=${result.current.state.seed}&rules=1`,
    });
    const countAfterRematch = records.length;
    act(() => result.current.openDetail(firstCandidate(result.current.state, 0)));
    expect(records).toHaveLength(countAfterRematch);
  });

  it('reinitializes an active mounted league for an external valid challenge', () => {
    const control = createRouteControl();
    const records: RouteRecord[] = [];
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks?seed=seed-one&rules=1', {
        routeControl: control,
        routeRecords: records,
      }),
    });
    reachMarket(result);
    act(() => result.current.setSpeed(4));
    for (let tick = 0; tick < 10; tick += 1) {
      act(() => vi.advanceTimersByTime(1_250));
    }
    act(() => result.current.decideIncoming('accepted'));
    const marketTimerIndex = latestTimerIndex(setTimeoutSpy.mock.calls, 1_250);
    expect(marketTimerIndex).toBeGreaterThanOrEqual(0);
    const oldMarketTimer = setTimeoutSpy.mock.results[marketTimerIndex]?.value;

    navigateExternally(control, '/fanstocks?seed=seed-two&rules=1');

    expect(result.current.state).toMatchObject({
      seed: 'seed-two',
      phase: 'intro',
      rematchIndex: 0,
      paused: false,
      speed: 1,
      pendingTrade: null,
      tradeLog: [],
      priceHistory: [],
    });
    expect(result.current.saveProblem).toBeNull();
    expect(records.filter(({ value }) => value.includes('seed-two'))).toEqual([
      { action: 'PUSH', value: '/fanstocks?seed=seed-two&rules=1' },
    ]);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(oldMarketTimer);
    expect(fanStocksStore.load()).toMatchObject({
      status: 'ready',
      seed: 'seed-two',
      value: { state: { seed: 'seed-two', phase: 'intro' } },
    });
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.state.phase).toBe('intro');
  });

  it.each([
    ['/fanstocks?seed=bad%20seed&rules=1', 'malformed'],
    ['/fanstocks?seed=seed-two&rules=2', 'incompatible'],
  ])('preserves external invalid challenge evidence at %s', (url, reason) => {
    const control = createRouteControl();
    const records: RouteRecord[] = [];
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks?seed=seed-one&rules=1', {
        routeControl: control,
        routeRecords: records,
      }),
    });
    const storedBefore = localStorage.getItem(fanStocksSaveCodec.key);

    navigateExternally(control, url);

    expect(result.current.saveProblem).toMatchObject({
      source: 'challenge',
      reason,
    });
    expect(records.at(-1)?.value).toBe(url);
    expect(localStorage.getItem(fanStocksSaveCodec.key)).toBe(storedBefore);
    act(() => result.current.startLeague());
    expect(localStorage.getItem(fanStocksSaveCodec.key)).toBe(storedBefore);
    expect(records.at(-1)?.value).toBe(url);
  });

  it.each([
    ['corrupt', '{broken'],
    ['incompatible', JSON.stringify({
      version: 2,
      savedAt: SAVED_AT,
      seed: 'old-seed',
      data: {},
    })],
  ])('retains external valid challenge consent when the save is %s', (reason, raw) => {
    const control = createRouteControl();
    const records: RouteRecord[] = [];
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks?seed=seed-one&rules=1', {
        routeControl: control,
        routeRecords: records,
      }),
    });
    localStorage.setItem(fanStocksSaveCodec.key, raw);

    navigateExternally(control, '/fanstocks?seed=seed-two&rules=1');

    expect(result.current.state).toMatchObject({ seed: 'seed-two', phase: 'intro' });
    expect(result.current.saveProblem).toMatchObject({ source: 'load', reason });
    expect(localStorage.getItem(fanStocksSaveCodec.key)).toBe(raw);
    expect(records.at(-1)?.value).toBe('/fanstocks?seed=seed-two&rules=1');
    act(() => result.current.startLeague());
    expect(localStorage.getItem(fanStocksSaveCodec.key)).toBe(raw);
  });

  it('does not reset progress for a same-seed order-only external URL change', () => {
    const control = createRouteControl();
    const records: RouteRecord[] = [];
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks?seed=seed-one&rules=1', {
        routeControl: control,
        routeRecords: records,
      }),
    });
    act(() => result.current.startLeague());
    const writesBefore = setItem.mock.calls.length;

    navigateExternally(control, '/fanstocks?rules=1&seed=seed-one');

    expect(result.current.state).toMatchObject({
      seed: 'seed-one',
      phase: 'tutorial',
    });
    expect(setItem).toHaveBeenCalledTimes(writesBefore);
    expect(records.slice(-2)).toEqual([
      { action: 'PUSH', value: '/fanstocks?rules=1&seed=seed-one' },
      { action: 'REPLACE', value: '/fanstocks?seed=seed-one&rules=1' },
    ]);
  });

  it('acknowledges internal rematch and new-league replaces without reinitializing', () => {
    saveState(tickState(createMarketState('result-seed'), 60));
    const records: RouteRecord[] = [];
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks', { routeRecords: records }),
    });
    act(() => result.current.rematch());
    const rematchSeed = result.current.state.seed;
    expect(result.current.state.phase).toBe('draft');
    expect(records.filter(({ value }) => value.includes(rematchSeed))).toEqual([
      {
        action: 'REPLACE',
        value: `/fanstocks?seed=${rematchSeed}&rules=1`,
      },
    ]);

    act(() => result.current.newLeague());
    const newSeed = result.current.state.seed;
    expect(result.current.state.phase).toBe('intro');
    expect(records.filter(({ value }) => value.includes(newSeed))).toEqual([
      {
        action: 'REPLACE',
        value: `/fanstocks?seed=${newSeed}&rules=1`,
      },
    ]);
  });

  it('clears old AI timing and visibility ownership during external reinitialization', () => {
    const control = createRouteControl();
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const records: RouteRecord[] = [];
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks?seed=seed-one&rules=1', {
        routeControl: control,
        routeRecords: records,
      }),
    });
    reachAiDrafting(result.current);
    const aiTimerIndex = latestTimerIndex(setTimeoutSpy.mock.calls, 650);
    expect(aiTimerIndex).toBeGreaterThanOrEqual(0);
    const aiTimer = setTimeoutSpy.mock.results[aiTimerIndex]?.value;

    navigateExternally(control, '/fanstocks?seed=seed-two&rules=1');

    expect(clearTimeoutSpy).toHaveBeenCalledWith(aiTimer);
    setVisibility('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(650));
    expect(result.current.state).toMatchObject({
      seed: 'seed-two',
      phase: 'intro',
      paused: false,
    });

    reachMarket(result);
    setVisibility('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.state.paused).toBe(true);
    navigateExternally(control, '/fanstocks');
    expect(result.current.state).toMatchObject({ phase: 'market', paused: true });

    setVisibility('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.state.paused).toBe(true);
  });

  it('keeps every action callback stable across renders', () => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    const callbacks = {
      startLeague: result.current.startLeague,
      dismissTutorial: result.current.dismissTutorial,
      openDetail: result.current.openDetail,
      moveDetail: result.current.moveDetail,
      closeDetail: result.current.closeDetail,
      draft: result.current.draft,
      setPaused: result.current.setPaused,
      setSpeed: result.current.setSpeed,
      decideIncoming: result.current.decideIncoming,
      submitOutgoing: result.current.submitOutgoing,
      rematch: result.current.rematch,
      newLeague: result.current.newLeague,
      resetBrokenSave: result.current.resetBrokenSave,
    };
    act(() => result.current.startLeague());
    for (const [name, callback] of Object.entries(callbacks)) {
      expect(result.current[name as keyof typeof callbacks]).toBe(callback);
    }
  });

  it('starts a distinct fresh league through newLeague', () => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    const previousSeed = result.current.state.seed;
    act(() => result.current.startLeague());
    act(() => result.current.newLeague());
    expect(result.current.state).toMatchObject({ phase: 'intro', rematchIndex: 0 });
    expect(result.current.state.seed).not.toBe(previousSeed);
  });
});

describe('useFanStocksController timing and visibility', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SAVED_AT));
    setVisibility('visible');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (ORIGINAL_VISIBILITY === undefined) {
      Reflect.deleteProperty(document, 'visibilityState');
    } else {
      Object.defineProperty(document, 'visibilityState', ORIGINAL_VISIBILITY);
    }
  });

  it('completes AI drafting at exactly 650ms', () => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    reachAiDrafting(result.current);
    act(() => vi.advanceTimersByTime(649));
    expect(result.current.state.phase).toBe('ai-drafting');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.state.phase).toBe('market');
  });

  it('completes AI drafting at 0ms with reduced motion', () => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks?seed=hook-seed&rules=1', {
        reducedMotion: true,
      }),
    });
    reachAiDrafting(result.current);
    expect(result.current.state.phase).toBe('ai-drafting');
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.state.phase).toBe('market');
  });

  it.each([
    [1, 5_000],
    [2, 2_500],
    [4, 1_250],
  ] as const)('ticks once at the exact %sx boundary', (speed, delay) => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    reachMarket(result);
    act(() => result.current.setSpeed(speed));
    act(() => vi.advanceTimersByTime(delay - 1));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(1);
  });

  it('restarts the full one-shot delay when speed changes', () => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    reachMarket(result);
    act(() => vi.advanceTimersByTime(4_000));
    act(() => result.current.setSpeed(4));
    act(() => vi.advanceTimersByTime(1_249));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(1);
  });

  it('has no market timer while paused or while a trade is pending', () => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    reachMarket(result);
    act(() => result.current.setPaused(true));
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(0);
    act(() => result.current.setPaused(false));
    for (let tick = 0; tick < 10; tick += 1) {
      act(() => vi.advanceTimersByTime(5_000));
    }
    expect(result.current.state.pendingTrade).not.toBeNull();
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(10);
  });

  it('pauses when hidden after mount and resumes with a fresh delay and no catch-up', () => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    reachMarket(result);
    act(() => vi.advanceTimersByTime(2_000));
    setVisibility('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.state.paused).toBe(true);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(0);
    setVisibility('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.state.paused).toBe(false);
    act(() => vi.advanceTimersByTime(4_999));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(1);
  });

  it('does not get stuck when the market is entered while already hidden', () => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    reachAiDrafting(result.current);
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(650));
    expect(result.current.state).toMatchObject({ phase: 'market', paused: true });
    setVisibility('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.state.paused).toBe(false);
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(1);
  });

  it('never overrides a manual pause after a visibility cycle', () => {
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    reachMarket(result);
    setVisibility('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => result.current.setPaused(true));
    setVisibility('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.state.paused).toBe(true);
  });

  it('cleans up AI/market timers and the visibility listener on unmount', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { result, unmount } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper(),
    });
    reachAiDrafting(result.current);
    const aiCall = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 650);
    expect(aiCall).toBeGreaterThanOrEqual(0);
    const aiTimer = setTimeoutSpy.mock.results[aiCall]?.value;
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(aiTimer);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});

describe('useFanStocksController trade notifications', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SAVED_AT));
    setVisibility('visible');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (ORIGINAL_VISIBILITY === undefined) {
      Reflect.deleteProperty(document, 'visibilityState');
    } else {
      Object.defineProperty(document, 'visibilityState', ORIGINAL_VISIBILITY);
    }
  });

  it('does not replay loaded trade history but toasts newly appended events', () => {
    const historical = tickState(createMarketState('toast-seed'), 10, 'accepted');
    saveState(historical);
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks'),
    });
    expect(screen.queryByText(/Trade accepted:/)).not.toBeInTheDocument();
    for (let tick = 10; tick < 25; tick += 1) {
      act(() => vi.advanceTimersByTime(5_000));
    }
    act(() => result.current.decideIncoming('passed'));
    expect(screen.getByText(/Trade passed:/)).toBeInTheDocument();
  });

  it('toasts both newly appended events when duplicate IDs are appended', () => {
    const state = createMarketState('duplicate-toast');
    const portfolios = state.portfolios;
    expect(portfolios).not.toBeNull();
    const frame = state.priceHistory[0];
    if (frame === undefined) throw new Error('Missing initial price frame');
    let rejected: {
      opponentId: AiId;
      playerGives: Ticker;
      playerReceives: Ticker;
    } | null = null;
    if (portfolios !== null) {
      for (const personality of AI_PERSONALITIES) {
        for (const playerGives of portfolios.player.tickers) {
          for (const playerReceives of portfolios[personality.id].tickers) {
            const offer = createOutgoingTrade(
              portfolios,
              personality.id,
              playerGives,
              playerReceives,
              frame.tick,
            );
            if (decideOutgoingTrade(
              offer,
              personality,
              STOCKS,
              createSeededRng(state.seed).fork(`trade:${offer.id}`),
            ) === 'rejected') {
              rejected = { opponentId: personality.id, playerGives, playerReceives };
            }
          }
        }
      }
    }
    expect(rejected).not.toBeNull();
    if (rejected === null) throw new Error('Expected a rejected outgoing trade');
    saveState(state);
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks'),
    });
    act(() => result.current.submitOutgoing(
      rejected.opponentId,
      rejected.playerGives,
      rejected.playerReceives,
    ));
    act(() => result.current.submitOutgoing(
      rejected.opponentId,
      rejected.playerGives,
      rejected.playerReceives,
    ));
    expect(screen.getAllByText(/Trade rejected:/)).toHaveLength(2);
  });

  it('keeps the most recent accepted trade after a later pass', () => {
    const acceptedState = tickState(createMarketState('accepted-seed'), 10, 'accepted');
    const accepted = acceptedState.tradeLog.at(-1);
    saveState(acceptedState);
    const { result } = renderHook(() => useFanStocksController(), {
      wrapper: makeWrapper('/fanstocks'),
    });
    expect(result.current.lastAcceptedTrade).toEqual(accepted);
    for (let tick = 10; tick < 25; tick += 1) {
      act(() => vi.advanceTimersByTime(5_000));
    }
    act(() => result.current.decideIncoming('passed'));
    expect(result.current.state.tradeLog.at(-1)?.status).toBe('passed');
    expect(result.current.lastAcceptedTrade).toEqual(accepted);
  });
});
