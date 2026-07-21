import type { StockCard } from './types';

const SECTORS: readonly StockCard['sector'][] = [
  'consumer', 'energy', 'healthcare', 'industrials', 'small-cap', 'technology',
];
const CORRELATION_GROUPS: readonly StockCard['correlationGroup'][] = [
  'consumer-cycle', 'energy-cycle', 'growth', 'defensive', 'small-cap',
];

export function validateStocks(cards: readonly StockCard[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const stock of cards) {
    const candidate = (
      typeof stock === 'object' && stock !== null ? stock : {}
    ) as Partial<Record<keyof StockCard, unknown>>;
    const ticker = typeof candidate.ticker === 'string' ? candidate.ticker : '';
    const prefix = ticker || '<missing ticker>';
    if (!/^[A-Z]{1,5}$/.test(ticker)) errors.push(`${prefix} ticker must contain 1-5 uppercase letters`);
    if (seen.has(ticker)) errors.push(`${prefix} ticker must be unique`);
    seen.add(ticker);
    if (typeof candidate.company !== 'string' || !candidate.company.trim()) errors.push(`${prefix} company must be non-empty`);
    if (typeof candidate.sector !== 'string' || !SECTORS.includes(candidate.sector as StockCard['sector'])) errors.push(`${prefix} sector must be one of ${SECTORS.join(', ')}`);
    if (typeof candidate.volatility !== 'number' || !Number.isFinite(candidate.volatility) || candidate.volatility < 0 || candidate.volatility > 1) errors.push(`${prefix} volatility must be between 0 and 1`);
    if (typeof candidate.momentumBias !== 'number' || !Number.isFinite(candidate.momentumBias) || candidate.momentumBias < -1 || candidate.momentumBias > 1) errors.push(`${prefix} momentumBias must be between -1 and 1`);
    if (typeof candidate.correlationGroup !== 'string' || !CORRELATION_GROUPS.includes(candidate.correlationGroup as StockCard['correlationGroup'])) errors.push(`${prefix} correlationGroup must be one of ${CORRELATION_GROUPS.join(', ')}`);
    if (typeof candidate.thesis !== 'string' || !candidate.thesis.trim()) errors.push(`${prefix} thesis must be non-empty`);
    if (!Array.isArray(candidate.evidence) || candidate.evidence.length !== 3 || candidate.evidence.some((item) => typeof item !== 'string' || !item.trim())) errors.push(`${prefix} evidence must contain 3 non-empty bullets`);
    if (typeof candidate.artworkKey !== 'string' || !/^[a-z0-9-]+$/.test(candidate.artworkKey)) errors.push(`${prefix} artworkKey must be a safe CSS artwork token`);
    if (candidate.syntheticDemo !== true) errors.push(`${prefix} syntheticDemo must be true`);
  }
  return errors;
}
