import { ProgressBar } from '../../../shared/ui/ProgressBar'
import { STOCK_BY_TICKER } from '../content/stocks'
import type { StockCard, Ticker } from '../content/types'
import type { DraftState } from '../engine/draftReducer'
import { currentDraftLabel } from '../engine/draftReducer'
import { StockCardButton } from './StockCardButton'
import { StockDetailDialog } from './StockDetailDialog'

const DRAFT_SLOT_COUNT = 3

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null
}

function isTicker(value: unknown): value is Ticker {
  return typeof value === 'string'
}

function isStockCard(value: StockCard | undefined): value is StockCard {
  return value !== undefined
}

function safeDraftLabel(
  draft: DraftState,
  runtimeDraft: Record<PropertyKey, unknown>,
): string {
  if (runtimeDraft.status === 'complete') {
    return currentDraftLabel(draft)
  }

  if (
    runtimeDraft.status === 'selecting' &&
    typeof runtimeDraft.roundIndex === 'number' &&
    Number.isSafeInteger(runtimeDraft.roundIndex)
  ) {
    return currentDraftLabel(draft)
  }

  return 'Draft unavailable'
}

function currentCandidateStocks(
  runtimeDraft: Record<PropertyKey, unknown>,
): readonly StockCard[] {
  if (
    runtimeDraft.status !== 'selecting' ||
    typeof runtimeDraft.roundIndex !== 'number' ||
    !Number.isSafeInteger(runtimeDraft.roundIndex) ||
    runtimeDraft.roundIndex < 0 ||
    !Array.isArray(runtimeDraft.groups)
  ) {
    return []
  }

  const group: unknown = runtimeDraft.groups[runtimeDraft.roundIndex]
  if (!Array.isArray(group)) {
    return []
  }

  return group
    .filter(isTicker)
    .map((ticker) => STOCK_BY_TICKER.get(ticker))
    .filter(isStockCard)
}

export interface DraftScreenProps {
  draft: DraftState
  onOpenDetail: (ticker: Ticker) => void
  onMoveDetail: (direction: -1 | 1) => void
  onCloseDetail: () => void
  onDraft: (ticker: Ticker) => void
}

export function DraftScreen({
  draft,
  onOpenDetail,
  onMoveDetail,
  onCloseDetail,
  onDraft,
}: DraftScreenProps) {
  const runtimeDraft: Record<PropertyKey, unknown> = isRecord(draft)
    ? draft
    : {}
  const picks = Array.isArray(runtimeDraft.picks)
    ? runtimeDraft.picks.filter(isTicker).slice(0, DRAFT_SLOT_COUNT)
    : []
  const draftedCount = picks.length
  const candidates = currentCandidateStocks(runtimeDraft)
  const inspectedTicker = isTicker(runtimeDraft.inspectedTicker)
    ? runtimeDraft.inspectedTicker
    : null
  const detail =
    inspectedTicker === null
      ? null
      : (STOCK_BY_TICKER.get(inspectedTicker) ?? null)

  return (
    <main className="draft-screen">
      <header className="draft-screen__header">
        <h1>{safeDraftLabel(draft, runtimeDraft)}</h1>
        <ProgressBar
          value={draftedCount}
          max={DRAFT_SLOT_COUNT}
          label={`${draftedCount} of ${DRAFT_SLOT_COUNT} stocks drafted`}
        />
      </header>
      <ol className="draft-screen__hand" aria-label="Your drafted stocks">
        {Array.from({ length: DRAFT_SLOT_COUNT }, (_, slot) => (
          <li key={slot}>
            {picks[slot] ?? `Empty slot ${slot + 1}`}
          </li>
        ))}
      </ol>
      <div className="draft-screen__cards">
        {candidates.length === 0 ? (
          <p>No stock cards are available for this draft round.</p>
        ) : (
          candidates.map((stock, index) => (
            <StockCardButton
              key={`${stock.ticker}-${index}`}
              stock={stock}
              onRead={onOpenDetail}
            />
          ))
        )}
      </div>
      <StockDetailDialog
        stock={detail}
        onMove={onMoveDetail}
        onClose={onCloseDetail}
        onDraft={onDraft}
      />
    </main>
  )
}
