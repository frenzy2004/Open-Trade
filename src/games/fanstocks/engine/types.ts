import type { Ticker } from '../content/types';
import type { ParticipantId } from './rules';

export interface Portfolio {
  readonly participantId: ParticipantId;
  readonly tickers: readonly Ticker[];
}

export type PortfolioMap = Readonly<Record<ParticipantId, Portfolio>>;
