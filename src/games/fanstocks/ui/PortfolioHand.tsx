import { STOCK_BY_TICKER } from '../content/stocks'
import type { Portfolio } from '../engine/types'

export function PortfolioHand({ portfolio, label }: {
  readonly portfolio: Portfolio | null
  readonly label: string
}) {
  if (portfolio === null) return <p className="portfolio-hand__unavailable">Hand unavailable.</p>
  return (
    <ul className="portfolio-hand" aria-label={label}>
      {portfolio.tickers.map((ticker) => {
        const stock = STOCK_BY_TICKER.get(ticker)
        return stock === undefined ? null : (
          <li key={ticker}>
            <strong>{ticker}</strong>
            <span>{stock.company}</span>
          </li>
        )
      })}
    </ul>
  )
}
