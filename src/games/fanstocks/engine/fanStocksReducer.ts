import { createSeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import { STOCKS } from '../content/stocks';
import type { AiId, Ticker } from '../content/types';
import { completeAiDrafts } from './aiDraft';
import {
  createDraftState,
  draftReducer,
  type DraftAction,
  type DraftState,
} from './draftReducer';
import {
  advancePriceFrame,
  createInitialPriceFrame,
  type PriceFrame,
} from './priceEngine';
import { buildFanStocksResult, type FanStocksResult } from './ranking';
import { FANSTOCKS_RULES, TOTAL_MARKET_TICKS } from './rules';
import {
  createIncomingTrade,
  createOutgoingTrade,
  decideOutgoingTrade,
  resolveTrade,
  validateTrade,
  type TradeEvent,
  type TradeOffer,
} from './trades';
import type { PortfolioMap } from './types';

export type FanStocksPhase =
  | 'intro'
  | 'tutorial'
  | 'draft'
  | 'ai-drafting'
  | 'market'
  | 'results';

export type MarketSpeed = 1 | 2 | 4;

export interface FanStocksState {
  readonly schemaVersion: 1;
  readonly rulesetVersion: 1;
  readonly seed: string;
  readonly rematchIndex: number;
  readonly phase: FanStocksPhase;
  readonly tutorialSeen: boolean;
  readonly draft: DraftState;
  readonly portfolios: PortfolioMap | null;
  readonly priceHistory: readonly PriceFrame[];
  readonly paused: boolean;
  readonly speed: MarketSpeed;
  readonly pendingTrade: TradeOffer | null;
  readonly tradeLog: readonly TradeEvent[];
  readonly result: FanStocksResult | null;
}

export type FanStocksAction =
  | { type: 'START_LEAGUE' }
  | { type: 'DISMISS_TUTORIAL' }
  | { type: 'OPEN_DETAIL'; ticker: Ticker }
  | { type: 'MOVE_DETAIL'; direction: -1 | 1 }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'DRAFT'; ticker: Ticker }
  | { type: 'AI_DRAFTS_READY' }
  | { type: 'MARKET_TICK' }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_SPEED'; speed: MarketSpeed }
  | { type: 'DECIDE_INCOMING'; decision: 'accepted' | 'passed' }
  | {
      type: 'SUBMIT_OUTGOING';
      opponentId: AiId;
      playerGives: Ticker;
      playerReceives: Ticker;
    }
  | { type: 'REMATCH' }
  | { type: 'NEW_LEAGUE'; seed: string };

const EMPTY_PRICE_HISTORY: readonly PriceFrame[] = Object.freeze([]);
const EMPTY_TRADE_LOG: readonly TradeEvent[] = Object.freeze([]);
const MARKET_SPEEDS: readonly MarketSpeed[] = Object.freeze([1, 2, 4]);
const CHALLENGE_SEED_PATTERN = /^[a-z0-9_-]{1,64}$/i;

function isMarketSpeed(value: unknown): value is MarketSpeed {
  return typeof value === 'number'
    && MARKET_SPEEDS.some((speed) => speed === value);
}

function createDraft(seed: string): DraftState {
  return createDraftState(
    STOCKS.map(({ ticker }) => ticker),
    createSeededRng(seed).fork('draft'),
  );
}

export function createFanStocksState(seed: string): FanStocksState {
  if (typeof seed !== 'string' || !CHALLENGE_SEED_PATTERN.test(seed)) {
    throw new Error('FanStocks seed must match challenge seed format');
  }

  return Object.freeze({
    schemaVersion: 1,
    rulesetVersion: 1,
    seed,
    rematchIndex: 0,
    phase: 'intro',
    tutorialSeen: false,
    draft: createDraft(seed),
    portfolios: null,
    priceHistory: EMPTY_PRICE_HISTORY,
    paused: false,
    speed: 1,
    pendingTrade: null,
    tradeLog: EMPTY_TRADE_LOG,
    result: null,
  });
}

function applyDraftAction(
  state: FanStocksState,
  action: DraftAction,
): FanStocksState {
  if (state.phase !== 'draft') return state;
  const draft = draftReducer(state.draft, action);
  if (draft === state.draft) return state;
  return Object.freeze({
    ...state,
    draft,
    phase: draft.status === 'complete' ? 'ai-drafting' : 'draft',
  });
}

function completeDraft(state: FanStocksState): FanStocksState {
  const portfolios = completeAiDrafts(
    state.draft.picks,
    STOCKS,
    createSeededRng(state.seed).fork('ai-draft'),
  );
  return Object.freeze({
    ...state,
    phase: 'market',
    portfolios,
    priceHistory: Object.freeze([createInitialPriceFrame(STOCKS)]),
  });
}

function handleIncomingDecision(
  state: FanStocksState,
  decision: 'accepted' | 'passed',
): FanStocksState {
  if (
    state.phase !== 'market'
    || state.pendingTrade === null
    || state.portfolios === null
    || (decision !== 'accepted' && decision !== 'passed')
  ) {
    return state;
  }

  const validation = validateTrade(state.portfolios, state.pendingTrade);
  if (!validation.ok || state.pendingTrade.direction !== 'incoming') {
    return decision === 'passed'
      ? Object.freeze({ ...state, pendingTrade: null })
      : state;
  }

  const resolution = resolveTrade(
    state.portfolios,
    state.pendingTrade,
    decision,
  );
  return Object.freeze({
    ...state,
    portfolios: resolution.portfolios,
    pendingTrade: null,
    tradeLog: Object.freeze([...state.tradeLog, resolution.event]),
  });
}

