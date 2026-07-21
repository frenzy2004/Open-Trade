import type { StockCard, Ticker } from '../content/types'
import { StockArtwork } from './StockArtwork'

export interface StockCardButtonProps {
  stock: StockCard
  onRead: (ticker: Ticker) => void
}

export function StockCardButton({
  stock,
  onRead,
}: StockCardButtonProps) {
  return (
    <button
      className="stock-card"
      type="button"
      aria-label={`Read ${stock.ticker}, ${stock.company}`}
      onClick={() => onRead(stock.ticker)}
    >
      <StockArtwork stock={stock} />
      <strong>{stock.ticker}</strong>
      <span>{stock.company}</span>
    </button>
  )
}
