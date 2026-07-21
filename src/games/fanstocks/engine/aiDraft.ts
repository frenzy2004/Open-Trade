import type { SeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import type { AiId, AiPersonality, StockCard, Ticker } from '../content/types';
import { validateStocks } from '../content/validateStocks';
import { FANSTOCKS_RULES } from './rules';
import type { Portfolio, PortfolioMap } from './types';

function getCard(cardByTicker: ReadonlyMap<Ticker, StockCard>, ticker: Ticker): StockCard {
  const card = cardByTicker.get(ticker);
  if (card === undefined) {
    throw new Error(`Card registry is missing ${ticker}`);
  }
  return card;
}

function getPicks(picks: ReadonlyMap<AiId, Ticker[]>, id: AiId): Ticker[] {
  const personalityPicks = picks.get(id);
  if (personalityPicks === undefined) {
    throw new Error(`AI draft is missing ${id}`);
  }
  return personalityPicks;
}

function getTieIndex(tieOrder: ReadonlyMap<Ticker, number>, ticker: Ticker): number {
  const index = tieOrder.get(ticker);
  if (index === undefined) {
    throw new Error(`Tie order is missing ${ticker}`);
  }
  return index;
}

export function scoreCardForPersonality(
  personality: AiPersonality,
  card: StockCard,
  currentCards: readonly StockCard[],
): number {
  const repeatedGroup = currentCards.some(
    ({ correlationGroup }) => correlationGroup === card.correlationGroup,
  );
  const repeatedSector = currentCards.some(({ sector }) => sector === card.sector);

  if (personality.id === 'momentum') {
    return card.momentumBias * 1.8 + card.volatility * 0.8;
  }
  if (personality.id === 'contrarian') {
    return -card.momentumBias * 1.6 + (1 - card.volatility) * 0.4;
  }
  return card.momentumBias * 0.2
    - card.volatility * 0.7
    + (repeatedGroup ? -0.75 : 0.45)
    + (repeatedSector ? -0.25 : 0.2);
}

export function completeAiDrafts(
  playerPicks: readonly Ticker[],
  cards: readonly StockCard[],
  rng: SeededRng,
): PortfolioMap {
  const portfolioCount = AI_PERSONALITIES.length + 1;
  const requiredCardCount = portfolioCount * FANSTOCKS_RULES.cardsPerPortfolio;
  if (cards.length !== requiredCardCount || validateStocks(cards).length > 0) {
    throw new Error(`Card registry must contain ${requiredCardCount} valid unique cards`);
  }

  const cardByTicker = new Map(cards.map((card) => [card.ticker, card] as const));
  if (
    playerPicks.length !== FANSTOCKS_RULES.cardsPerPortfolio
    || new Set(playerPicks).size !== playerPicks.length
    || playerPicks.some((ticker) => !cardByTicker.has(ticker))
  ) {
    throw new Error('Player draft must contain 3 unique known tickers');
  }

  const available = new Set(
    cards
      .map(({ ticker }) => ticker)
      .filter((ticker) => !playerPicks.includes(ticker)),
  );
  const requiredAiCards = AI_PERSONALITIES.length * FANSTOCKS_RULES.cardsPerPortfolio;
  if (available.size !== requiredAiCards) {
    throw new Error('Card registry must leave exactly 9 cards for AI drafts');
  }

  const picks = new Map(AI_PERSONALITIES.map(({ id }) => [id, [] as Ticker[]]));
  const tieOrder = new Map(
    rng.shuffle([...available]).map((ticker, index) => [ticker, index] as const),
  );

  for (let slot = 0; slot < FANSTOCKS_RULES.cardsPerPortfolio; slot += 1) {
    for (const personality of AI_PERSONALITIES) {
      const current = getPicks(picks, personality.id);
      const currentCards = current.map((ticker) => getCard(cardByTicker, ticker));
      const chosen = [...available].sort((left, right) => {
        const scoreDelta = scoreCardForPersonality(
          personality,
          getCard(cardByTicker, right),
          currentCards,
        ) - scoreCardForPersonality(
          personality,
          getCard(cardByTicker, left),
          currentCards,
        );
        return scoreDelta || getTieIndex(tieOrder, left) - getTieIndex(tieOrder, right);
      })[0];

      if (chosen === undefined) {
        throw new Error('Card registry ran out of cards during AI drafts');
      }
      current.push(chosen);
      available.delete(chosen);
    }
  }

  const portfolio = (
    participantId: Portfolio['participantId'],
    tickers: readonly Ticker[],
  ): Portfolio => Object.freeze({
    participantId,
    tickers: Object.freeze([...tickers]),
  });

  return Object.freeze({
    player: portfolio('player', playerPicks),
    momentum: portfolio('momentum', getPicks(picks, 'momentum')),
    contrarian: portfolio('contrarian', getPicks(picks, 'contrarian')),
    balanced: portfolio('balanced', getPicks(picks, 'balanced')),
  });
}
