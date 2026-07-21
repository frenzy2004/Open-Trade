import type { GameProgressBadge } from '../../../app/routes/types';
import {
  createGameStore,
  type GameSaveCodec,
  type GameSaveDecodeResult,
  type GameStore,
} from '../../../shared/persistence/gameStore';
import { createSeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import { STOCKS } from '../content/stocks';
import type { AiId } from '../content/types';
import { completeAiDrafts } from '../engine/aiDraft';
import {
  createFanStocksState,
  type FanStocksState,
  type MarketSpeed,
} from '../engine/fanStocksReducer';
import { isCanonicalPortfolioMap } from '../engine/portfolioValidation';
import {
  advancePriceFrame,
  createInitialPriceFrame,
  marketLabel,
  type PriceFrame,
} from '../engine/priceEngine';
import { buildFanStocksResult } from '../engine/ranking';
import {
  FANSTOCKS_RULES,
  PARTICIPANT_ORDER,
  TOTAL_MARKET_TICKS,
} from '../engine/rules';
import {
  createIncomingTrade,
  createOutgoingTrade,
  decideOutgoingTrade,
  resolveTrade,
  type TradeEvent,
  type TradeOffer,
} from '../engine/trades';
import type { PortfolioMap } from '../engine/types';

export interface FanStocksSaveV1 {
  readonly schemaVersion: 1;
  readonly rulesetVersion: 1;
  readonly savedAt: string;
  readonly state: FanStocksState;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type SnapshotResult =
  | { readonly ok: true; readonly value: JsonValue }
  | { readonly ok: false };

const SAVE_KEYS = ['schemaVersion', 'rulesetVersion', 'savedAt', 'state'] as const;
const STATE_KEYS = [
  'schemaVersion',
  'rulesetVersion',
  'seed',
  'rematchIndex',
  'phase',
  'tutorialSeen',
  'draft',
  'portfolios',
  'priceHistory',
  'paused',
  'speed',
  'pendingTrade',
  'tradeLog',
  'result',
] as const;
const DRAFT_KEYS = [
  'groups',
  'roundIndex',
  'picks',
  'inspectedTicker',
  'status',
] as const;
const TRADE_KEYS = [
  'id',
  'direction',
  'opponentId',
  'playerGives',
  'playerReceives',
  'createdAtTick',
] as const;
const TRADE_EVENT_KEYS = [...TRADE_KEYS, 'status'] as const;
const PHASES = new Set([
  'intro',
  'tutorial',
  'draft',
  'ai-drafting',
  'market',
  'results',
]);
const SPEEDS = new Set<MarketSpeed>([1, 2, 4]);
const AI_IDS = new Set<AiId>(AI_PERSONALITIES.map(({ id }) => id));
const CHALLENGE_SEED_PATTERN = /^[a-z0-9_-]{1,64}$/i;
const CANONICAL_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_SNAPSHOT_DEPTH = 64;
const MAX_SNAPSHOT_NODES = 20_000;
const MAX_ARRAY_LENGTH = 10_000;
const MAX_RECORD_KEYS = 200;

function safeSnapshot(value: unknown): SnapshotResult {
  let nodes = 0;
  const ancestors = new WeakSet<object>();

  function visit(candidate: unknown, depth: number): JsonValue {
    if (depth > MAX_SNAPSHOT_DEPTH || nodes > MAX_SNAPSHOT_NODES) {
      throw new RangeError('Save graph is too large');
    }
    if (
      candidate === null
      || typeof candidate === 'string'
      || typeof candidate === 'boolean'
    ) {
      return candidate;
    }
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate)) throw new TypeError('Numbers must be finite');
      return candidate;
    }
    if (typeof candidate !== 'object') throw new TypeError('Not JSON data');
    if (ancestors.has(candidate)) throw new TypeError('Cyclic save graph');

    nodes += 1;
    ancestors.add(candidate);
    try {
      const prototype = Object.getPrototypeOf(candidate);
      const descriptors = Object.getOwnPropertyDescriptors(candidate);
      const ownKeys = Reflect.ownKeys(descriptors);
      if (Array.isArray(candidate)) {
        if (prototype !== Array.prototype) throw new TypeError('Nonstandard array');
        const lengthDescriptor = descriptors.length;
        const length = lengthDescriptor?.value;
        if (
          typeof length !== 'number'
          || !Number.isSafeInteger(length)
          || length < 0
          || length > MAX_ARRAY_LENGTH
          || ownKeys.some((key) => (
            typeof key !== 'string'
            || (key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))
          ))
          || ownKeys.length !== length + 1
        ) {
          throw new TypeError('Malformed array');
        }
        const output: JsonValue[] = [];
        for (let index = 0; index < length; index += 1) {
          const descriptor = descriptors[String(index)];
          if (
            descriptor === undefined
            || !Object.hasOwn(descriptor, 'value')
            || descriptor.enumerable !== true
          ) {
            throw new TypeError('Sparse or accessor array');
          }
          output.push(visit(descriptor.value, depth + 1));
        }
        return output;
      }

      if (
        prototype !== Object.prototype
        && prototype !== null
      ) throw new TypeError('Nonstandard record');
      if (
        ownKeys.length > MAX_RECORD_KEYS
        || ownKeys.some((key) => typeof key !== 'string')
      ) throw new TypeError('Malformed record');

      const output: { [key: string]: JsonValue } = {};
      for (const key of ownKeys as string[]) {
        const descriptor = descriptors[key];
        if (
          descriptor === undefined
          || !Object.hasOwn(descriptor, 'value')
          || descriptor.enumerable !== true
        ) {
          throw new TypeError('Accessor or hidden save field');
        }
        Object.defineProperty(output, key, {
          configurable: true,
          enumerable: true,
          value: visit(descriptor.value, depth + 1),
          writable: true,
        });
      }
      return output;
    } finally {
      ancestors.delete(candidate);
    }
  }

  try {
    return { ok: true, value: visit(value, 0) };
  } catch {
    return { ok: false };
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => sameJson(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => (
      Object.hasOwn(right, key) && sameJson(left[key], right[key])
    ));
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !CANONICAL_ISO_PATTERN.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isPositiveVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

function validRematchIdentity(
  seed: string,
  rematchIndex: number,
  phase: unknown,
): boolean {
  if (rematchIndex === 0) return true;
  if (phase === 'intro' || phase === 'tutorial') return false;
  const prefix = `rematch-${rematchIndex.toString(36)}-`;
  if (!seed.startsWith(prefix)) return false;
  const suffix = seed.slice(prefix.length);
  if (!/^[0-9a-z]{1,7}$/.test(suffix)) return false;
  const suffixValue = Number.parseInt(suffix, 36);
  return suffixValue <= 0xffff_ffff && suffixValue.toString(36) === suffix;
}

function validDraft(value: unknown, seed: string): boolean {
  if (!hasExactKeys(value, DRAFT_KEYS)) return false;
  const canonicalGroups = createFanStocksState(seed).draft.groups;
  if (!sameJson(value.groups, canonicalGroups)) return false;
  if (
    !Number.isSafeInteger(value.roundIndex)
    || (value.roundIndex as number) < 0
    || (value.roundIndex as number) > FANSTOCKS_RULES.draftRounds
    || !Array.isArray(value.picks)
    || value.picks.length !== value.roundIndex
  ) return false;

  const picks = value.picks;
  if (
    new Set(picks).size !== picks.length
    || picks.some((ticker, round) => (
      typeof ticker !== 'string' || !canonicalGroups[round]?.includes(ticker)
    ))
  ) return false;

  const complete = value.roundIndex === FANSTOCKS_RULES.draftRounds;
  if (value.status !== (complete ? 'complete' : 'selecting')) return false;
  if (complete) return value.inspectedTicker === null;
  const currentGroup = canonicalGroups[value.roundIndex as number];
  return value.inspectedTicker === null
    || (
      typeof value.inspectedTicker === 'string'
      && currentGroup?.includes(value.inspectedTicker) === true
    );
}

function validPortfolioStructure(value: unknown): value is PortfolioMap {
  if (!hasExactKeys(value, PARTICIPANT_ORDER)) return false;
  for (const participantId of PARTICIPANT_ORDER) {
    const portfolio = value[participantId];
    if (
      !hasExactKeys(portfolio, ['participantId', 'tickers'])
      || portfolio.participantId !== participantId
      || !Array.isArray(portfolio.tickers)
    ) return false;
  }
  return isCanonicalPortfolioMap(value);
}

function validPriceFrames(value: unknown, seed: string): value is readonly PriceFrame[] {
  if (!Array.isArray(value) || value.length > TOTAL_MARKET_TICKS + 1) return false;
  let expected = createInitialPriceFrame(STOCKS);
  for (let index = 0; index < value.length; index += 1) {
    const frame = value[index];
    if (!hasExactKeys(frame, ['tick', 'multipliers'])) return false;
    if (!hasExactKeys(frame.multipliers, STOCKS.map(({ ticker }) => ticker))) return false;
    if (index > 0) {
      expected = advancePriceFrame(
        expected,
        STOCKS,
        createSeededRng(seed).fork('prices'),
      );
    }
    if (!sameJson(frame, expected)) return false;
  }
  return true;
}

function parseTradeEvent(value: unknown): TradeEvent | null {
  if (!hasExactKeys(value, TRADE_EVENT_KEYS)) return null;
  if (
    typeof value.id !== 'string'
    || (value.direction !== 'incoming' && value.direction !== 'outgoing')
    || typeof value.opponentId !== 'string'
    || !AI_IDS.has(value.opponentId as AiId)
    || typeof value.playerGives !== 'string'
    || typeof value.playerReceives !== 'string'
    || !Number.isSafeInteger(value.createdAtTick)
    || (value.createdAtTick as number) < 0
    || (
      value.status !== 'accepted'
      && value.status !== 'passed'
      && value.status !== 'rejected'
    )
  ) return null;
  return value as unknown as TradeEvent;
}

function validPendingShape(value: unknown): value is TradeOffer {
  return hasExactKeys(value, TRADE_KEYS)
    && typeof value.id === 'string'
    && value.direction === 'incoming'
    && typeof value.opponentId === 'string'
    && AI_IDS.has(value.opponentId as AiId)
    && typeof value.playerGives === 'string'
    && typeof value.playerReceives === 'string'
    && Number.isSafeInteger(value.createdAtTick)
    && (value.createdAtTick as number) >= 0;
}

function expectedIncomingOffer(
  portfolios: PortfolioMap,
  seed: string,
  frame: PriceFrame,
): TradeOffer | null {
  const offerIndex = FANSTOCKS_RULES.incomingTradeTicks.findIndex(
    (tick) => tick === frame.tick,
  );
  const opponent = offerIndex < 0 ? undefined : AI_PERSONALITIES[offerIndex];
  return opponent === undefined
    ? null
    : createIncomingTrade(
        portfolios,
        opponent.id,
        STOCKS,
        frame,
        frame.tick,
        createSeededRng(seed).fork(`incoming:${frame.tick}`),
      );
}

interface TradeReplay {
  readonly portfolios: PortfolioMap;
  readonly expectedPending: TradeOffer | null;
}

function replayTrades(
  seed: string,
  draftPicks: readonly string[],
  priceHistory: readonly PriceFrame[],
  tradeLogValue: unknown,
): TradeReplay | null {
  if (!Array.isArray(tradeLogValue)) return null;
  let portfolios = completeAiDrafts(
    draftPicks,
    STOCKS,
    createSeededRng(seed).fork('ai-draft'),
  );
  const lastTick = priceHistory.at(-1)?.tick;
  if (lastTick === undefined) return null;
  const latestTradeTick = Math.min(lastTick, TOTAL_MARKET_TICKS - 1);
  const resolvedIncomingTicks = new Set<number>();
  let previousTick = -1;

  for (const rawEvent of tradeLogValue) {
    const event = parseTradeEvent(rawEvent);
    if (
      event === null
      || event.createdAtTick < previousTick
      || event.createdAtTick > latestTradeTick
      || FANSTOCKS_RULES.incomingTradeTicks.some((tick) => (
        tick < event.createdAtTick && tick <= lastTick && !resolvedIncomingTicks.has(tick)
      ))
    ) return null;
    previousTick = event.createdAtTick;

    if (event.direction === 'incoming') {
      if (
        event.status === 'rejected'
        || resolvedIncomingTicks.has(event.createdAtTick)
      ) return null;
      const frame = priceHistory[event.createdAtTick];
      if (frame === undefined) return null;
      const expected = expectedIncomingOffer(portfolios, seed, frame);
      if (expected === null || !sameJson(event, { ...expected, status: event.status })) {
        return null;
      }
      resolvedIncomingTicks.add(event.createdAtTick);
    } else {
      if (
        event.status === 'passed'
        || FANSTOCKS_RULES.incomingTradeTicks.some((tick) => (
          tick === event.createdAtTick && !resolvedIncomingTicks.has(tick)
        ))
      ) return null;
      let offer: TradeOffer;
      try {
        offer = createOutgoingTrade(
          portfolios,
          event.opponentId,
          event.playerGives,
          event.playerReceives,
          event.createdAtTick,
        );
      } catch {
        return null;
      }
      const personality = AI_PERSONALITIES.find(({ id }) => id === event.opponentId);
      if (personality === undefined) return null;
      const status = decideOutgoingTrade(
        offer,
        personality,
        STOCKS,
        createSeededRng(seed).fork(`trade:${offer.id}`),
      );
      if (status !== event.status || !sameJson(event, { ...offer, status })) return null;
    }

    try {
      portfolios = resolveTrade(portfolios, event, event.status).portfolios;
    } catch {
      return null;
    }
  }

  for (const tick of FANSTOCKS_RULES.incomingTradeTicks) {
    if (tick < lastTick && !resolvedIncomingTicks.has(tick)) return null;
  }
  const lastFrame = priceHistory.at(-1);
  const expectedPending = lastFrame === undefined
    || resolvedIncomingTicks.has(lastTick)
    ? null
    : expectedIncomingOffer(portfolios, seed, lastFrame);
  return { portfolios, expectedPending };
}

function validPhaseState(state: Record<string, unknown>): boolean {
  const phase = state.phase;
  if (typeof phase !== 'string' || !PHASES.has(phase)) return false;
  const draft = state.draft as Record<string, unknown>;
  const noLeagueData = state.portfolios === null
    && Array.isArray(state.priceHistory)
    && state.priceHistory.length === 0
    && state.paused === false
    && state.speed === 1
    && state.pendingTrade === null
    && Array.isArray(state.tradeLog)
    && state.tradeLog.length === 0
    && state.result === null;

  if (phase === 'intro' || phase === 'tutorial') {
    return noLeagueData
      && state.tutorialSeen === false
      && draft.roundIndex === 0
      && draft.status === 'selecting'
      && draft.inspectedTicker === null;
  }
  if (phase === 'draft') {
    return noLeagueData
      && state.tutorialSeen === true
      && draft.status === 'selecting';
  }
  if (phase === 'ai-drafting') {
    return noLeagueData
      && state.tutorialSeen === true
      && draft.status === 'complete';
  }
  if (!Array.isArray(state.priceHistory)) return false;
  if (phase === 'market') {
    const lastTick = (state.priceHistory.at(-1) as PriceFrame | undefined)?.tick;
    return state.tutorialSeen === true
      && draft.status === 'complete'
      && state.result === null
      && typeof lastTick === 'number'
      && lastTick >= 0
      && lastTick < TOTAL_MARKET_TICKS;
  }
  return state.tutorialSeen === true
    && draft.status === 'complete'
    && state.paused === true
    && state.pendingTrade === null
    && state.priceHistory.length === TOTAL_MARKET_TICKS + 1
    && state.result !== null;
}

function validState(value: unknown): value is FanStocksState {
  if (!hasExactKeys(value, STATE_KEYS)) return false;
  if (
    value.schemaVersion !== 1
    || value.rulesetVersion !== 1
    || typeof value.seed !== 'string'
    || !CHALLENGE_SEED_PATTERN.test(value.seed)
    || !Number.isSafeInteger(value.rematchIndex)
    || (value.rematchIndex as number) < 0
    || typeof value.tutorialSeen !== 'boolean'
    || typeof value.paused !== 'boolean'
    || typeof value.speed !== 'number'
    || !SPEEDS.has(value.speed as MarketSpeed)
    || !validDraft(value.draft, value.seed)
    || !validPriceFrames(value.priceHistory, value.seed)
  ) return false;
  if (!validRematchIdentity(
    value.seed,
    value.rematchIndex as number,
    value.phase,
  )) return false;
  if (!validPhaseState(value)) return false;

  if (value.phase === 'intro'
    || value.phase === 'tutorial'
    || value.phase === 'draft'
    || value.phase === 'ai-drafting') return true;
  if (!validPortfolioStructure(value.portfolios)) return false;
  const replay = replayTrades(
    value.seed,
    (value.draft as { picks: readonly string[] }).picks,
    value.priceHistory as readonly PriceFrame[],
    value.tradeLog,
  );
  if (replay === null || !sameJson(value.portfolios, replay.portfolios)) return false;
  if (value.pendingTrade !== null && !validPendingShape(value.pendingTrade)) return false;
  if (!sameJson(value.pendingTrade, replay.expectedPending)) return false;

  if (value.phase === 'results') {
    const finalFrame = (value.priceHistory as readonly PriceFrame[]).at(-1);
    if (finalFrame === undefined || !Array.isArray(value.tradeLog)) return false;
    return sameJson(
      value.result,
      buildFanStocksResult(
        replay.portfolios,
        finalFrame,
        value.tradeLog as readonly TradeEvent[],
      ),
    );
  }
  return value.result === null;
}

function decodeFanStocksSave(raw: unknown): GameSaveDecodeResult<FanStocksSaveV1> {
  const snapshot = safeSnapshot(raw);
  if (!snapshot.ok || !isRecord(snapshot.value)) {
    return { ok: false, reason: 'corrupt' };
  }
  const candidate = snapshot.value;
  if (
    !hasExactKeys(candidate, SAVE_KEYS)
    || !isPositiveVersion(candidate.schemaVersion)
    || !isPositiveVersion(candidate.rulesetVersion)
    || !isCanonicalIsoTimestamp(candidate.savedAt)
    || !validState(candidate.state)
  ) return { ok: false, reason: 'corrupt' };
  if (candidate.schemaVersion !== 1 || candidate.rulesetVersion !== 1) {
    return { ok: false, reason: 'incompatible' };
  }
  return {
    ok: true,
    value: deepFreeze(candidate as unknown as FanStocksSaveV1),
  };
}

export const fanStocksSaveCodec: GameSaveCodec<FanStocksSaveV1> = {
  key: 'opentrade.fanstocks',
  version: 1,
  encode(value): unknown {
    const decoded = decodeFanStocksSave(value);
    if (!decoded.ok) throw new RangeError(`Cannot encode ${decoded.reason} FanStocks save`);
    return decoded.value;
  },
  decode: decodeFanStocksSave,
};

const baseFanStocksStore = createGameStore(fanStocksSaveCodec);

export const fanStocksStore: GameStore<FanStocksSaveV1> = Object.freeze({
  save: baseFanStocksStore.save,
  clear: baseFanStocksStore.clear,
  load() {
    const loaded = baseFanStocksStore.load();
    return loaded.status === 'recovery-required'
      && loaded.reason === 'corrupt'
      && loaded.detail === 'incompatible'
      ? {
          status: 'recovery-required' as const,
          reason: 'incompatible' as const,
          detail: 'Saved FanStocks rules or schema are incompatible',
        }
      : loaded;
  },
});

export function createFanStocksSave(
  state: FanStocksState,
  savedAt: string,
): FanStocksSaveV1 {
  if (!isCanonicalIsoTimestamp(savedAt)) {
    throw new RangeError('FanStocks savedAt must be a canonical ISO timestamp');
  }
  const decoded = decodeFanStocksSave({
    schemaVersion: 1,
    rulesetVersion: 1,
    savedAt,
    state,
  });
  if (!decoded.ok) throw new RangeError('FanStocks state is not persistable');
  return decoded.value;
}

export function progressBadgeForFanStocksState(
  state: FanStocksState,
): GameProgressBadge {
  if (state.phase === 'results') {
    return { label: 'FanStocks', value: 'League complete', tone: 'positive' };
  }
  if (state.phase === 'draft') {
    return {
      label: 'FanStocks',
      value: `Draft round ${state.draft.roundIndex + 1} of ${FANSTOCKS_RULES.draftRounds}`,
      tone: 'positive',
    };
  }
  if (state.phase === 'ai-drafting') {
    return {
      label: 'FanStocks',
      value: `Draft round ${FANSTOCKS_RULES.draftRounds} of ${FANSTOCKS_RULES.draftRounds}`,
      tone: 'positive',
    };
  }
  if (state.phase === 'market') {
    const frame = state.priceHistory.at(-1);
    return {
      label: 'FanStocks',
      value: `${marketLabel(frame?.tick ?? 0).day} market`,
      tone: 'positive',
    };
  }
  return { label: 'FanStocks', value: 'League ready', tone: 'positive' };
}

export function getFanStocksProgressBadge(): GameProgressBadge | null {
  const loaded = fanStocksStore.load();
  if (loaded.status === 'empty') return null;
  if (loaded.status === 'recovery-required') {
    return {
      label: 'FanStocks',
      value: 'Progress needs reset',
      tone: 'warning',
    };
  }

  return progressBadgeForFanStocksState(loaded.value.state);
}

export function resetFanStocksProgress(): void {
  const cleared = fanStocksStore.clear();
  if (!cleared.ok) {
    throw new Error(`FanStocks game save reset failed: ${cleared.reason}`);
  }
}
