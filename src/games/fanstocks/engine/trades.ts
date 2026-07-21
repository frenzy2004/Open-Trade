import type { SeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import { STOCKS } from '../content/stocks';
import type { AiId, AiPersonality, StockCard, Ticker } from '../content/types';
import { validateStocks } from '../content/validateStocks';
import { scoreCardForPersonality } from './aiDraft';
import type { PriceFrame } from './priceEngine';
import { FANSTOCKS_RULES, PARTICIPANT_ORDER } from './rules';
import type { Portfolio, PortfolioMap } from './types';

export interface TradeOffer {
  readonly id: string;
  readonly direction: 'incoming' | 'outgoing';
  readonly opponentId: AiId;
  readonly playerGives: Ticker;
  readonly playerReceives: Ticker;
  readonly createdAtTick: number;
}

export interface TradeEvent extends TradeOffer {
  readonly status: 'accepted' | 'passed' | 'rejected';
}

export type TradeValidation = { ok: true } | { ok: false; reason: string };

const AI_IDS = new Set<AiId>(AI_PERSONALITIES.map(({ id }) => id));
const TRADE_STATUSES = new Set<TradeEvent['status']>([
  'accepted',
  'passed',
  'rejected',
]);
const CANONICAL_TICKERS = Object.freeze(STOCKS.map(({ ticker }) => ticker));
const CANONICAL_TICKER_SET = new Set<Ticker>(CANONICAL_TICKERS);
const INVALID_PORTFOLIOS_REASON = `Portfolios must contain exactly ${FANSTOCKS_RULES.cardsPerPortfolio} unique tickers each with no duplicates across participants`;
const INVALID_CARD_COVERAGE_REASON = `Card registry must contain all ${CANONICAL_TICKERS.length} canonical FanStocks cards exactly once`;

function validateOfferShape(offer: TradeOffer): TradeValidation {
  const candidate = (
    typeof offer === 'object' && offer !== null ? offer : {}
  ) as Partial<Record<keyof TradeOffer, unknown>>;

  if (candidate.direction !== 'incoming' && candidate.direction !== 'outgoing') {
    return { ok: false, reason: 'Trade direction must be incoming or outgoing' };
  }
  if (typeof candidate.opponentId !== 'string' || !AI_IDS.has(candidate.opponentId as AiId)) {
    return { ok: false, reason: 'Trade opponent must be a known AI participant' };
  }
  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return { ok: false, reason: 'Trade id must be non-empty' };
  }
  if (!Number.isSafeInteger(candidate.createdAtTick) || (candidate.createdAtTick as number) < 0) {
    return { ok: false, reason: 'Trade tick must be a non-negative safe integer' };
  }
  if (
    typeof candidate.playerGives !== 'string'
    || candidate.playerGives.length === 0
    || typeof candidate.playerReceives !== 'string'
    || candidate.playerReceives.length === 0
  ) {
    return { ok: false, reason: 'Trade cards must be non-empty tickers' };
  }
  if (candidate.playerGives === candidate.playerReceives) {
    return { ok: false, reason: 'Trade cards must be different' };
  }
  return { ok: true };
}

function hasValidPortfolioStructure(portfolios: PortfolioMap): boolean {
  if (typeof portfolios !== 'object' || portfolios === null) return false;

  const record = portfolios as unknown as Record<string, unknown>;
  if (
    Object.keys(record).length !== PARTICIPANT_ORDER.length
    || PARTICIPANT_ORDER.some((participantId) => {
      const portfolio = record[participantId] as Partial<Portfolio> | undefined;
      return (
        typeof portfolio !== 'object'
        || portfolio === null
        || portfolio.participantId !== participantId
        || !Array.isArray(portfolio.tickers)
        || portfolio.tickers.length !== FANSTOCKS_RULES.cardsPerPortfolio
        || portfolio.tickers.some((ticker) => typeof ticker !== 'string' || ticker.length === 0)
        || new Set(portfolio.tickers).size !== portfolio.tickers.length
      );
    })
  ) {
    return false;
  }

  const allTickers = PARTICIPANT_ORDER.flatMap((participantId) => (
    (record[participantId] as Portfolio).tickers
  ));
  return hasExactCanonicalTickerCoverage(allTickers);
}

function hasExactCanonicalTickerCoverage(tickers: readonly unknown[]): boolean {
  return tickers.length === CANONICAL_TICKERS.length
    && new Set(tickers).size === CANONICAL_TICKER_SET.size
    && tickers.every((ticker) => (
      typeof ticker === 'string' && CANONICAL_TICKER_SET.has(ticker)
    ));
}

function assertValidCards(cards: readonly StockCard[]): void {
  if (!Array.isArray(cards) || cards.length === 0 || validateStocks(cards).length > 0) {
    throw new RangeError('Card registry must contain valid unique cards');
  }
}

