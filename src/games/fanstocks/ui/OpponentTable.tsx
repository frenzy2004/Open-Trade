import type { AiId } from '../content/types'
import type { PortfolioMap } from '../engine/types'
import { PortfolioHand } from './PortfolioHand'
import { PARTICIPANT_META } from './participantMeta'
import { portfolioForDisplay } from './portfolioPresentation'

const OPPONENT_IDS: readonly AiId[] = Object.freeze(['momentum', 'contrarian', 'balanced'])

export function OpponentTable({ portfolios, values, disabled, onSelect }: {
  readonly portfolios: PortfolioMap
  readonly values: Readonly<Record<AiId, number | null>> | null
  readonly disabled: boolean
  readonly onSelect: (id: AiId) => void
}) {
  return (
    <section className="opponent-table" aria-label="AI opponents">
      {OPPONENT_IDS.map((id) => {
        const portfolio = portfolioForDisplay(portfolios, id)
        return (
          <article className={`opponent-seat opponent-seat--${id}`} key={id}>
            <span className="opponent-seat__avatar" aria-hidden="true">{PARTICIPANT_META[id].symbol}</span>
            <h3>{PARTICIPANT_META[id].name}</h3>
            <p>{PARTICIPANT_META[id].strategy}</p>
            <data className="portfolio-value" value={values?.[id] ?? undefined}>
              {values?.[id] === null || values?.[id] === undefined ? 'Value unavailable' : `$${values[id].toFixed(2)}`}
            </data>
            <PortfolioHand portfolio={portfolio} label={`${PARTICIPANT_META[id].name} hand`} />
            <button
              type="button"
              disabled={disabled || portfolio === null}
              onClick={() => onSelect(id)}
              aria-label={`Offer ${PARTICIPANT_META[id].name} a trade`}
            >
              Offer trade
            </button>
          </article>
        )
      })}
    </section>
  )
}