function handleOutgoingTrade(
  state: FanStocksState,
  action: Extract<FanStocksAction, { type: 'SUBMIT_OUTGOING' }>,
): FanStocksState {
  if (
    state.phase !== 'market'
    || state.portfolios === null
    || state.pendingTrade !== null
  ) {
    return state;
  }

  const personality = AI_PERSONALITIES.find(({ id }) => id === action.opponentId);
  const currentFrame = state.priceHistory.at(-1);
  if (
    personality === undefined
    || currentFrame === undefined
    || !state.portfolios.player.tickers.includes(action.playerGives)
    || !state.portfolios[personality.id].tickers.includes(action.playerReceives)
  ) {
    return state;
  }

  const offer = createOutgoingTrade(
    state.portfolios,
    personality.id,
    action.playerGives,
    action.playerReceives,
    currentFrame.tick,
  );
  const status = decideOutgoingTrade(
    offer,
    personality,
    STOCKS,
    createSeededRng(state.seed).fork(`trade:${offer.id}`),
  );
  const resolution = resolveTrade(state.portfolios, offer, status);
  return Object.freeze({
    ...state,
    portfolios: resolution.portfolios,
    tradeLog: Object.freeze([...state.tradeLog, resolution.event]),
  });
}

function handleMarketTick(state: FanStocksState): FanStocksState {
  if (
    state.phase !== 'market'
    || state.paused
    || state.pendingTrade !== null
    || state.portfolios === null
  ) {
    return state;
  }

  const previous = state.priceHistory.at(-1);
  if (previous === undefined || previous.tick >= TOTAL_MARKET_TICKS) return state;

  const frame = advancePriceFrame(
    previous,
    STOCKS,
    createSeededRng(state.seed).fork('prices'),
  );
  const priceHistory = Object.freeze([...state.priceHistory, frame]);
  if (frame.tick === TOTAL_MARKET_TICKS) {
    return Object.freeze({
      ...state,
      phase: 'results',
      priceHistory,
      paused: true,
      result: buildFanStocksResult(state.portfolios, frame, state.tradeLog),
    });
  }

  const offerIndex = FANSTOCKS_RULES.incomingTradeTicks.findIndex(
    (tick) => tick === frame.tick,
  );
  const opponent = offerIndex < 0 ? undefined : AI_PERSONALITIES[offerIndex];
  const pendingTrade = opponent === undefined
    ? null
    : createIncomingTrade(
        state.portfolios,
        opponent.id,
        STOCKS,
        frame,
        frame.tick,
        createSeededRng(state.seed).fork(`incoming:${frame.tick}`),
      );

  return Object.freeze({ ...state, priceHistory, pendingTrade });
}

function createRematch(state: FanStocksState): FanStocksState {
  const rematchIndex = state.rematchIndex + 1;
  const derivedSeed = createSeededRng(state.seed)
    .fork(`rematch:${rematchIndex}`)
    .seed
    .toString(36);
  const next = createFanStocksState(
    `rematch-${rematchIndex.toString(36)}-${derivedSeed}`,
  );
  return Object.freeze({
    ...next,
    rematchIndex,
    phase: 'draft',
    tutorialSeen: true,
  });
}

export function fanStocksReducer(
  state: FanStocksState,
  action: FanStocksAction,
): FanStocksState {
  if (typeof action !== 'object' || action === null) return state;

  switch (action.type) {
    case 'NEW_LEAGUE':
      return createFanStocksState(action.seed);

    case 'START_LEAGUE':
      return state.phase === 'intro'
        ? Object.freeze({
            ...state,
            phase: state.tutorialSeen ? 'draft' : 'tutorial',
          })
        : state;

    case 'DISMISS_TUTORIAL':
      return state.phase === 'tutorial'
        ? Object.freeze({ ...state, phase: 'draft', tutorialSeen: true })
        : state;

    case 'OPEN_DETAIL':
    case 'CLOSE_DETAIL':
    case 'DRAFT':
      return applyDraftAction(state, action);

    case 'MOVE_DETAIL':
      return action.direction === -1 || action.direction === 1
        ? applyDraftAction(state, action)
        : state;

    case 'AI_DRAFTS_READY':
      return state.phase === 'ai-drafting' ? completeDraft(state) : state;

    case 'SET_PAUSED':
      return state.phase === 'market'
        && typeof action.paused === 'boolean'
        && state.paused !== action.paused
        ? Object.freeze({ ...state, paused: action.paused })
        : state;

    case 'SET_SPEED':
      return state.phase === 'market'
        && isMarketSpeed(action.speed)
        && state.speed !== action.speed
        ? Object.freeze({ ...state, speed: action.speed })
        : state;

    case 'DECIDE_INCOMING':
      return handleIncomingDecision(state, action.decision);

    case 'SUBMIT_OUTGOING':
      return handleOutgoingTrade(state, action);

    case 'MARKET_TICK':
      return handleMarketTick(state);

    case 'REMATCH':
      return state.phase === 'results' ? createRematch(state) : state;
  }

  return state;
}
