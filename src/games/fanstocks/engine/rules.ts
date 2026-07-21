export const FANSTOCKS_RULES = Object.freeze({
  rulesetVersion: 1,
  draftRounds: 3,
  candidatesPerRound: 3,
  cardsPerPortfolio: 3,
  startingValue: 50,
  ticksPerDay: 12,
  tradingDays: 5,
  baseTickMs: 5_000,
  incomingTradeTicks: Object.freeze([10, 25, 40] as const),
});

export const TOTAL_MARKET_TICKS =
  FANSTOCKS_RULES.ticksPerDay * FANSTOCKS_RULES.tradingDays;

export const PARTICIPANT_ORDER = Object.freeze([
  'player',
  'momentum',
  'contrarian',
  'balanced',
] as const);

export type ParticipantId = (typeof PARTICIPANT_ORDER)[number];
