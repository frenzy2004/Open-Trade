import type { ParticipantId } from '../engine/rules'

export interface ParticipantPresentation {
  readonly name: string
  readonly strategy: string
  readonly symbol: string
}

export const PARTICIPANT_META: Readonly<Record<ParticipantId, ParticipantPresentation>> = Object.freeze({
  player: Object.freeze({ name: 'You', strategy: 'Your portfolio', symbol: 'YOU' }),
  momentum: Object.freeze({ name: 'Momentum', strategy: 'Trend and upside', symbol: 'M' }),
  contrarian: Object.freeze({ name: 'Contrarian', strategy: 'Laggards and reversals', symbol: 'C' }),
  balanced: Object.freeze({ name: 'Balanced', strategy: 'Diversified risk', symbol: 'B' }),
})
