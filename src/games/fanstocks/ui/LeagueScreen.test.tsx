import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeededRng } from '../../../shared/rng/seededRng'
import { STOCKS } from '../content/stocks'
import { completeAiDrafts } from '../engine/aiDraft'
import type { PortfolioMap } from '../engine/types'
import { createInitialPriceFrame, type PriceFrame } from '../engine/priceEngine'
import { LeagueScreen } from './LeagueScreen'

afterEach(cleanup)

const portfolios = completeAiDrafts(
  ['XLE', 'ODFL', 'IWM'],
  STOCKS,
  createSeededRng('league-ui'),
)
const frames = [createInitialPriceFrame(STOCKS)]

const callbacks = () => ({
  onSetPaused: vi.fn(),
  onSetSpeed: vi.fn(),
  onSelectOpponent: vi.fn(),
  onShare: vi.fn(),
})

describe('LeagueScreen', () => {
  it('renders one labelled region, four exact values, and matching chart/table text', () => {
    const { container } = render(
      <main>
        <LeagueScreen
          portfolios={portfolios}
          frames={frames}
          paused={false}
          speed={1}
          pendingTrade={null}
          {...callbacks()}
        />
      </main>,
    )

    expect(container.querySelectorAll('main')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Monday' })).toBeVisible()
    const chart = screen.getByRole('img', {
      name: /Portfolio race through Monday/u,
    })
    expect(chart).toBeVisible()
    const table = screen.getByRole('table', {
      name: 'Current portfolio standings',
    })
    const values = within(table).getAllByText('$50.00')
    expect(values).toHaveLength(4)
    expect(chart).toHaveAccessibleName(
      'Portfolio race through Monday; You 50.00 dollars, Momentum 50.00 dollars, Contrarian 50.00 dollars, Balanced 50.00 dollars',
    )
    expect(container.querySelector("polyline[data-participant='player']")).toHaveAttribute('points', '0.00,50.00')
    expect(within(table).getAllByText('Unchanged')).toHaveLength(4)
  })

  it('uses native pressed controls and delegates exact opponent/speed/pause/share values', () => {
    const handlers = callbacks()
    render(
      <LeagueScreen
        portfolios={portfolios}
        frames={frames}
        paused={false}
        speed={1}
        pendingTrade={null}
        {...handlers}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Offer Momentum a trade' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause market' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set market speed to 4x' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy challenge link' }))

    expect(handlers.onSelectOpponent).toHaveBeenCalledWith('momentum')
    expect(handlers.onSetPaused).toHaveBeenCalledWith(true)
    expect(handlers.onSetSpeed).toHaveBeenCalledWith(4)
    expect(handlers.onShare).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Pause market' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Set market speed to 1x' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('disables outgoing trades while another trade is pending', () => {
    render(
      <LeagueScreen
        portfolios={portfolios}
        frames={frames}
        paused={false}
        speed={2}
        pendingTrade={{
          id: 'pending',
          direction: 'incoming',
          opponentId: 'momentum',
          playerGives: portfolios.player.tickers[0] ?? '',
          playerReceives: portfolios.momentum.tickers[0] ?? '',
          createdAtTick: 10,
        }}
        {...callbacks()}
      />,
    )

    expect(screen.getAllByRole('button', { name: /^Offer .+ a trade$/u })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /^Offer .+ a trade$/u }).every((button) => button.hasAttribute('disabled'))).toBe(true)
    expect(screen.getByRole('button', { name: 'Set market speed to 2x' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Market paused for a trade')).toBeVisible()
  })

  it('does not crash or invent values for empty or malformed runtime snapshots', () => {
    const malformedPortfolios = {
      player: { participantId: 'player', tickers: ['XLE'] },
    } as unknown as PortfolioMap
    const malformedFrames = [{
      tick: Number.NaN,
      multipliers: {},
    }] as unknown as readonly PriceFrame[]

    expect(() => render(
      <LeagueScreen
        portfolios={malformedPortfolios}
        frames={malformedFrames}
        paused={false}
        speed={1}
        pendingTrade={null}
        {...callbacks()}
      />,
    )).not.toThrow()

    expect(screen.getByRole('heading', { name: 'Market unavailable' })).toBeVisible()
    expect(screen.getByText('Portfolio race unavailable.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('$50.00')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Offer .+ a trade$/u }).every((button) => button.hasAttribute('disabled'))).toBe(true)
  })
})
