import type { SeededRng } from '../../../shared/rng/seededRng';
import type { Ticker } from '../content/types';
import { FANSTOCKS_RULES } from './rules';

export interface DraftState {
  readonly groups: readonly (readonly Ticker[])[];
  readonly roundIndex: number;
  readonly picks: readonly Ticker[];
  readonly inspectedTicker: Ticker | null;
  readonly status: 'selecting' | 'complete';
}

export type DraftAction =
  | { type: 'OPEN_DETAIL'; ticker: Ticker }
  | { type: 'MOVE_DETAIL'; direction: -1 | 1 }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'DRAFT'; ticker: Ticker };

export function createDraftState(
  tickers: readonly Ticker[],
  rng: SeededRng,
): DraftState {
  const needed =
    FANSTOCKS_RULES.draftRounds * FANSTOCKS_RULES.candidatesPerRound;
  const uniqueTickers = [...new Set(tickers)];

  if (uniqueTickers.length < needed) {
    throw new Error(`FanStocks needs at least ${needed} unique tickers`);
  }

  const dealt = rng.shuffle(uniqueTickers).slice(0, needed);
  const groups = Array.from(
    { length: FANSTOCKS_RULES.draftRounds },
    (_, index) => {
      const start = index * FANSTOCKS_RULES.candidatesPerRound;
      return Object.freeze(
        dealt.slice(start, start + FANSTOCKS_RULES.candidatesPerRound),
      );
    },
  );

  return Object.freeze({
    groups: Object.freeze(groups),
    roundIndex: 0,
    picks: Object.freeze([]),
    inspectedTicker: null,
    status: 'selecting',
  });
}

export function currentDraftLabel(state: DraftState): string {
  if (state.status === 'complete') {
    return 'Draft complete';
  }

  return `Round ${state.roundIndex + 1} of ${FANSTOCKS_RULES.draftRounds} · Pick 1 stock`;
}

export function draftReducer(
  state: DraftState,
  action: DraftAction,
): DraftState {
  if (state.status === 'complete') {
    return state;
  }

  const currentGroup = state.groups[state.roundIndex];
  if (currentGroup === undefined) {
    return state;
  }

  switch (action.type) {
    case 'OPEN_DETAIL':
      return currentGroup.includes(action.ticker)
        ? Object.freeze({ ...state, inspectedTicker: action.ticker })
        : state;

    case 'MOVE_DETAIL': {
      if (state.inspectedTicker === null) {
        return state;
      }

      const currentIndex = currentGroup.indexOf(state.inspectedTicker);
      if (currentIndex < 0) {
        return state;
      }

      const nextIndex =
        (currentIndex + action.direction + currentGroup.length) %
        currentGroup.length;
      return Object.freeze({
        ...state,
        inspectedTicker: currentGroup[nextIndex] ?? null,
      });
    }

    case 'CLOSE_DETAIL':
      return state.inspectedTicker === null
        ? state
        : Object.freeze({ ...state, inspectedTicker: null });

    case 'DRAFT': {
      if (
        !currentGroup.includes(action.ticker) ||
        state.picks.includes(action.ticker)
      ) {
        return state;
      }

      const roundIndex = state.roundIndex + 1;
      return Object.freeze({
        ...state,
        roundIndex,
        picks: Object.freeze([...state.picks, action.ticker]),
        inspectedTicker: null,
        status:
          roundIndex === FANSTOCKS_RULES.draftRounds
            ? 'complete'
            : 'selecting',
      });
    }
  }
}
