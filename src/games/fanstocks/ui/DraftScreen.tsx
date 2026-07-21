import { useEffect, useId, useRef } from 'react'
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
const DRAFT_STATE_FIELDS = [
  'groups',
  'roundIndex',
  'picks',
  'inspectedTicker',
  'status',
] as const

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeDisplayTickers(
  value: unknown,
  limit: number,
): readonly Ticker[] {
  if (!Array.isArray(value)) {
    return []
  }

  const tickers: Ticker[] = []
  const seen = new Set<Ticker>()
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      continue
    }

    const candidate: unknown = value[index]
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

interface ExactDraftShape {
  readonly groups: readonly (readonly Ticker[])[]
  readonly roundIndex: number
  readonly picks: readonly Ticker[]
  readonly inspectedTicker: Ticker | null
  readonly status: 'selecting' | 'complete'
}

function exactDraftTopology(
  value: unknown,
): readonly (readonly Ticker[])[] | null {
  if (
    !Array.isArray(value) ||
    value.length !== FANSTOCKS_RULES.draftRounds
  ) {
    return null
  }

  const groups: Ticker[][] = []
  const dealtTickers = new Set<Ticker>()
  for (let groupIndex = 0; groupIndex < value.length; groupIndex += 1) {
    if (!Object.hasOwn(value, groupIndex)) {
      return null
    }

    const rawGroup: unknown = value[groupIndex]
    if (
      !Array.isArray(rawGroup) ||
      rawGroup.length !== CANDIDATE_COUNT
    ) {
      return null
    }

    const group: Ticker[] = []
    const groupTickers = new Set<Ticker>()
    for (
      let tickerIndex = 0;
      tickerIndex < rawGroup.length;
      tickerIndex += 1
    ) {
      if (!Object.hasOwn(rawGroup, tickerIndex)) {
        return null
      }

      const rawTicker: unknown = rawGroup[tickerIndex]
      if (
        typeof rawTicker !== 'string' ||
        !STOCK_BY_TICKER.has(rawTicker) ||
        groupTickers.has(rawTicker) ||
        dealtTickers.has(rawTicker)
      ) {
        return null
      }

      groupTickers.add(rawTicker)
      dealtTickers.add(rawTicker)
      group.push(rawTicker)
    }
    groups.push(group)
  }

  return groups
}

function exactDraftPicks(
  value: unknown,
  expectedLength: number,
  groups: readonly (readonly Ticker[])[],
): readonly Ticker[] | null {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    return null
  }

  const picks: Ticker[] = []
  const pickedTickers = new Set<Ticker>()
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      return null
    }

    const rawPick: unknown = value[index]
    const group = groups[index]
    if (
      typeof rawPick !== 'string' ||
      !STOCK_BY_TICKER.has(rawPick) ||
      pickedTickers.has(rawPick) ||
      group === undefined ||
      !group.includes(rawPick)
    ) {
      return null
    }

    pickedTickers.add(rawPick)
    picks.push(rawPick)
  }

  return picks
}

function exactSelectingRound(
  runtimeDraft: Record<PropertyKey, unknown>,
): number | null {
  if (
    typeof runtimeDraft.roundIndex !== 'number' ||
    !Number.isSafeInteger(runtimeDraft.roundIndex) ||
    runtimeDraft.roundIndex < 0 ||
    runtimeDraft.roundIndex >= FANSTOCKS_RULES.draftRounds
  ) {
    return null
  }

  return runtimeDraft.roundIndex
}

function validateExactDraftShape(
  runtimeDraft: Record<PropertyKey, unknown>,
): ExactDraftShape | null {
  if (!DRAFT_STATE_FIELDS.every((field) => Object.hasOwn(runtimeDraft, field))) {
    return null
  }

  const groups = exactDraftTopology(runtimeDraft.groups)
  if (groups === null) {
    return null
  }

  if (runtimeDraft.status === 'selecting') {
    const roundIndex = exactSelectingRound(runtimeDraft)
    if (roundIndex === null) {
      return null
    }

    const picks = exactDraftPicks(runtimeDraft.picks, roundIndex, groups)
    if (picks === null) {
      return null
    }

    const currentGroup = groups[roundIndex]
    const inspectedTicker = runtimeDraft.inspectedTicker
    if (
      currentGroup === undefined ||
      !(
        inspectedTicker === null ||
        (typeof inspectedTicker === 'string' &&
          currentGroup.includes(inspectedTicker))
      )
    ) {
      return null
    }

    return {
      groups,
      roundIndex,
      picks,
      inspectedTicker,
      status: 'selecting',
    }
  }

  if (
    runtimeDraft.status !== 'complete' ||
    runtimeDraft.roundIndex !== FANSTOCKS_RULES.draftRounds ||
    runtimeDraft.inspectedTicker !== null
  ) {
    return null
  }

  const picks = exactDraftPicks(
    runtimeDraft.picks,
    DRAFT_SLOT_COUNT,
    groups,
  )
  if (picks === null) {
    return null
  }

  return {
    groups,
    roundIndex: FANSTOCKS_RULES.draftRounds,
    picks,
    inspectedTicker: null,
    status: 'complete',
  }
}

function stockCards(tickers: readonly Ticker[]): readonly StockCard[] {
  const stocks: StockCard[] = []
  for (const ticker of tickers) {
    const stock = STOCK_BY_TICKER.get(ticker)
    if (stock !== undefined) {
      stocks.push(stock)
    }
  }
  return stocks
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
  const displayPicks = normalizeDisplayTickers(
    Object.hasOwn(runtimeDraft, 'picks') ? runtimeDraft.picks : undefined,
    DRAFT_SLOT_COUNT,
  )
  const draftedCount = displayPicks.length
  const exactDraft = validateExactDraftShape(runtimeDraft)
  const candidates =
    exactDraft?.status === 'selecting'
      ? stockCards(exactDraft.groups[exactDraft.roundIndex] ?? [])
      : []
  const inspectedTicker =
    exactDraft?.status === 'selecting'
      ? exactDraft.inspectedTicker
      : null
  const detail =
    inspectedTicker === null
      ? null
      : (STOCK_BY_TICKER.get(inspectedTicker) ?? null)
  const label =
    exactDraft === null
      ? 'Draft unavailable'
      : currentDraftLabel(exactDraft)
  const activeRound = exactDraft?.status === 'selecting'
    ? exactDraft.roundIndex
    : null
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousRoundRef = useRef(activeRound)

  useEffect(() => {
    const previousRound = previousRoundRef.current
    previousRoundRef.current = activeRound
    if (
      activeRound !== null
      && previousRound !== null
      && activeRound !== previousRound
    ) {
      headingRef.current?.focus()
    }
  }, [activeRound])

  return (
    <section className="draft-screen" aria-labelledby={headingId}>
      <header className="draft-screen__header">
        <h1 id={headingId} ref={headingRef} tabIndex={-1}>{label}</h1>
        <ProgressBar
          value={draftedCount}
          max={DRAFT_SLOT_COUNT}
          label={`${draftedCount} of ${DRAFT_SLOT_COUNT} stocks drafted`}
        />
      </header>
      <ol className="draft-screen__hand" aria-label="Your drafted stocks">
        {Array.from({ length: DRAFT_SLOT_COUNT }, (_, slot) => (
          <li key={slot}>
            {displayPicks[slot] ?? `Empty slot ${slot + 1}`}
          </li>
        ))}
      </ol>
      <div className="draft-screen__cards">
        {exactDraft?.status === 'complete' ? (
          <p role="status">Draft complete. Preparing the market.</p>
        ) : candidates.length === 0 ? (
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
