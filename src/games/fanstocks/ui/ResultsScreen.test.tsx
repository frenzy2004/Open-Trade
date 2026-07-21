import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { FanStocksResult } from '../engine/ranking'
import { ResultsScreen } from './ResultsScreen'

const result: FanStocksResult = {
  rows: [
    { participantId: 'player', rank: 1, value: 55, returnPercent: 10, decisiveTicker: 'XLE', tied: true },
    { participantId: 'momentum', rank: 1, value: 55, returnPercent: 10, decisiveTicker: 'SMCI', tied: true },
    { participantId: 'balanced', rank: 3, value: 50, returnPercent: 0, decisiveTicker: 'BMY', tied: false },
    { participantId: 'contrarian', rank: 4, value: 48, returnPercent: -4, decisiveTicker: 'SBUX', tied: false },
  ],
  winnerIds: ['player', 'momentum'],
  isTie: true,
  acceptedTrades: [{
    id: 'accepted',
    direction: 'incoming',
    opponentId: 'momentum',
    playerGives: 'ODFL',
    playerReceives: 'SMCI',
    createdAtTick: 10,
    status: 'accepted',
  }],
}

afterEach(cleanup)

it('explains a shared first place and exposes the complete recap', () => {
  render(<ResultsScreen result={result} onRematch={vi.fn()} onNewLeague={vi.fn()} onShare={vi.fn()} />)

  expect(screen.getByRole('heading', { name: 'You tied for first' })).toBeVisible()
  expect(screen.getByText('You received SMCI and gave ODFL.')).toBeVisible()
  expect(screen.getByRole('list', { name: 'Final ranking' }).children).toHaveLength(4)
})

it('offers separate rematch, new league, and challenge actions', () => {
  const onRematch = vi.fn()
  const onNewLeague = vi.fn()
  const onShare = vi.fn()
  render(<ResultsScreen result={result} onRematch={onRematch} onNewLeague={onNewLeague} onShare={onShare} />)

  fireEvent.click(screen.getByRole('button', { name: 'Rematch same table' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start a new league' }))
  fireEvent.click(screen.getByRole('button', { name: 'Copy this challenge' }))

  expect(onRematch).toHaveBeenCalledOnce()
  expect(onNewLeague).toHaveBeenCalledOnce()
  expect(onShare).toHaveBeenCalledOnce()
})

it('announces a sole player win and a sole opponent win', () => {
  const playerRows: FanStocksResult['rows'] = result.rows.map((row) => (
    row.participantId === 'player'
      ? { ...row, tied: false }
      : row.participantId === 'momentum'
        ? { ...row, rank: 2, value: 54, returnPercent: 8, tied: false }
        : row
  ))
  const { rerender } = render(
    <ResultsScreen
      result={{ ...result, rows: playerRows, winnerIds: ['player'], isTie: false }}
      onRematch={vi.fn()}
      onNewLeague={vi.fn()}
      onShare={vi.fn()}
    />,
  )
  expect(screen.getByRole('heading', { name: 'You won the league' })).toBeVisible()

  rerender(
    <ResultsScreen
      result={{
        ...result,
        rows: playerRows.map((row) => row.participantId === 'balanced'
          ? { ...row, rank: 1, value: 56, returnPercent: 12 }
          : row.participantId === 'player'
            ? { ...row, rank: 2, value: 55, returnPercent: 10 }
            : row.participantId === 'momentum'
              ? { ...row, rank: 3, value: 54, returnPercent: 8 }
              : row).sort((left, right) => right.value - left.value),
        winnerIds: ['balanced'],
        isTie: false,
      }}
      onRematch={vi.fn()}
      onNewLeague={vi.fn()}
      onShare={vi.fn()}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Balanced won the league' })).toBeVisible()
})

it('names both opponents when the AI leaders share first place', () => {
  const opponentTie: FanStocksResult = {
    ...result,
    rows: [
      { participantId: 'momentum', rank: 1, value: 55, returnPercent: 10, decisiveTicker: 'SMCI', tied: true },
      { participantId: 'balanced', rank: 1, value: 55, returnPercent: 10, decisiveTicker: 'BMY', tied: true },
      { participantId: 'player', rank: 3, value: 50, returnPercent: 0, decisiveTicker: 'XLE', tied: false },
      { participantId: 'contrarian', rank: 4, value: 48, returnPercent: -4, decisiveTicker: 'SBUX', tied: false },
    ],
    winnerIds: ['momentum', 'balanced'],
  }

  render(<ResultsScreen result={opponentTie} onRematch={vi.fn()} onNewLeague={vi.fn()} onShare={vi.fn()} />)

  expect(screen.getByRole('heading', { name: 'Momentum and Balanced tied for first' })).toBeVisible()
})

it.each([
  ['rows out of descending value order', { ...result, rows: [...result.rows].reverse() }],
  ['a tied flag that disagrees with the final values', {
    ...result,
    rows: result.rows.map((row) => row.participantId === 'player' ? { ...row, tied: false } : row),
  }],
  ['a return that does not match the displayed value', {
    ...result,
    rows: result.rows.map((row) => row.participantId === 'balanced' ? { ...row, returnPercent: 25 } : row),
  }],
  ['duplicate accepted trade ids', {
    ...result,
    acceptedTrades: [result.acceptedTrades[0], result.acceptedTrades[0]],
  }],
  ['an accepted trade outside the market tick range', {
    ...result,
    acceptedTrades: [{ ...result.acceptedTrades[0], createdAtTick: 999 }],
  }],
  ['winner ids reordered away from the final ranking', {
    ...result,
    winnerIds: ['momentum', 'player'],
  }],
])('rejects %s', (_name, malformed) => {
  render(
    <ResultsScreen
      result={malformed as FanStocksResult}
      onRematch={vi.fn()}
      onNewLeague={vi.fn()}
      onShare={vi.fn()}
    />,
  )

  expect(screen.getByRole('heading', { name: 'Results unavailable' })).toBeVisible()
  expect(screen.queryByRole('list', { name: 'Final ranking' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Rematch same table' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Start a new league' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Copy this challenge' })).toBeDisabled()
})

it('does not invent rankings, values, winners, or trades for malformed result data', () => {
  const inheritedRow = Object.create({
    participantId: 'player',
    rank: 1,
    value: 999,
    returnPercent: 999,
    decisiveTicker: 'XLE',
    tied: false,
  }) as FanStocksResult['rows'][number]
  const malformed = {
    rows: [inheritedRow],
    winnerIds: ['intruder'],
    isTie: false,
    acceptedTrades: [{ ...result.acceptedTrades[0], status: 'passed' }],
  } as unknown as FanStocksResult

  render(<ResultsScreen result={malformed} onRematch={vi.fn()} onNewLeague={vi.fn()} onShare={vi.fn()} />)

  expect(screen.getByRole('heading', { name: 'Results unavailable' })).toBeVisible()
  expect(screen.getByText('Final league data is unavailable.')).toBeVisible()
  expect(screen.queryByRole('list', { name: 'Final ranking' })).not.toBeInTheDocument()
  expect(screen.queryByText(/999/)).not.toBeInTheDocument()
  expect(screen.queryByText(/You received/)).not.toBeInTheDocument()
})
