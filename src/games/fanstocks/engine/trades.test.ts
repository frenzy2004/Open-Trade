import { describe, expect, it } from 'vitest';
import { createSeededRng, type SeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import { STOCKS } from '../content/stocks';
import type { AiId, AiPersonality, StockCard } from '../content/types';
import { completeAiDrafts } from './aiDraft';
import { createInitialPriceFrame, type PriceFrame } from './priceEngine';
import type { PortfolioMap } from './types';
import {
  createIncomingTrade,
  createOutgoingTrade,
  decideOutgoingTrade,
  resolveTrade,
  validateTrade,
  type TradeOffer,
} from './trades';

const portfolios = completeAiDrafts(
  ['XLE', 'ODFL', 'IWM'],
  STOCKS,
  createSeededRng('trade-roster'),
);
const frame = createInitialPriceFrame(STOCKS);

function personality(id: AiPersonality['id']): AiPersonality {
  const match = AI_PERSONALITIES.find((candidate) => candidate.id === id);
  if (match === undefined) throw new Error(`Missing personality fixture: ${id}`);
  return match;
}

function ownedTicker(participantId: keyof PortfolioMap, index: number): string {
  const ticker = portfolios[participantId].tickers[index];
  if (ticker === undefined) {
    throw new Error(`Missing ${participantId} ticker fixture at index ${index}`);
  }
  return ticker;
}

function presentOffer(offer: TradeOffer | null): TradeOffer {
  if (offer === null) throw new Error('Expected a trade offer fixture');
  return offer;
}

function canonicalCard(ticker: string): StockCard {
  const card = STOCKS.find((candidate) => candidate.ticker === ticker);
  if (card === undefined) throw new Error(`Missing canonical card fixture: ${ticker}`);
  return card;
}

function withUnknownRosterTicker(participantId: AiId): PortfolioMap {
  return {
    ...portfolios,
    [participantId]: {
      ...portfolios[participantId],
      tickers: portfolios[participantId].tickers.map((ticker, index) => (
        index === 0 ? `ZZZ${participantId[0]}`.toUpperCase() : ticker
      )),
    },
  };
}

function outgoing(
  opponentId: TradeOffer['opponentId'] = 'momentum',
  createdAtTick = 12,
): TradeOffer {
  return createOutgoingTrade(
    portfolios,
    opponentId,
    ownedTicker('player', 0),
    ownedTicker(opponentId, 0),
    createdAtTick,
  );
}

interface CardSubstitutionCase {
  readonly label: string;
  readonly substitute: (card: StockCard) => StockCard;
  readonly expectedError: string;
}

const STRUCTURAL_CARD_ERROR = 'Card registry must structurally match canonical FanStocks cards';
const VALID_CARD_ERROR = 'Card registry must contain valid unique cards';
const CARD_SUBSTITUTIONS: readonly CardSubstitutionCase[] = [
  {
    label: 'company',
    substitute: (card) => ({ ...card, company: `${card.company} Substitute` }),
    expectedError: STRUCTURAL_CARD_ERROR,
  },
  {
    label: 'sector',
    substitute: (card) => ({
      ...card,
      sector: card.sector === 'technology' ? 'consumer' : 'technology',
    }),
    expectedError: STRUCTURAL_CARD_ERROR,
  },
  {
    label: 'volatility',
    substitute: (card) => ({
      ...card,
      volatility: card.volatility < 0.95 ? card.volatility + 0.01 : card.volatility - 0.01,
    }),
    expectedError: STRUCTURAL_CARD_ERROR,
  },
  {
    label: 'momentumBias',
    substitute: (card) => ({
      ...card,
      momentumBias: card.momentumBias < 0.95
        ? card.momentumBias + 0.01
        : card.momentumBias - 0.01,
    }),
    expectedError: STRUCTURAL_CARD_ERROR,
  },
  {
    label: 'correlationGroup',
    substitute: (card) => ({
      ...card,
      correlationGroup: card.correlationGroup === 'growth' ? 'defensive' : 'growth',
    }),
    expectedError: STRUCTURAL_CARD_ERROR,
  },
  {
    label: 'thesis',
    substitute: (card) => ({ ...card, thesis: `${card.thesis} Substitute.` }),
    expectedError: STRUCTURAL_CARD_ERROR,
  },
  {
    label: 'evidence content',
    substitute: (card) => ({
      ...card,
      evidence: [
        'Substituted evidence bullet',
        card.evidence[1],
        card.evidence[2],
      ],
    }),
    expectedError: STRUCTURAL_CARD_ERROR,
  },
  {
    label: 'evidence order',
    substitute: (card) => ({
      ...card,
      evidence: [card.evidence[1], card.evidence[0], card.evidence[2]],
    }),
    expectedError: STRUCTURAL_CARD_ERROR,
  },
  {
    label: 'artworkKey',
    substitute: (card) => ({ ...card, artworkKey: `${card.artworkKey}-substitute` }),
    expectedError: STRUCTURAL_CARD_ERROR,
  },
  {
    label: 'syntheticDemo',
    substitute: (card) => ({
      ...card,
      syntheticDemo: false,
    }) as unknown as StockCard,
    expectedError: VALID_CARD_ERROR,
  },
];

const OUTGOING_SUBSTITUTION_CASES = CARD_SUBSTITUTIONS.flatMap((substitution) => (
  (['involved', 'unrelated'] as const).map((scope) => ({ ...substitution, scope }))
));

describe('FanStocks trade offers', () => {
  it('creates a valid frozen incoming offer with explicit direction and sides', () => {
    const offer = presentOffer(createIncomingTrade(
      portfolios,
      'momentum',
      STOCKS,
      frame,
      10,
      createSeededRng('incoming'),
    ));

    expect(offer).toEqual({
      id: `in-10-momentum-${offer.playerGives}-${offer.playerReceives}`,
      direction: 'incoming',
      opponentId: 'momentum',
      playerGives: offer.playerGives,
      playerReceives: offer.playerReceives,
      createdAtTick: 10,
    });
    expect(validateTrade(portfolios, offer)).toEqual({ ok: true });
    expect(Object.isFrozen(offer)).toBe(true);
  });

  it('creates a valid frozen outgoing offer only for cards owned by each side', () => {
    const playerGives = ownedTicker('player', 1);
    const playerReceives = ownedTicker('balanced', 0);
    const offer = createOutgoingTrade(
      portfolios,
      'balanced',
      playerGives,
      playerReceives,
      20,
    );

    expect(offer).toEqual({
      id: `out-20-balanced-${playerGives}-${playerReceives}`,
      direction: 'outgoing',
      opponentId: 'balanced',
      playerGives,
      playerReceives,
      createdAtTick: 20,
    });
    expect(Object.isFrozen(offer)).toBe(true);
    expect(validateTrade(portfolios, offer)).toEqual({ ok: true });
  });

  it('rejects outgoing cards not owned by the named sides', () => {
    expect(() => createOutgoingTrade(
      portfolios,
      'balanced',
      ownedTicker('momentum', 0),
      ownedTicker('balanced', 0),
      4,
    )).toThrow(`Player does not own ${ownedTicker('momentum', 0)}`);
    expect(() => createOutgoingTrade(
      portfolios,
      'balanced',
      ownedTicker('player', 0),
      ownedTicker('contrarian', 0),
      4,
    )).toThrow(`balanced does not own ${ownedTicker('contrarian', 0)}`);
  });

  it('returns null instead of forming an offer from missing or non-finite frame data', () => {
    const missingFrame: PriceFrame = {
      ...frame,
      multipliers: Object.fromEntries(
        Object.entries(frame.multipliers).filter(([ticker]) => ticker !== 'XLE'),
      ),
    };
    const nonFiniteFrame: PriceFrame = {
      ...frame,
      multipliers: { ...frame.multipliers, XLE: Number.NaN },
    };

    expect(createIncomingTrade(
      portfolios,
      'momentum',
      STOCKS,
      missingFrame,
      10,
      createSeededRng('missing-frame'),
    )).toBeNull();
    expect(createIncomingTrade(
      portfolios,
      'momentum',
      STOCKS,
      nonFiniteFrame,
      10,
      createSeededRng('non-finite-frame'),
    )).toBeNull();
  });

  it('fails explicitly for malformed or missing card data without producing NaN', () => {
    const malformedCards: readonly StockCard[] = STOCKS.map((card) => (
      card.ticker === 'SMCI' ? { ...card, momentumBias: Number.NaN } : card
    ));
    const missingTicker = ownedTicker('player', 0);
    const missingCards = STOCKS.filter(({ ticker }) => ticker !== missingTicker);

    expect(() => createIncomingTrade(
      portfolios,
      'momentum',
      malformedCards,
      frame,
      10,
      createSeededRng('malformed-card'),
    )).toThrow('Card registry must contain valid unique cards');
    expect(() => createIncomingTrade(
      portfolios,
      'momentum',
      missingCards,
      frame,
      10,
      createSeededRng('missing-card'),
    )).toThrow(`Card registry is missing ${missingTicker}`);
  });

  it.each(['contrarian', 'balanced'] as const)(
    'rejects an unknown canonical ticker on the uninvolved %s roster',
    (participantId) => {
      const invalidPortfolios = withUnknownRosterTicker(participantId);
      const offer = outgoing('momentum');

      expect(validateTrade(invalidPortfolios, offer)).toEqual({
        ok: false,
        reason: 'Portfolios must contain exactly 3 unique tickers each with no duplicates across participants',
      });
    },
  );

  it.each(['contrarian', 'balanced'] as const)(
    'does not create an incoming offer with an unknown ticker on uninvolved %s',
    (participantId) => {
      const invalidPortfolios = withUnknownRosterTicker(participantId);

      expect(() => createIncomingTrade(
        invalidPortfolios,
        'momentum',
        STOCKS,
        frame,
        10,
        createSeededRng(`unknown-${participantId}`),
      )).toThrow(
        'Portfolios must contain exactly 3 unique tickers each with no duplicates across participants',
      );
    },
  );

  it('rejects incomplete and non-canonical registries even for unrelated cards', () => {
    const involvedTickers = new Set([
      ...portfolios.player.tickers,
      ...portfolios.momentum.tickers,
    ]);
    const unrelatedCard = STOCKS.find(({ ticker }) => !involvedTickers.has(ticker));
    if (unrelatedCard === undefined) throw new Error('Missing unrelated card fixture');
    const incompleteCards = STOCKS.filter(({ ticker }) => ticker !== unrelatedCard.ticker);
    const nonCanonicalCards = STOCKS.map((card) => (
      card.ticker === unrelatedCard.ticker
        ? { ...card, ticker: 'ZZZZ', company: 'Unknown Company', artworkKey: 'zzzz' }
        : card
    ));

    for (const cards of [incompleteCards, nonCanonicalCards]) {
      expect(() => createIncomingTrade(
        portfolios,
        'momentum',
        cards,
        frame,
        10,
        createSeededRng('invalid-unrelated-registry'),
      )).toThrow('Card registry must contain all 12 canonical FanStocks cards exactly once');
    }
  });

  it.each([
    [
      'momentumBias',
      (card: StockCard): StockCard => ({
        ...card,
        momentumBias: card.momentumBias + 0.01,
      }),
    ],
    [
      'company content',
      (card: StockCard): StockCard => ({
        ...card,
        company: `${card.company} Substitute`,
      }),
    ],
    [
      'ordered evidence content',
      (card: StockCard): StockCard => ({
        ...card,
        evidence: [
          'Substituted evidence bullet',
          card.evidence[1],
          card.evidence[2],
        ],
      }),
    ],
  ] as const)(
    'rejects a same-ticker canonical record with altered %s',
    (_label, substitute) => {
      const amzn = canonicalCard('AMZN');
      const substitutedCards = STOCKS.map((card) => (
        card.ticker === amzn.ticker ? substitute(card) : card
      ));

      expect(() => createIncomingTrade(
        portfolios,
        'momentum',
        substitutedCards,
        frame,
        10,
        createSeededRng('substituted-card'),
      )).toThrow('Card registry must structurally match canonical FanStocks cards');
    },
  );

  it('accepts a registry of structurally equal deep clones', () => {
    const clonedCards: readonly StockCard[] = STOCKS.map((card) => ({
      ...card,
      evidence: [...card.evidence],
    }));

    const offer = createIncomingTrade(
      portfolios,
      'momentum',
      clonedCards,
      frame,
      10,
      createSeededRng('structural-clones'),
    );

    expect(offer).not.toBeNull();
    for (const [index, clone] of clonedCards.entries()) {
      expect(clone).not.toBe(STOCKS[index]);
      expect(clone.evidence).not.toBe(STOCKS[index]?.evidence);
    }
  });

  it('validates malformed offers and rosters without throwing', () => {
    const offer = outgoing();
    const duplicateRoster = {
      ...portfolios,
      balanced: {
        ...portfolios.balanced,
        tickers: [
          ownedTicker('balanced', 0),
          ownedTicker('balanced', 0),
          ownedTicker('balanced', 2),
        ],
      },
    } as PortfolioMap;

    expect(validateTrade(
      portfolios,
      { ...offer, direction: 'sideways' } as unknown as TradeOffer,
    ))
      .toEqual({ ok: false, reason: 'Trade direction must be incoming or outgoing' });
    expect(validateTrade(
      portfolios,
      { ...offer, opponentId: 'player' } as unknown as TradeOffer,
    ))
      .toEqual({ ok: false, reason: 'Trade opponent must be a known AI participant' });
    expect(validateTrade(portfolios, { ...offer, id: '' }))
      .toEqual({ ok: false, reason: 'Trade id must be non-empty' });
    expect(validateTrade(portfolios, { ...offer, createdAtTick: Number.NaN }))
      .toEqual({ ok: false, reason: 'Trade tick must be a non-negative safe integer' });
    expect(validateTrade(portfolios, { ...offer, playerReceives: offer.playerGives }))
      .toEqual({ ok: false, reason: 'Trade cards must be different' });
    expect(validateTrade(duplicateRoster, offer))
      .toEqual({ ok: false, reason: 'Portfolios must contain exactly 3 unique tickers each with no duplicates across participants' });
  });
});

describe('outgoing FanStocks trade decisions', () => {
  it('is deterministic and personality-sensitive', () => {
    const momentumOffer: TradeOffer = {
      id: 'm',
      direction: 'outgoing',
      opponentId: 'momentum',
      playerGives: 'SMCI',
      playerReceives: 'BMY',
      createdAtTick: 8,
    };
    const contrarianOffer: TradeOffer = {
      ...momentumOffer,
      id: 'c',
      opponentId: 'contrarian',
    };

    expect(decideOutgoingTrade(
      momentumOffer,
      personality('momentum'),
      STOCKS,
      createSeededRng('decision'),
    )).toBe('accepted');
    expect(decideOutgoingTrade(
      contrarianOffer,
      personality('contrarian'),
      STOCKS,
      createSeededRng('decision'),
    )).toBe('rejected');
    expect(decideOutgoingTrade(
      momentumOffer,
      personality('momentum'),
      STOCKS,
      createSeededRng('decision'),
    )).toBe(decideOutgoingTrade(
      momentumOffer,
      personality('momentum'),
      STOCKS,
      createSeededRng('decision'),
    ));
  });

  it.each(OUTGOING_SUBSTITUTION_CASES)(
    'rejects a $scope same-ticker substitution of $label',
    ({ scope, substitute, expectedError }) => {
      const offer = outgoing();
      const unrelated = STOCKS.find(({ ticker }) => (
        ticker !== offer.playerGives && ticker !== offer.playerReceives
      ));
      if (unrelated === undefined) throw new Error('Missing unrelated card fixture');
      const targetTicker = scope === 'involved' ? offer.playerGives : unrelated.ticker;
      const substitutedCards = STOCKS.map((card) => (
        card.ticker === targetTicker ? substitute(card) : card
      ));

      expect(() => decideOutgoingTrade(
        offer,
        personality('momentum'),
        substitutedCards,
        createSeededRng(`outgoing-${scope}-${targetTicker}`),
      )).toThrow(expectedError);
    },
  );

  it.each(['incomplete', 'duplicate', 'unknown'] as const)(
    'rejects a $kind outgoing card registry',
    (kind) => {
      const offer = outgoing();
      const unrelated = STOCKS.find(({ ticker }) => (
        ticker !== offer.playerGives && ticker !== offer.playerReceives
      ));
      if (unrelated === undefined) throw new Error('Missing unrelated card fixture');
      const duplicate = STOCKS.find(({ ticker }) => ticker !== unrelated.ticker);
      if (duplicate === undefined) throw new Error('Missing duplicate card fixture');

      const cards: readonly StockCard[] = kind === 'incomplete'
        ? STOCKS.filter(({ ticker }) => ticker !== unrelated.ticker)
        : STOCKS.map((card) => {
          if (card.ticker !== unrelated.ticker) return card;
          if (kind === 'duplicate') return duplicate;
          return {
            ...card,
            ticker: 'ZZZZ',
            company: 'Unknown Company',
            artworkKey: 'zzzz',
          };
        });
      const expectedError = kind === 'duplicate'
        ? VALID_CARD_ERROR
        : 'Card registry must contain all 12 canonical FanStocks cards exactly once';

      expect(() => decideOutgoingTrade(
        offer,
        personality('momentum'),
        cards,
        createSeededRng(`outgoing-${kind}`),
      )).toThrow(expectedError);
    },
  );

  it('accepts structurally equal deep card clones for outgoing decisions', () => {
    const offer = outgoing();
    const clonedCards: readonly StockCard[] = STOCKS.map((card) => ({
      ...card,
      evidence: [...card.evidence],
    }));

    const cloneDecision = decideOutgoingTrade(
      offer,
      personality('momentum'),
      clonedCards,
      createSeededRng('outgoing-clones'),
    );
    const canonicalDecision = decideOutgoingTrade(
      offer,
      personality('momentum'),
      STOCKS,
      createSeededRng('outgoing-clones'),
    );

    expect(cloneDecision).toBe(canonicalDecision);
    for (const [index, clone] of clonedCards.entries()) {
      expect(clone).not.toBe(STOCKS[index]);
      expect(clone.evidence).not.toBe(STOCKS[index]?.evidence);
    }
  });

  it('uses an offer-id fork for jitter without consuming the session RNG', () => {
    const offer: TradeOffer = {
      id: 'jitter-offer',
      direction: 'outgoing',
      opponentId: 'balanced',
      playerGives: 'LOW',
      playerReceives: 'BMY',
      createdAtTick: 9,
    };
    const forkLabels: string[] = [];
    const forked = createSeededRng('forked');
    const rng: SeededRng = {
      seed: 1,
      next: () => { throw new Error('session RNG must not be consumed'); },
      int: () => { throw new Error('session RNG must not be consumed'); },
      pick: () => { throw new Error('session RNG must not be consumed'); },
      shuffle: () => { throw new Error('session RNG must not be consumed'); },
      fork: (label) => {
        forkLabels.push(label);
        return forked;
      },
    };

    const decision = decideOutgoingTrade(offer, personality('balanced'), STOCKS, rng);

    expect(['accepted', 'rejected']).toContain(decision);
    expect(forkLabels).toEqual([offer.id]);
  });

  it('guards outgoing direction, opponent personality, card data, and RNG samples', () => {
    const offer = outgoing();
    const missingCards = STOCKS.filter(({ ticker }) => ticker !== offer.playerGives);
    const badRng = createSeededRng('bad-jitter');
    const invalidForkRng: SeededRng = {
      ...badRng,
      fork: () => ({ ...badRng, next: () => Number.NaN }),
    };

    expect(() => decideOutgoingTrade(
      { ...offer, direction: 'incoming' },
      personality('momentum'),
      STOCKS,
      createSeededRng('wrong-direction'),
    )).toThrow('AI decisions require an outgoing trade offer');
    expect(() => decideOutgoingTrade(
      offer,
      personality('contrarian'),
      STOCKS,
      createSeededRng('wrong-personality'),
    )).toThrow('Trade personality must match the opponent');
    expect(() => decideOutgoingTrade(
      offer,
      personality('momentum'),
      missingCards,
      createSeededRng('missing-decision-card'),
    )).toThrow(`Card registry is missing ${offer.playerGives}`);
    expect(() => decideOutgoingTrade(
      offer,
      personality('momentum'),
      STOCKS,
      invalidForkRng,
    )).toThrow('Trade jitter must be a finite number from 0 inclusive to 1 exclusive');
    expect(() => decideOutgoingTrade(
      null as unknown as TradeOffer,
      personality('momentum'),
      STOCKS,
      createSeededRng('missing-offer'),
    )).toThrow('AI decisions require an outgoing trade offer');
    expect(() => decideOutgoingTrade(
      offer,
      null as unknown as AiPersonality,
      STOCKS,
      createSeededRng('missing-personality'),
    )).toThrow('Trade personality must be valid');
  });
});

describe('FanStocks trade resolution', () => {
  it.each(['passed', 'rejected'] as const)(
    '%s preserves the portfolio identity and returns an immutable event',
    (status) => {
      const offer = outgoing('balanced', 20);
      const resolution = resolveTrade(portfolios, offer, status);

      expect(resolution.portfolios).toBe(portfolios);
      expect(resolution.event).toEqual({ ...offer, status });
      expect(Object.isFrozen(resolution)).toBe(true);
      expect(Object.isFrozen(resolution.event)).toBe(true);
    },
  );

  it('accept swaps exactly two cards and preserves roster conservation', () => {
    const offer = outgoing('momentum', 12);
    const beforeSnapshot = JSON.stringify(portfolios);
    const beforeTickers = Object.values(portfolios)
      .flatMap(({ tickers }) => tickers)
      .sort();

    const resolution = resolveTrade(portfolios, offer, 'accepted');
    const afterTickers = Object.values(resolution.portfolios)
      .flatMap(({ tickers }) => tickers)
      .sort();

    expect(resolution.event).toEqual({ ...offer, status: 'accepted' });
    expect(resolution.portfolios.player.tickers).toEqual(
      portfolios.player.tickers.map((ticker) => (
        ticker === offer.playerGives ? offer.playerReceives : ticker
      )),
    );
    expect(resolution.portfolios.momentum.tickers).toEqual(
      portfolios.momentum.tickers.map((ticker) => (
        ticker === offer.playerReceives ? offer.playerGives : ticker
      )),
    );
    expect(resolution.portfolios.contrarian).toBe(portfolios.contrarian);
    expect(resolution.portfolios.balanced).toBe(portfolios.balanced);
    expect(afterTickers).toEqual(beforeTickers);
    expect(Object.values(resolution.portfolios).map(({ tickers }) => tickers.length))
      .toEqual([3, 3, 3, 3]);
    expect(new Set(afterTickers).size).toBe(afterTickers.length);
    expect(JSON.stringify(portfolios)).toBe(beforeSnapshot);
    expect(Object.isFrozen(resolution)).toBe(true);
    expect(Object.isFrozen(resolution.event)).toBe(true);
    expect(Object.isFrozen(resolution.portfolios)).toBe(true);
    for (const portfolio of Object.values(resolution.portfolios)) {
      expect(Object.isFrozen(portfolio)).toBe(true);
      expect(Object.isFrozen(portfolio.tickers)).toBe(true);
    }
  });

  it('rejects invalid offers and statuses without mutating portfolios', () => {
    const offer = outgoing();
    const beforeSnapshot = JSON.stringify(portfolios);

    expect(() => resolveTrade(
      portfolios,
      { ...offer, playerGives: 'ZZZZ' },
      'accepted',
    )).toThrow('Player does not own ZZZZ');
    expect(() => resolveTrade(portfolios, offer, 'cancelled' as never))
      .toThrow('Trade status must be accepted, passed, or rejected');
    expect(JSON.stringify(portfolios)).toBe(beforeSnapshot);
  });
});
