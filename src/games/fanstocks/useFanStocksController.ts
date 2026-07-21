import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createGuestSeed,
  formatChallenge,
  parseChallenge,
} from '../../shared/routing/challenge';
import { useSettings } from '../../shared/settings/SettingsContext';
import { useToasts } from '../../shared/ui/ToastContext';
import type { AiId, Ticker } from './content/types';
import {
  createFanStocksState,
  fanStocksReducer,
  type FanStocksAction,
  type FanStocksState,
  type MarketSpeed,
} from './engine/fanStocksReducer';
import { FANSTOCKS_RULES } from './engine/rules';
import type { TradeEvent } from './engine/trades';
import {
  createFanStocksSave,
  fanStocksStore,
} from './persistence/fanStocksSave';

export type FanStocksSaveProblem =
  | {
      readonly source: 'challenge';
      readonly reason: 'malformed' | 'incompatible';
      readonly detail: string;
    }
  | {
      readonly source: 'load';
      readonly reason: 'corrupt' | 'incompatible' | 'storage-unavailable';
      readonly detail: string;
    }
  | {
      readonly source: 'save' | 'reset';
      readonly reason: 'encode-failed' | 'storage-unavailable';
      readonly detail: string;
    };

export interface FanStocksController {
  readonly state: FanStocksState;
  readonly saveProblem: FanStocksSaveProblem | null;
  readonly reducedMotion: boolean;
  readonly lastAcceptedTrade: TradeEvent | null;
  readonly startLeague: () => void;
  readonly dismissTutorial: () => void;
  readonly openDetail: (ticker: Ticker) => void;
  readonly moveDetail: (direction: -1 | 1) => void;
  readonly closeDetail: () => void;
  readonly draft: (ticker: Ticker) => void;
  readonly setPaused: (paused: boolean) => void;
  readonly setSpeed: (speed: MarketSpeed) => void;
  readonly decideIncoming: (decision: 'accepted' | 'passed') => void;
  readonly submitOutgoing: (
    opponentId: AiId,
    playerGives: Ticker,
    playerReceives: Ticker,
  ) => void;
  readonly rematch: () => void;
  readonly newLeague: () => void;
  readonly resetBrokenSave: () => void;
}

interface InitialControllerState {
  readonly state: FanStocksState;
  readonly saveProblem: FanStocksSaveProblem | null;
  readonly recoveryBlocked: boolean;
}

type ControllerAction = FanStocksAction | {
  readonly type: 'CONTROLLER_REINITIALIZE';
  readonly state: FanStocksState;
};

interface ControllerReducerState {
  readonly state: FanStocksState;
  readonly reinitializationGeneration: number;
}

function controllerReducer(
  current: ControllerReducerState,
  action: ControllerAction,
): ControllerReducerState {
  if (action.type === 'CONTROLLER_REINITIALIZE') {
    return {
      state: action.state,
      reinitializationGeneration: current.reinitializationGeneration + 1,
    };
  }
  const state = fanStocksReducer(current.state, action);
  return state === current.state ? current : { ...current, state };
}

function challengeIntent(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.has('seed') || params.has('rules');
}

function loadProblem(
  reason: 'corrupt' | 'incompatible' | 'storage-unavailable',
  detail: string,
): FanStocksSaveProblem {
  return { source: 'load', reason, detail };
}

function loadInitialState(search: string): InitialControllerState {
  const parsed = parseChallenge(search);
  const explicitChallenge = challengeIntent(search);

  if (explicitChallenge && parsed === null) {
    return {
      state: createFanStocksState(createGuestSeed()),
      saveProblem: {
        source: 'challenge',
        reason: 'malformed',
        detail: 'The FanStocks challenge URL is malformed',
      },
      recoveryBlocked: true,
    };
  }

  if (parsed !== null && parsed.rulesetVersion !== FANSTOCKS_RULES.rulesetVersion) {
    return {
      state: createFanStocksState(createGuestSeed()),
      saveProblem: {
        source: 'challenge',
        reason: 'incompatible',
        detail: 'The FanStocks challenge uses an incompatible ruleset',
      },
      recoveryBlocked: true,
    };
  }

  const loaded = fanStocksStore.load();
  if (parsed !== null) {
    if (loaded.status === 'recovery-required') {
      return {
        state: createFanStocksState(parsed.seed),
        saveProblem: loadProblem(loaded.reason, loaded.detail),
        recoveryBlocked: true,
      };
    }
    if (loaded.status === 'ready' && loaded.value.state.seed === parsed.seed) {
      return {
        state: loaded.value.state,
        saveProblem: null,
        recoveryBlocked: false,
      };
    }
    return {
      state: createFanStocksState(parsed.seed),
      saveProblem: null,
      recoveryBlocked: false,
    };
  }

  if (loaded.status === 'ready') {
    return {
      state: loaded.value.state,
      saveProblem: null,
      recoveryBlocked: false,
    };
  }
  if (loaded.status === 'recovery-required') {
    return {
      state: createFanStocksState(createGuestSeed()),
      saveProblem: loadProblem(loaded.reason, loaded.detail),
      recoveryBlocked: true,
    };
  }
  return {
    state: createFanStocksState(createGuestSeed()),
    saveProblem: null,
    recoveryBlocked: false,
  };
}

