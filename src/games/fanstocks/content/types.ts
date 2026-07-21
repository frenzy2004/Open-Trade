export type Sector =
  | 'consumer' | 'energy' | 'healthcare' | 'industrials'
  | 'small-cap' | 'technology';
export type CorrelationGroup = 'consumer-cycle' | 'energy-cycle' | 'growth' | 'defensive' | 'small-cap';
export type Ticker = string;

export interface StockCard {
  readonly ticker: Ticker;
  readonly company: string;
  readonly sector: Sector;
  readonly volatility: number;
  readonly momentumBias: number;
  readonly correlationGroup: CorrelationGroup;
  readonly thesis: string;
  readonly evidence: readonly [string, string, string];
  readonly artworkKey: string;
  readonly syntheticDemo: true;
}

export type AiId = 'momentum' | 'contrarian' | 'balanced';
export interface AiPersonality {
  readonly id: AiId;
  readonly name: string;
  readonly strategy: string;
  readonly accent: 'orange' | 'violet' | 'cyan';
  readonly tradeThreshold: number;
}
