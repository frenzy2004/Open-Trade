import { useId } from 'react'
import { Button } from '../../../shared/ui/Button'
import { STOCK_BY_TICKER } from '../content/stocks'
import type { FanStocksResult, RankedPortfolio } from '../engine/ranking'
import {
  FANSTOCKS_RULES,
  PARTICIPANT_ORDER,
  TOTAL_MARKET_TICKS,
  type ParticipantId,
} from '../engine/rules'
import type { TradeEvent } from '../engine/trades'
import { PARTICIPANT_META } from './participantMeta'

const ROW_FIELDS = [
  'participantId',
  'rank',
  'value',
  'returnPercent',
  'decisiveTicker',
  'tied',
] as const
const TRADE_FIELDS = [
  'id',
  'direction',
  'opponentId',
  'playerGives',
  'playerReceives',
  'createdAtTick',
  'status',
] as const

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwnFields(
  value: Record<PropertyKey, unknown>,
  fields: readonly string[],
): boolean {
  return fields.every((field) => Object.hasOwn(value, field))
}

function isParticipantId(value: unknown): value is ParticipantId {
  return typeof value === 'string'
    && PARTICIPANT_ORDER.some((participantId) => participantId === value)
}

function validRow(value: unknown): value is RankedPortfolio {
  if (!isRecord(value) || !hasOwnFields(value, ROW_FIELDS)) return false
  return isParticipantId(value.participantId)
    && Number.isSafeInteger(value.rank)
    && (value.rank as number) >= 1
    && (value.rank as number) <= PARTICIPANT_ORDER.length
    && typeof value.value === 'number'
    && Number.isFinite(value.value)
    && typeof value.returnPercent === 'number'
    && Number.isFinite(value.returnPercent)
    && typeof value.decisiveTicker === 'string'
    && STOCK_BY_TICKER.has(value.decisiveTicker)
    && typeof value.tied === 'boolean'
}

function validAcceptedTrade(value: unknown): value is TradeEvent {
  if (!isRecord(value) || !hasOwnFields(value, TRADE_FIELDS)) return false
  return typeof value.id === 'string'
    && value.id.length > 0
    && (value.direction === 'incoming' || value.direction === 'outgoing')
    && isParticipantId(value.opponentId)
    && value.opponentId !== 'player'
    && typeof value.playerGives === 'string'
    && STOCK_BY_TICKER.has(value.playerGives)
    && typeof value.playerReceives === 'string'
    && STOCK_BY_TICKER.has(value.playerReceives)
    && value.playerGives !== value.playerReceives
    && Number.isSafeInteger(value.createdAtTick)
    && (value.createdAtTick as number) >= 0
    && (value.createdAtTick as number) < TOTAL_MARKET_TICKS
    && value.status === 'accepted'
}

function denseArray<T>(value: unknown, predicate: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value)) return false
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index) || !predicate(value[index])) return false
  }
  return true
}

