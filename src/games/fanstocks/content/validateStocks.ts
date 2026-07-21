import type { StockCard } from './types';

export function validateStocks(cards: readonly StockCard[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const stock of cards) {
    const prefix = stock.ticker || '<missing ticker>';
    if (!/^[A-Z]{1,5}$/.test(stock.ticker)) errors.push(`${prefix} ticker must contain 1-5 uppercase letters`);
    if (seen.has(stock.ticker)) errors.push(`${prefix} ticker must be unique`);
    seen.add(stock.ticker);
    if (!stock.company.trim()) errors.push(`${prefix} company must be non-empty`);
    if (!Number.isFinite(stock.volatility) || stock.volatility < 0 || stock.volatility > 1) errors.push(`${prefix} volatility must be between 0 and 1`);
    if (!Number.isFinite(stock.momentumBias) || stock.momentumBias < -1 || stock.momentumBias > 1) errors.push(`${prefix} momentumBias must be between -1 and 1`);
    if (!stock.thesis.trim()) errors.push(`${prefix} thesis must be non-empty`);
    if (stock.evidence.length !== 3 || stock.evidence.some((item) => !item.trim())) errors.push(`${prefix} evidence must contain 3 non-empty bullets`);
    if (!/^[a-z0-9-]+$/.test(stock.artworkKey)) errors.push(`${prefix} artworkKey must be a safe CSS artwork token`);
    if (stock.syntheticDemo !== true) errors.push(`${prefix} syntheticDemo must be true`);
  }
  return errors;
}
