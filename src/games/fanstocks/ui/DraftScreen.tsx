import { useId } from 'react'
import { ProgressBar } from '../../../shared/ui/ProgressBar'
import { STOCK_BY_TICKER } from '../content/stocks'
import type { StockCard, Ticker } from '../content/types'
import type { DraftState } from '../engine/draftReducer'
import { currentDraftLabel } from '../engine/draftReducer'
import { FANSTOCKS_RULES } from '../engine/rules'
import { StockCardButton } from './StockCardButton'
import { StockDetailDialog } from './StockDetailDialog'

const DRAFT_SLOT_COUNT = FANSTOCKS_RULES.cardsPerPortfolio
const CANDIDATE_COUNT = FANSTOCKS_RULES.candidatesPerRound

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null
}

function canonicalTickers(value: unknown, limit: number): readonly Ticker[] {
  if (!Array.isArray(value)) {
    return []
  }

  const tickers: Ticker[] = []
  const seen = new Set<Ticker>()
  for (const candidate of value) {
    if (
      typeof candidate !== 'string' ||
      !STOCK_BY_TICKER.has(candidate) ||
      seen.has(candidate)
    ) {
      continue
    }

    seen.add(candidate)
    tickers.push(candidate)
    if (tickers.length === limit) {
      break
    }
  }

  return tickers
}

function selectingRoundIndex(
  runtimeDraft: Record<PropertyKey, unknown>,
): number | null {
  if (
    runtimeDraft.status !== 'selecting' ||
    typeof runtimeDraft.roundIndex !== 'number' ||
    !Number.isSafeInteger(runtimeDraft.roundIndex) ||
    runtimeDraft.roundIndex < 0 ||
    runtimeDraft.roundIndex >= FANSTOCKS_RULES.draftRounds
  ) {
    return null
  }

  return runtimeDraft.roundIndex
}

function currentCandidateStocks(
  runtimeDraft: Record<PropertyKey, unknown>,
): readonly StockCard[] {
  const roundIndex = selectingRoundIndex(runtimeDraft)
  if (roundIndex === null) {
    return []
  }

  const tickers = candidateTickersForRound(runtimeDraft, roundIndex)
  const stocks: StockCard[] = []
  for (const ticker of tickers) {
    const stock = STOCK_BY_TICKER.get(ticker)
    if (stock !== undefined) {
      stocks.push(stock)
    }
  }
  return stocks.length === CANDIDATE_COUNT ? stocks : []
}

function candidateTickersForRound(
  runtimeDraft: Record<PropertyKey, unknown>,
  roundIndex: number,
): readonly Ticker[] {
  if (!Array.isArray(runtimeDraft.groups)) {
    return []
  }

  const tickers = canonicalTickers(
    runtimeDraft.groups[roundIndex],
    CANDIDATE_COUNT,
  )
  if (tickers.length !== CANDIDATE_COUNT) {
    return []
  }

  return tickers
}

function completedDraftIsConsistent(
  runtimeDraft: Record<PropertyKey, unknown>,
  picks: readonly Ticker[],
): boolean {
  if (
    runtimeDraft.status !== 'complete' ||
    runtimeDraft.roundIndex !== FANSTOCKS_RULES.draftRounds ||
    picks.length !== DRAFT_SLOT_COUNT
  ) {
    return false
  }

  for (let roundIndex = 0; roundIndex < FANSTOCKS_RULES.draftRounds; roundIndex += 1) {
    const pick = picks[roundIndex]
    if (
      pick === undefined ||
      !candidateTickersForRound(runtimeDraft, roundIndex).includes(pick)
    ) {
      return false
    }
  }

  return true
}

function safeDraftLabel(
  draft: DraftState,
  runtimeDraft: Record<PropertyKey, unknown>,
  picks: readonly Ticker[],
  candidates: readonly StockCard[],
): string {
  if (
    selectingRoundIndex(runtimeDraft) !== null &&
    candidates.length === CANDIDATE_COUNT
  ) {
    return currentDraftLabel(draft)
  }

  if (completedDraftIsConsistent(runtimeDraft, picks)) {
    return currentDraftLabel(draft)
  }

  return 'Draft unavailable'
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
  const headingId = `fanstocks-draft-heading-${useId()}`
  const runtimeDraft: Record<PropertyKey, unknown> = isRecord(draft)
    ? draft
    : {}
  const picks = canonicalTickers(runtimeDraft.picks, DRAFT_SLOT_COUNT)
  const draftedCount = picks.length
  const candidates = currentCandidateStocks(runtimeDraft)
  const inspectedTicker =
    typeof runtimeDraft.inspectedTicker === 'string' &&
    candidates.some(
      (candidate) => candidate.ticker === runtimeDraft.inspectedTicker,
    )
    ? runtimeDraft.inspectedTicker
    : null
  const detail =
    inspectedTicker === null
      ? null
      : (STOCK_BY_TICKER.get(inspectedTicker) ?? null)
  const label = safeDraftLabel(draft, runtimeDraft, picks, candidates)

  return (
    <section className="draft-screen" aria-labelledby={headingId}>
      <header className="draft-screen__header">
        <h1 id={headingId}>{label}</h1>
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
          candidates.map((stock) => (
            <StockCardButton
              key={stock.ticker}
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
    </section>
  )
}
