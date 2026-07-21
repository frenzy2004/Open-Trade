import { describe, expect, it } from 'vitest';
import type { PriceFrame } from './priceEngine';
import { PARTICIPANT_ORDER } from './rules';
import { buildFanStocksResult, rankPortfolios } from './ranking';
import type { TradeEvent } from './trades';
import type { PortfolioMap } from './types';

const portfolios: PortfolioMap = {
  player: { participantId: 'player', tickers: ['XLE', 'DKNG', 'HUBS'] },
  momentum: { participantId: 'momentum', tickers: ['AMZN', 'ODFL', 'SBUX'] },
  contrarian: { participantId: 'contrarian', tickers: ['LOW', 'MPC', 'IWM'] },
  balanced: { participantId: 'balanced', tickers: ['SMCI', 'CTRI', 'BMY'] },
};

function frameWith(
  overrides: Readonly<Record<string, number>> = {},
): PriceFrame {
  return {
    tick: 60,
    multipliers: Object.fromEntries(
      Object.values(portfolios).flatMap(({ tickers }) => (
        tickers.map((ticker) => [ticker, overrides[ticker] ?? 1])
      )),
    ),
  };
}

function trade(
  id: string,
  status: TradeEvent['status'],
  createdAtTick: number,
): TradeEvent {
  return {
    id,
    direction: 'incoming',
    opponentId: 'momentum',
    playerGives: 'XLE',
    playerReceives: 'AMZN',
    createdAtTick,
    status,
  };
}

describe('rankPortfolios', () => {
  it('ranks displayed cents with competition ranks and stable participant tie order', () => {
    const frame = frameWith({
      XLE: 1.1001,
      AMZN: 1.1002,
      LOW: 0.95,
      SMCI: 0.9,
    });

    const rows = rankPortfolios(portfolios, frame);

    expect(rows.map(({ participantId, rank, value, returnPercent }) => (
      [participantId, rank, value, returnPercent]
    ))).toEqual([
      ['player', 1, 51.67, 3.34],
      ['momentum', 1, 51.67, 3.34],
      ['contrarian', 3, 49.17, -1.66],
      ['balanced', 4, 48.33, -3.34],
    ]);
    expect(rows.map(({ tied }) => tied)).toEqual([true, true, false, false]);
  });

  it('uses the strongest closing card with a lexical ticker tie-break', () => {
    const rows = rankPortfolios(portfolios, frameWith({
      SMCI: 1.2,
      CTRI: 1.2,
      BMY: 0.9,
    }));

    expect(rows[0]).toMatchObject({
      participantId: 'balanced',
      decisiveTicker: 'CTRI',
    });
  });

  it('reports a stable all-way tie', () => {
    const rows = rankPortfolios(portfolios, frameWith());

    expect(rows.map(({ participantId }) => participantId)).toEqual(PARTICIPANT_ORDER);
    expect(rows.map(({ rank }) => rank)).toEqual([1, 1, 1, 1]);
    expect(rows.every(({ tied }) => tied)).toBe(true);
  });

  it('rejects missing and mismatched participant portfolios explicitly', () => {
    const missing = { ...portfolios, balanced: undefined } as unknown as PortfolioMap;
    const mismatched = {
      ...portfolios,
      momentum: { ...portfolios.momentum, participantId: 'contrarian' },
    } as unknown as PortfolioMap;

    expect(() => rankPortfolios(missing, frameWith())).toThrow(
      'Portfolios must contain every FanStocks participant with matching ids',
    );
    expect(() => rankPortfolios(mismatched, frameWith())).toThrow(
      'Portfolios must contain every FanStocks participant with matching ids',
    );
  });

  it.each([
    ['momentum', 'XLE'],
    ['balanced', 'LOW'],
  ] as const)(
    'rejects a cross-participant duplicate introduced in the %s roster',
    (participantId, duplicateTicker) => {
      const corrupted = {
        ...portfolios,
        [participantId]: {
          ...portfolios[participantId],
          tickers: [duplicateTicker, ...portfolios[participantId].tickers.slice(1)],
        },
      } as PortfolioMap;

      expect(new Set(corrupted[participantId].tickers).size).toBe(3);
      expect(() => rankPortfolios(corrupted, frameWith())).toThrow(
        'Portfolios must contain every FanStocks participant with matching ids',
      );
    },
  );

  it.each(['momentum', 'contrarian'] as const)(
    'rejects an invented finite-priced ticker in the %s roster',
    (participantId) => {
      const corrupted = {
        ...portfolios,
        [participantId]: {
          ...portfolios[participantId],
          tickers: ['ZZZZ', ...portfolios[participantId].tickers.slice(1)],
        },
      } as PortfolioMap;
      const frame = {
        ...frameWith(),
        multipliers: { ...frameWith().multipliers, ZZZZ: 1.1 },
      };

      expect(() => rankPortfolios(corrupted, frame)).toThrow(
        'Portfolios must contain every FanStocks participant with matching ids',
      );
    },
  );

  it('rejects missing, malformed, and non-finite price frames explicitly', () => {
    const missingMultiplier = {
      ...frameWith(),
      multipliers: Object.fromEntries(
        Object.entries(frameWith().multipliers).filter(([ticker]) => ticker !== 'XLE'),
      ),
    };
    const nonFinite = frameWith({ XLE: Number.NaN });

    expect(() => rankPortfolios(portfolios, null as unknown as PriceFrame)).toThrow(
      'Price frame must contain a valid tick and finite portfolio multipliers',
    );
    expect(() => rankPortfolios(portfolios, missingMultiplier)).toThrow(
      'Price frame must contain a valid tick and finite portfolio multipliers',
    );
    expect(() => rankPortfolios(portfolios, nonFinite)).toThrow(
      'Price frame must contain a valid tick and finite portfolio multipliers',
    );
  });
});