function assertCompleteCanonicalCardRegistry(cards: readonly StockCard[]): void {
  if (!hasExactCanonicalTickerCoverage(cards.map(({ ticker }) => ticker))) {
    throw new RangeError(INVALID_CARD_COVERAGE_REASON);
  }
}

function getCard(
  cardByTicker: ReadonlyMap<Ticker, StockCard>,
  ticker: Ticker,
): StockCard {
  const card = cardByTicker.get(ticker);
  if (card === undefined) throw new RangeError(`Card registry is missing ${ticker}`);
  return card;
}

function getTieIndex(
  tieOrder: ReadonlyMap<Ticker, number>,
  ticker: Ticker,
): number {
  const index = tieOrder.get(ticker);
  if (index === undefined) throw new RangeError(`Trade tie order is missing ${ticker}`);
  return index;
}

function frameHasFinitePrices(
  frame: PriceFrame,
  tickers: readonly Ticker[],
): boolean {
  if (typeof frame !== 'object' || frame === null) return false;
  const multipliers = frame.multipliers as Readonly<Record<string, unknown>>;
  if (typeof multipliers !== 'object' || multipliers === null) return false;
  return tickers.every((ticker) => (
    Object.hasOwn(multipliers, ticker)
    && typeof multipliers[ticker] === 'number'
    && Number.isFinite(multipliers[ticker])
  ));
}

function freezePortfolio(
  portfolio: Portfolio,
  tickers: readonly Ticker[] = portfolio.tickers,
): Portfolio {
  if (
    tickers === portfolio.tickers
    && Object.isFrozen(portfolio)
    && Object.isFrozen(portfolio.tickers)
  ) {
    return portfolio;
  }
  return Object.freeze({
    ...portfolio,
    tickers: Object.freeze([...tickers]),
  });
}

export function validateTrade(
  portfolios: PortfolioMap,
  offer: TradeOffer,
): TradeValidation {
  const shapeValidation = validateOfferShape(offer);
  if (!shapeValidation.ok) return shapeValidation;
  if (!hasValidPortfolioStructure(portfolios)) {
    return { ok: false, reason: INVALID_PORTFOLIOS_REASON };
  }
  if (!portfolios.player.tickers.includes(offer.playerGives)) {
    return { ok: false, reason: `Player does not own ${offer.playerGives}` };
  }
  if (!portfolios[offer.opponentId].tickers.includes(offer.playerReceives)) {
    return { ok: false, reason: `${offer.opponentId} does not own ${offer.playerReceives}` };
  }
  return { ok: true };
}

export function createOutgoingTrade(
  portfolios: PortfolioMap,
  opponentId: AiId,
  playerGives: Ticker,
  playerReceives: Ticker,
  createdAtTick: number,
): TradeOffer {
  const offer = Object.freeze({
    id: `out-${createdAtTick}-${opponentId}-${playerGives}-${playerReceives}`,
    direction: 'outgoing' as const,
    opponentId,
    playerGives,
    playerReceives,
    createdAtTick,
  });
  const validation = validateTrade(portfolios, offer);
  if (!validation.ok) throw new RangeError(validation.reason);
  return offer;
}

export function createIncomingTrade(
  portfolios: PortfolioMap,
  opponentId: AiId,
  cards: readonly StockCard[],
  frame: PriceFrame,
  createdAtTick: number,
  rng: SeededRng,
): TradeOffer | null {
  if (!AI_IDS.has(opponentId)) {
    throw new RangeError('Trade opponent must be a known AI participant');
  }
  if (!Number.isSafeInteger(createdAtTick) || createdAtTick < 0) {
    throw new RangeError('Trade tick must be a non-negative safe integer');
  }
  if (!hasValidPortfolioStructure(portfolios)) {
    throw new RangeError(INVALID_PORTFOLIOS_REASON);
  }
  assertValidCards(cards);

  const personality = AI_PERSONALITIES.find(({ id }) => id === opponentId);
  if (personality === undefined) {
    throw new RangeError('Trade opponent must be a known AI participant');
  }
  const cardByTicker = new Map(cards.map((card) => [card.ticker, card] as const));
  const tradeableTickers = [
    ...portfolios.player.tickers,
    ...portfolios[opponentId].tickers,
  ];
  for (const ticker of tradeableTickers) getCard(cardByTicker, ticker);
  assertCompleteCanonicalCardRegistry(cards);
  if (!frameHasFinitePrices(frame, tradeableTickers)) return null;

  const current = portfolios[opponentId].tickers.map((ticker) => (
    getCard(cardByTicker, ticker)
  ));
  const tieOrder = new Map(
    rng.shuffle(tradeableTickers).map((ticker, index) => [ticker, index] as const),
  );
  const score = (ticker: Ticker) => {
    const value = scoreCardForPersonality(
      personality,
      getCard(cardByTicker, ticker),
      current,
    );
    if (!Number.isFinite(value)) {
      throw new RangeError(`Trade score must be finite for ${ticker}`);
    }
    return value;
  };
  const wanted = [...portfolios.player.tickers].sort((left, right) => (
    score(right) - score(left)
    || getTieIndex(tieOrder, left) - getTieIndex(tieOrder, right)
  ))[0];
  const offered = [...portfolios[opponentId].tickers].sort((left, right) => (
    score(left) - score(right)
    || getTieIndex(tieOrder, left) - getTieIndex(tieOrder, right)
  ))[0];
  if (wanted === undefined || offered === undefined) return null;

  const offer = Object.freeze({
    id: `in-${createdAtTick}-${opponentId}-${wanted}-${offered}`,
    direction: 'incoming' as const,
    opponentId,
    playerGives: wanted,
    playerReceives: offered,
    createdAtTick,
  });
  const validation = validateTrade(portfolios, offer);
  if (!validation.ok) throw new RangeError(validation.reason);
  return offer;
}

