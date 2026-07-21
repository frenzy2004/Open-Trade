import { useId } from 'react'
import type { PriceFrame } from '../engine/priceEngine'
import { marketLabel, portfolioValue } from '../engine/priceEngine'
import { PARTICIPANT_ORDER, type ParticipantId } from '../engine/rules'
import type { PortfolioMap } from '../engine/types'
import { PARTICIPANT_META } from './participantMeta'
import { portfolioForDisplay } from './portfolioPresentation'

interface RaceSeries {
  readonly day: string
  readonly values: Readonly<Record<ParticipantId, readonly number[]>>
}

function raceSeries(portfolios: PortfolioMap, frames: readonly PriceFrame[]): RaceSeries | null {
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

function changeLabel(value: number): string {
  if (value === 50) return 'Unchanged'
  return `${value > 50 ? 'Up' : 'Down'} ${Math.abs(value - 50).toFixed(2)} dollars`
}

export function PortfolioRace({ portfolios, frames }: {
  readonly portfolios: PortfolioMap
  readonly frames: readonly PriceFrame[]
}) {
  const titleId = `fanstocks-race-title-${useId()}`
  const series = raceSeries(portfolios, frames)
  if (series === null) return <p>Portfolio race unavailable.</p>

  const finalValues = PARTICIPANT_ORDER.map((id) => ({
    id,
    value: series.values[id].at(-1) ?? Number.NaN,
  }))
  const finiteValues = PARTICIPANT_ORDER.flatMap((id) => [...series.values[id]])
  const min = Math.min(...finiteValues, 50)
  const max = Math.max(...finiteValues, 50)
  const range = max - min
  const points = (id: ParticipantId) => series.values[id].map((value, index) => {
    const x = frames.length === 1 ? 0 : index / (frames.length - 1) * 100
    const y = range === 0 ? 50 : 92 - ((value - min) / range) * 84
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
  const title = `Portfolio race through ${series.day}; ${finalValues.map(({ id, value }) => `${PARTICIPANT_META[id].name} ${value.toFixed(2)} dollars`).join(', ')}`

  return (
    <section className="portfolio-race">
      <svg role="img" aria-labelledby={titleId} viewBox="0 0 100 100" preserveAspectRatio="none">
        <title id={titleId}>{title}</title>
        <line x1="0" y1="50" x2="100" y2="50" className="portfolio-race__baseline" />
        {PARTICIPANT_ORDER.map((id) => (
          <polyline
            key={id}
            data-participant={id}
            data-final-value={finalValues.find((row) => row.id === id)?.value.toFixed(2)}
            points={points(id)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <table aria-label="Current portfolio standings" className="sr-only">
        <thead><tr><th>Portfolio</th><th>Value</th><th>Change</th></tr></thead>
        <tbody>
          {finalValues.map(({ id, value }) => (
            <tr key={id}>
              <th scope="row">{PARTICIPANT_META[id].name}</th>
              <td>${value.toFixed(2)}</td>
              <td>{changeLabel(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
