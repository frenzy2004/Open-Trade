import type { PriceFrame } from '../engine/priceEngine'
import { marketLabel, portfolioValue } from '../engine/priceEngine'
import { PARTICIPANT_ORDER, type ParticipantId } from '../engine/rules'
import type { PortfolioMap } from '../engine/types'
import { portfolioForDisplay } from './portfolioPresentation'

export interface RaceSeries {
  readonly day: string
  readonly values: Readonly<Record<ParticipantId, readonly number[]>>
}

export function buildRaceSeries(
  portfolios: PortfolioMap,
  frames: readonly PriceFrame[],
): RaceSeries | null {
  if (!Array.isArray(frames) || frames.length === 0) return null
  const output = {} as Record<ParticipantId, readonly number[]>
  try {
    for (const id of PARTICIPANT_ORDER) {
      const portfolio = portfolioForDisplay(portfolios, id)
      if (portfolio === null) return null
      const values: number[] = []
      for (let index = 0; index < frames.length; index += 1) {
        if (!Object.hasOwn(frames, index)) return null
        const frame = frames[index]
        if (frame === undefined) return null
        values.push(portfolioValue(portfolio, frame))
      }
      output[id] = values
    }
    const last = frames.at(-1)
    if (last === undefined) return null
    return { day: marketLabel(last.tick).day, values: output }
  } catch {
    return null
  }
}

export function finalRaceValue(series: RaceSeries, id: ParticipantId): number | null {
  const value = series.values[id].at(-1)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