export function decideOutgoingTrade(
  offer: TradeOffer,
  personality: AiPersonality,
  cards: readonly StockCard[],
  rng: SeededRng,
): 'accepted' | 'rejected' {
  const shapeValidation = validateOfferShape(offer);
  if (!shapeValidation.ok) {
    if (shapeValidation.reason === 'Trade direction must be incoming or outgoing') {
      throw new RangeError('AI decisions require an outgoing trade offer');
    }
    throw new RangeError(shapeValidation.reason);
  }
  if (offer.direction !== 'outgoing') {
    throw new RangeError('AI decisions require an outgoing trade offer');
  }
  if (
    typeof personality !== 'object'
    || personality === null
    || !AI_IDS.has(personality.id)
    || !Number.isFinite(personality.tradeThreshold)
  ) {
    throw new RangeError('Trade personality must be valid');
  }
  if (personality.id !== offer.opponentId) {
    throw new RangeError('Trade personality must match the opponent');
  }
  assertValidCards(cards);

  const cardByTicker = new Map(cards.map((card) => [card.ticker, card] as const));
  const received = getCard(cardByTicker, offer.playerGives);
  const given = getCard(cardByTicker, offer.playerReceives);
  const scoreReceived = scoreCardForPersonality(personality, received, []);
  const scoreGiven = scoreCardForPersonality(personality, given, []);
  if (!Number.isFinite(scoreReceived) || !Number.isFinite(scoreGiven)) {
    throw new RangeError('Trade card scores must be finite');
  }

  const jitterSample = rng.fork(offer.id).next();
  if (!Number.isFinite(jitterSample) || jitterSample < 0 || jitterSample >= 1) {
    throw new RangeError(
      'Trade jitter must be a finite number from 0 inclusive to 1 exclusive',
    );
  }
  const jitter = jitterSample * 0.02 - 0.01;
  return scoreReceived - scoreGiven + jitter >= personality.tradeThreshold
    ? 'accepted'
    : 'rejected';
}

export function resolveTrade(
  portfolios: PortfolioMap,
  offer: TradeOffer,
  status: TradeEvent['status'],
): Readonly<{ portfolios: PortfolioMap; event: TradeEvent }> {
  if (!TRADE_STATUSES.has(status)) {
    throw new RangeError('Trade status must be accepted, passed, or rejected');
  }
  const validation = validateTrade(portfolios, offer);
  if (!validation.ok) throw new RangeError(validation.reason);

  const event = Object.freeze({ ...offer, status });
  if (status !== 'accepted') {
    return Object.freeze({ portfolios, event });
  }

  const swappedPlayerTickers = portfolios.player.tickers.map((ticker) => (
    ticker === offer.playerGives ? offer.playerReceives : ticker
  ));
  const swappedOpponentTickers = portfolios[offer.opponentId].tickers.map((ticker) => (
    ticker === offer.playerReceives ? offer.playerGives : ticker
  ));
  const nextPortfolios = Object.freeze(Object.fromEntries(
    PARTICIPANT_ORDER.map((participantId) => {
      const portfolio = portfolios[participantId];
      if (participantId === 'player') {
        return [participantId, freezePortfolio(portfolio, swappedPlayerTickers)];
      }
      if (participantId === offer.opponentId) {
        return [participantId, freezePortfolio(portfolio, swappedOpponentTickers)];
      }
      return [participantId, freezePortfolio(portfolio)];
    }),
  )) as PortfolioMap;
  if (!hasValidPortfolioStructure(nextPortfolios)) {
    throw new RangeError(INVALID_PORTFOLIOS_REASON);
  }
  return Object.freeze({ portfolios: nextPortfolios, event });
}