describe('buildFanStocksResult', () => {
  it('reports all top winners and the correct tie state', () => {
    const tied = buildFanStocksResult(
      portfolios,
      frameWith({ XLE: 1.1, AMZN: 1.1 }),
      [],
    );
    const single = buildFanStocksResult(
      portfolios,
      frameWith({ SMCI: 1.2 }),
      [],
    );

    expect(tied.winnerIds).toEqual(['player', 'momentum']);
    expect(tied.isTie).toBe(true);
    expect(single.winnerIds).toEqual(['balanced']);
    expect(single.isTie).toBe(false);
  });

  it('preserves accepted trade order while omitting passed and rejected events', () => {
    const events = [
      trade('accepted-late', 'accepted', 40),
      trade('passed', 'passed', 10),
      trade('accepted-early', 'accepted', 5),
      trade('rejected', 'rejected', 25),
    ];

    const result = buildFanStocksResult(portfolios, frameWith(), events);

    expect(result.acceptedTrades).toEqual([events[0], events[2]]);
    expect(result.acceptedTrades.map(({ id }) => id)).toEqual([
      'accepted-late',
      'accepted-early',
    ]);
  });

  it('returns deeply frozen result data and immutable accepted trade copies', () => {
    const accepted = trade('accepted', 'accepted', 10);
    const result = buildFanStocksResult(portfolios, frameWith(), [accepted]);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rows)).toBe(true);
    expect(result.rows.every((row) => Object.isFrozen(row))).toBe(true);
    expect(Object.isFrozen(result.winnerIds)).toBe(true);
    expect(Object.isFrozen(result.acceptedTrades)).toBe(true);
    expect(result.acceptedTrades.every((event) => Object.isFrozen(event))).toBe(true);
    expect(result.acceptedTrades[0]).not.toBe(accepted);
    expect(Object.isFrozen(accepted)).toBe(false);
  });

  it('does not mutate portfolio, frame, or trade-log inputs', () => {
    const mutablePortfolios = structuredClone(portfolios);
    const mutableFrame = structuredClone(frameWith({ XLE: 1.05 }));
    const mutableTradeLog = [
      trade('accepted', 'accepted', 10),
      trade('passed', 'passed', 25),
    ];
    const before = structuredClone({
      portfolios: mutablePortfolios,
      frame: mutableFrame,
      tradeLog: mutableTradeLog,
    });

    buildFanStocksResult(mutablePortfolios, mutableFrame, mutableTradeLog);

    expect({
      portfolios: mutablePortfolios,
      frame: mutableFrame,
      tradeLog: mutableTradeLog,
    }).toEqual(before);
    expect(Object.isFrozen(mutablePortfolios)).toBe(false);
    expect(Object.isFrozen(mutableFrame)).toBe(false);
    expect(Object.isFrozen(mutableTradeLog)).toBe(false);
  });

  it('returns a frozen empty accepted-trade recap for an empty log', () => {
    const result = buildFanStocksResult(portfolios, frameWith(), []);

    expect(result.acceptedTrades).toEqual([]);
    expect(Object.isFrozen(result.acceptedTrades)).toBe(true);
  });
});