function latestAcceptedTrade(
  tradeLog: readonly TradeEvent[],
): TradeEvent | null {
  for (let index = tradeLog.length - 1; index >= 0; index -= 1) {
    const event = tradeLog[index];
    if (event?.status === 'accepted') return event;
  }
  return null;
}

function eventTitle(event: TradeEvent): string {
  if (event.status === 'accepted') return 'Trade accepted';
  if (event.status === 'rejected') return 'Trade rejected';
  return 'Trade passed';
}

export function useFanStocksController(): FanStocksController {
  const location = useLocation();
  const navigate = useNavigate();
  const [initial] = useState(() => loadInitialState(location.search));
  const [controllerState, dispatch] = useReducer(controllerReducer, {
    state: initial.state,
    reinitializationGeneration: 0,
  });
  const { state, reinitializationGeneration } = controllerState;
  const [saveProblem, setSaveProblem] = useState(initial.saveProblem);
  const { settings } = useSettings();
  const { addToast } = useToasts();
  const persistenceBlocked = useRef(initial.recoveryBlocked);
  const urlBlocked = useRef(initial.recoveryBlocked);
  const visibilityPaused = useRef(false);
  const currentState = useRef(state);
  const previousTradeLog = useRef(state.tradeLog);
  const observedSearch = useRef(location.search);
  const pendingCanonicalSearch = useRef<string | null>(null);

  useEffect(() => {
    currentState.current = state;
  }, [state]);

  useEffect(() => {
    if (persistenceBlocked.current) return;
    let savedAt: string;
    try {
      savedAt = new Date().toISOString();
      const saved = fanStocksStore.save(
        createFanStocksSave(state, savedAt),
        { seed: state.seed, savedAt },
      );
      if (saved.ok) return;
      persistenceBlocked.current = true;
      // The external store reports failures synchronously; reflecting that
      // recoverable outcome is the purpose of this synchronization effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaveProblem({
        source: 'save',
        reason: saved.reason,
        detail: saved.reason === 'storage-unavailable'
          ? 'FanStocks progress could not be written to browser storage'
          : 'FanStocks progress could not be encoded',
      });
    } catch {
      persistenceBlocked.current = true;
      setSaveProblem({
        source: 'save',
        reason: 'encode-failed',
        detail: 'FanStocks progress could not be encoded',
      });
    }
  }, [state]);

  useEffect(() => {
    const searchChanged = location.search !== observedSearch.current;
    if (searchChanged) {
      observedSearch.current = location.search;
      if (location.search === pendingCanonicalSearch.current) {
        pendingCanonicalSearch.current = null;
        return;
      }

      pendingCanonicalSearch.current = null;
      const parsed = parseChallenge(location.search);
      if (
        parsed !== null
        && parsed.rulesetVersion === FANSTOCKS_RULES.rulesetVersion
        && parsed.seed === currentState.current.seed
      ) {
        if (urlBlocked.current) return;
        const canonical = formatChallenge(parsed);
        if (location.search !== canonical) {
          pendingCanonicalSearch.current = canonical;
          navigate(
            { pathname: location.pathname, search: canonical },
            { replace: true },
          );
        }
        return;
      }

      const next = loadInitialState(location.search);
      persistenceBlocked.current = next.recoveryBlocked;
      urlBlocked.current = next.recoveryBlocked;
      visibilityPaused.current = false;
      currentState.current = next.state;
      previousTradeLog.current = next.state.tradeLog;
      // A newly observed route is an external input. Apply its complete
      // initialization result before any state-driven persistence can run.
      setSaveProblem(next.saveProblem);
      dispatch({ type: 'CONTROLLER_REINITIALIZE', state: next.state });
      return;
    }

    if (urlBlocked.current) return;
    const expected = formatChallenge({
      seed: state.seed,
      rulesetVersion: FANSTOCKS_RULES.rulesetVersion,
    });
    if (location.search !== expected) {
      pendingCanonicalSearch.current = expected;
      navigate(
        { pathname: location.pathname, search: expected },
        { replace: true },
      );
    }
  }, [
    location.pathname,
    location.search,
    navigate,
    reinitializationGeneration,
    state.seed,
  ]);

  useEffect(() => {
    if (state.phase !== 'ai-drafting') return;
    const timeout = window.setTimeout(
      () => dispatch({ type: 'AI_DRAFTS_READY' }),
      settings.reducedMotion ? 0 : 650,
    );
    return () => window.clearTimeout(timeout);
  }, [reinitializationGeneration, settings.reducedMotion, state.phase]);

  useEffect(() => {
    if (
      state.phase !== 'market'
      || state.paused
      || state.pendingTrade !== null
      || document.visibilityState === 'hidden'
    ) return;
    const timeout = window.setTimeout(
      () => dispatch({ type: 'MARKET_TICK' }),
      FANSTOCKS_RULES.baseTickMs / state.speed,
    );
    return () => window.clearTimeout(timeout);
  }, [
    state.paused,
    state.pendingTrade,
    state.phase,
    state.priceHistory.length,
    state.speed,
    reinitializationGeneration,
  ]);

  useEffect(() => {
    const onVisibility = () => {
      const latest = currentState.current;
      if (
        document.visibilityState === 'hidden'
        && latest.phase === 'market'
        && !latest.paused
      ) {
        visibilityPaused.current = true;
        dispatch({ type: 'SET_PAUSED', paused: true });
        return;
      }
      if (
        document.visibilityState === 'visible'
        && visibilityPaused.current
      ) {
        visibilityPaused.current = false;
        dispatch({ type: 'SET_PAUSED', paused: false });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (state.phase !== 'market') {
      visibilityPaused.current = false;
      return;
    }
    if (document.visibilityState === 'hidden' && !state.paused) {
      visibilityPaused.current = true;
      dispatch({ type: 'SET_PAUSED', paused: true });
    }
  }, [state.paused, state.phase]);

  useEffect(() => {
    const previous = previousTradeLog.current;
    const appended = state.tradeLog.length > previous.length
      && previous.every((event, index) => state.tradeLog[index] === event);
    previousTradeLog.current = state.tradeLog;
    if (!appended) return;
    for (const event of state.tradeLog.slice(previous.length)) {
      addToast(
        `${eventTitle(event)}: ${event.playerGives} for ${event.playerReceives}`,
        event.status === 'accepted' ? 'success' : 'info',
      );
    }
  }, [addToast, state.tradeLog]);

  const startLeague = useCallback(() => {
    dispatch({ type: 'START_LEAGUE' });
  }, []);
  const dismissTutorial = useCallback(() => {
    dispatch({ type: 'DISMISS_TUTORIAL' });
  }, []);
  const openDetail = useCallback((ticker: Ticker) => {
    dispatch({ type: 'OPEN_DETAIL', ticker });
  }, []);
  const moveDetail = useCallback((direction: -1 | 1) => {
    dispatch({ type: 'MOVE_DETAIL', direction });
  }, []);
  const closeDetail = useCallback(() => {
    dispatch({ type: 'CLOSE_DETAIL' });
  }, []);
  const draft = useCallback((ticker: Ticker) => {
    dispatch({ type: 'DRAFT', ticker });
  }, []);
  const setPaused = useCallback((paused: boolean) => {
    visibilityPaused.current = false;
    dispatch({ type: 'SET_PAUSED', paused });
  }, []);
  const setSpeed = useCallback((speed: MarketSpeed) => {
    dispatch({ type: 'SET_SPEED', speed });
  }, []);
  const decideIncoming = useCallback((decision: 'accepted' | 'passed') => {
    dispatch({ type: 'DECIDE_INCOMING', decision });
  }, []);
  const submitOutgoing = useCallback((
    opponentId: AiId,
    playerGives: Ticker,
    playerReceives: Ticker,
  ) => {
    dispatch({
      type: 'SUBMIT_OUTGOING',
      opponentId,
      playerGives,
      playerReceives,
    });
  }, []);
  const rematch = useCallback(() => {
    visibilityPaused.current = false;
    dispatch({ type: 'REMATCH' });
  }, []);
  const beginFreshLeague = useCallback(() => {
    const cleared = fanStocksStore.clear();
    if (!cleared.ok) {
      persistenceBlocked.current = true;
      urlBlocked.current = true;
      setSaveProblem({
        source: 'reset',
        reason: cleared.reason,
        detail: 'FanStocks progress could not be cleared from browser storage',
      });
      return;
    }
    persistenceBlocked.current = false;
    urlBlocked.current = false;
    visibilityPaused.current = false;
    setSaveProblem(null);
    dispatch({ type: 'NEW_LEAGUE', seed: createGuestSeed() });
  }, []);
  const newLeague = useCallback(() => {
    beginFreshLeague();
  }, [beginFreshLeague]);
  const resetBrokenSave = useCallback(() => {
    beginFreshLeague();
  }, [beginFreshLeague]);

  return {
    state,
    saveProblem,
    reducedMotion: settings.reducedMotion,
    lastAcceptedTrade: latestAcceptedTrade(state.tradeLog),
    startLeague,
    dismissTutorial,
    openDetail,
    moveDetail,
    closeDetail,
    draft,
    setPaused,
    setSpeed,
    decideIncoming,
    submitOutgoing,
    rematch,
    newLeague,
    resetBrokenSave,
  };
}
