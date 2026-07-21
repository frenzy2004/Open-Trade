import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import type { StockCard, Ticker } from '../content/types'
import { StockArtwork } from './StockArtwork'

export interface StockDetailDialogProps {
  stock: StockCard | null
  onMove: (direction: -1 | 1) => void
  onClose: () => void
  onDraft: (ticker: Ticker) => void
}

export function StockDetailDialog({
  stock,
  onMove,
  onClose,
  onDraft,
}: StockDetailDialogProps) {
  return (
    <Dialog
      open={stock !== null}
      onClose={onClose}
      title={stock?.company ?? 'Stock detail'}
      description={
        stock === null
          ? 'No stock selected'
          : `${stock.ticker}, synthetic game card`
      }
    >
      {stock === null ? null : (
        <div className="stock-detail">
          <StockArtwork stock={stock} />
          <p className="stock-detail__ticker">{stock.ticker}</p>
          <h3>{stock.thesis}</h3>
          <ul>
            {stock.evidence.map((bullet, index) => (
              <li key={`${index}-${bullet}`}>{bullet}</li>
            ))}
          </ul>
          <div className="stock-detail__nav">
            <Button
              variant="ghost"
              aria-label="Previous stock"
              onClick={() => onMove(-1)}
            >
              ←
            </Button>
            <Button
              variant="ghost"
              aria-label="Next stock"
              onClick={() => onMove(1)}
            >
              →
            </Button>
          </div>
          <Button variant="primary" onClick={() => onDraft(stock.ticker)}>
            Draft {stock.ticker}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Back
          </Button>
        </div>
      )}
    </Dialog>
  )
}
