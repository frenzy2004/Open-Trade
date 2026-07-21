import { useId } from 'react'
import { Button } from '../../../shared/ui/Button'
import type { AiId } from '../content/types'
import type { MarketSpeed } from '../engine/fanStocksReducer'
import type { PriceFrame } from '../engine/priceEngine'
import { marketLabel } from '../engine/priceEngine'
import { PARTICIPANT_ORDER } from '../engine/rules'
import type { TradeOffer } from '../engine/trades'
import type { PortfolioMap } from '../engine/types'
import { MarketControls } from './MarketControls'
import { OpponentTable } from './OpponentTable'
import { PortfolioHand } from './PortfolioHand'
import { PortfolioRace } from './PortfolioRace'
import { portfolioForDisplay } from './portfolioPresentation'

function latestMarket(frames: readonly PriceFrame[]) {
  if (!Array.isArray(frames) || frames.length === 0 || !Object.hasOwn(frames, frames.length - 1)) return null
  const frame = frames.at(-1)
  if (frame === undefined) return null
  try {
    return marketLabel(frame.tick)
  } catch {
    return null
  }
}

export interface LeagueScreenProps {
  readonly portfolios: PortfolioMap
  readonly frames: readonly PriceFrame[]
  readonly paused: boolean
  readonly speed: MarketSpeed
  readonly pendingTrade: TradeOffer | null
  readonly onSetPaused: (value: boolean) => void
  readonly onSetSpeed: (value: MarketSpeed) => void
  readonly onSelectOpponent: (id: AiId) => void
  readonly onShare: () => void
}

export function LeagueScreen({
  portfolios,
  frames,
  paused,
  speed,
  pendingTrade,
  onSetPaused,
  onSetSpeed,
  onSelectOpponent,
  onShare,
}: LeagueScreenProps) {
  const headingId = `fanstocks-league-heading-${useId()}`
  const market = latestMarket(frames)
  const validPortfolios = PARTICIPANT_ORDER.every((id) => portfolioForDisplay(portfolios, id) !== null)
  const unavailable = market === null || !validPortfolios
  const heading = unavailable ? 'Market unavailable' : market.day
  const status = unavailable
    ? 'Portfolio data unavailable'
    : market.closed
      ? 'Market closed'
      : pendingTrade !== null
        ? 'Market paused for a trade'
        : paused
          ? 'Market paused'
          : 'Synthetic market open'

  return (
    <section className="league-screen" aria-labelledby={headingId}>
      <header>
        <div>
          <p className="fanstocks-kicker">Fantasy Stock Leagues</p>
          <h1 id={headingId}>{heading}</h1>
          <p>{status}</p>
        </div>
        <Button variant="primary" onClick={onShare}>Copy challenge link</Button>
      </header>
      <div className="league-screen__board">
        <OpponentTable
          portfolios={portfolios}
          disabled={unavailable || pendingTrade !== null || market?.closed === true}
          onSelect={onSelectOpponent}
        />
        <span className="league-screen__deck" aria-hidden="true">OT</span>
      </div>
      <aside className="league-screen__race" aria-label="Portfolio race and controls">
        <h2>Portfolio race</h2>
        <PortfolioRace portfolios={portfolios} frames={frames} />
        <MarketControls
          paused={paused}
          speed={speed}
          disabled={unavailable || market?.closed === true}
          onSetPaused={onSetPaused}
          onSetSpeed={onSetSpeed}
        />
      </aside>
      <section className="league-screen__player" aria-label="Your portfolio">
        <h2>Your portfolio</h2>
        <PortfolioHand portfolio={portfolioForDisplay(portfolios, 'player')} label="Your hand" />
      </section>
    </section>
  )
}
