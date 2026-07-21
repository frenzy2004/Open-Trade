import type { AiPersonality } from './types';

export const AI_PERSONALITIES: readonly AiPersonality[] = Object.freeze([
  Object.freeze({ id: 'momentum', name: 'Momentum', strategy: 'Chases trend and volatile upside', accent: 'orange', tradeThreshold: 0.01 }),
  Object.freeze({ id: 'contrarian', name: 'Contrarian', strategy: 'Buys laggards and mean reversion', accent: 'violet', tradeThreshold: 0.005 }),
  Object.freeze({ id: 'balanced', name: 'Balanced', strategy: 'Values diversification and smoother risk', accent: 'cyan', tradeThreshold: 0.015 }),
]);
