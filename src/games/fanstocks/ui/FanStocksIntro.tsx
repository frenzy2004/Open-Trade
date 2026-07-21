import { Button } from '../../../shared/ui/Button'

export interface FanStocksIntroProps {
  onStart: () => void
}

export function FanStocksIntro({ onStart }: FanStocksIntroProps) {
  return (
    <main className="fanstocks-intro">
      <div className="fanstocks-intro__copy">
        <p className="fanstocks-kicker">OpenTrade</p>
        <h1>Fantasy Stock Leagues</h1>
        <p>
          Draft three stocks. Three AI strategies draft theirs. Highest
          simulated value at Friday close wins.
        </p>
        <p className="fanstocks-disclaimer">
          Synthetic market game — not investment advice.
        </p>
        <Button variant="primary" onClick={onStart}>
          Start drafting
        </Button>
      </div>
      <div className="fanstocks-intro__table" aria-hidden="true">
        <span className="seat seat--momentum">M</span>
        <span className="seat seat--contrarian">C</span>
        <span className="seat seat--balanced">B</span>
        <span className="seat seat--player">You</span>
        <span className="deck">OT</span>
      </div>
    </main>
  )
}