function validResult(value: unknown): value is FanStocksResult {
  if (
    !isRecord(value)
    || !hasOwnFields(value, ['rows', 'winnerIds', 'isTie', 'acceptedTrades'])
    || typeof value.isTie !== 'boolean'
  ) return false
  if (
    !denseArray(value.rows, validRow)
    || !denseArray(value.winnerIds, isParticipantId)
    || !denseArray(value.acceptedTrades, validAcceptedTrade)
  ) return false
  const rows = value.rows
  const winnerIds = value.winnerIds
  const acceptedTrades = value.acceptedTrades
  if (
    rows.length !== PARTICIPANT_ORDER.length
    || new Set(rows.map(({ participantId }) => participantId)).size !== PARTICIPANT_ORDER.length
    || winnerIds.length === 0
    || new Set(winnerIds).size !== winnerIds.length
    || value.isTie !== (winnerIds.length > 1)
    || new Set(acceptedTrades.map(({ id }) => id)).size !== acceptedTrades.length
  ) return false

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (row === undefined) return false
    const expectedRank = rows.findIndex(({ value: candidateValue }) => candidateValue === row.value) + 1
    const expectedTie = rows.some((candidate) => (
      candidate.participantId !== row.participantId
      && candidate.value === row.value
    ))
    const expectedReturn = Math.round(
      (row.value / FANSTOCKS_RULES.startingValue - 1) * 10_000,
    ) / 100
    const previous = rows[index - 1]
    if (
      row.rank !== expectedRank
      || row.tied !== expectedTie
      || row.returnPercent !== expectedReturn
      || (previous !== undefined && (
        previous.value < row.value
        || (
          previous.value === row.value
          && PARTICIPANT_ORDER.indexOf(previous.participantId)
            > PARTICIPANT_ORDER.indexOf(row.participantId)
        )
      ))
    ) return false
  }

  const rankOneIds = rows
    .filter(({ rank }) => rank === 1)
    .map(({ participantId }) => participantId)
  return rankOneIds.length === winnerIds.length
    && rankOneIds.every((participantId, index) => winnerIds[index] === participantId)
}

export interface ResultsScreenProps {
  readonly result: FanStocksResult
  readonly onRematch: () => void
  readonly onNewLeague: () => void
  readonly onShare: () => void
}

export function ResultsScreen({
  result,
  onRematch,
  onNewLeague,
  onShare,
}: ResultsScreenProps) {
  const headingId = `fanstocks-results-heading-${useId()}`
  const safe = validResult(result) ? result : null
  const winner = safe?.winnerIds[0]
  const playerWon = safe?.winnerIds.includes('player') === true
  const opponentTieNames = safe?.winnerIds
    .map((participantId) => PARTICIPANT_META[participantId].name)
    .join(' and ')
  const title = safe === null || winner === undefined
    ? 'Results unavailable'
    : playerWon
      ? safe.isTie ? 'You tied for first' : 'You won the league'
      : safe.isTie
        ? `${opponentTieNames} tied for first`
        : `${PARTICIPANT_META[winner].name} won the league`

  return (
    <section className="results-screen" aria-labelledby={headingId}>
      <p className="fanstocks-kicker">Friday close</p>
      <h1 id={headingId}>{title}</h1>
      {safe === null ? (
        <p role="status">Final league data is unavailable.</p>
      ) : (
        <>
          <p>
            {safe.isTie
              ? 'Equal displayed values share first place.'
              : 'Highest simulated portfolio value wins.'}
          </p>
          <ol className="results-ranking" aria-label="Final ranking">
            {safe.rows.map((row) => (
              <li key={row.participantId} value={row.rank}>
                <strong>{row.rank}. {PARTICIPANT_META[row.participantId].name}</strong>
                <span>
                  ${row.value.toFixed(2)} · {row.returnPercent >= 0 ? '+' : ''}{row.returnPercent.toFixed(2)}%
                </span>
                <span>Strongest close: {row.decisiveTicker}</span>
                {row.tied ? <span>— tied at this value</span> : null}
              </li>
            ))}
          </ol>
          <section aria-labelledby={`${headingId}-trades`}>
            <h2 id={`${headingId}-trades`}>Accepted trade recap</h2>
            {safe.acceptedTrades.length === 0 ? (
              <p>No trades were accepted.</p>
            ) : (
              <ul>
                {safe.acceptedTrades.map((trade) => (
                  <li key={trade.id}>
                    You received {trade.playerReceives} and gave {trade.playerGives}.
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <div className="results-screen__actions">
        <Button variant="primary" disabled={safe === null} onClick={onRematch}>Rematch same table</Button>
        <Button variant="secondary" disabled={safe === null} onClick={onNewLeague}>Start a new league</Button>
        <Button variant="ghost" disabled={safe === null} onClick={onShare}>Copy this challenge</Button>
      </div>
    </section>
  )
}
