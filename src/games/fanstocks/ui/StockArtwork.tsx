import type { StockCard } from '../content/types'

const LOCAL_ARTWORK_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

function localArtworkKey(value: unknown): string {
  if (typeof value !== 'string') {
    return 'fallback'
  }

  const normalized = value.trim().toLowerCase()
  return LOCAL_ARTWORK_KEY.test(normalized) ? normalized : 'fallback'
}

export interface StockArtworkProps {
  stock: StockCard
}

export function StockArtwork({ stock }: StockArtworkProps) {
  return (
    <div
      className="stock-art"
      data-art={localArtworkKey(stock.artworkKey)}
      aria-hidden="true"
    >
      <span>{stock.ticker}</span>
    </div>
  )
}
