import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSeededRng } from '../../../shared/rng/seededRng'
import { STOCKS } from '../content/stocks'
import { completeAiDrafts } from '../engine/aiDraft'
import type { TradeEvent, TradeOffer } from '../engine/trades'
import type { PortfolioMap } from '../engine/types'
import { IncomingTradeCard } from './IncomingTradeCard'
import { OutgoingTradeDialog } from './OutgoingTradeDialog'
import { TradeTransferAnimation } from './TradeTransferAnimation'

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

beforeAll(() => {
  if (HTMLDialogElement.prototype.showModal === undefined) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) { this.setAttribute('open', '') },
    })
  }
  if (HTMLDialogElement.prototype.close === undefined) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) { this.removeAttribute('open') },
    })
  }
})

afterAll(() => {
  if (originalShowModal === undefined) Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  else Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal)
  if (originalClose === undefined) Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  else Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const portfolios = completeAiDrafts(
  ['XLE', 'ODFL', 'IWM'],
  STOCKS,
  createSeededRng('trade-ui'),
)
const playerGives = portfolios.player.tickers[0] ?? ''
const playerReceives = portfolios.momentum.tickers[0] ?? ''
const incoming: TradeOffer = {
  id: 'incoming-ui',
  direction: 'incoming',
  opponentId: 'momentum',
  playerGives,
  playerReceives,
  createdAtTick: 10,
}

describe('IncomingTradeCard', () => {
  it('states exact direction and delegates accept, pass, Escape, and backdrop through shared Dialog', () => {
    const onAccept = vi.fn()
    const onPass = vi.fn()
    render(<IncomingTradeCard offer={incoming} onAccept={onAccept} onPass={onPass} />)

    const dialog = screen.getByRole('dialog', { name: 'Momentum offers a trade' })
    expect(within(dialog).getByText('You receive')).toBeVisible()
    expect(within(dialog).getByText(playerReceives)).toBeVisible()
    expect(within(dialog).getByText('You give')).toBeVisible()
    expect(within(dialog).getByText(playerGives)).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', {
      name: `Accept: receive ${playerReceives} and give ${playerGives}`,
    }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pass on trade' }))
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    fireEvent.click(dialog)

    expect(onAccept).toHaveBeenCalledOnce()
    expect(onPass).toHaveBeenCalledTimes(3)
  })

  it('does not expose actions for a malformed runtime offer', () => {
    const malformed = { ...incoming, opponentId: 'stranger', playerGives: '' } as unknown as TradeOffer
    expect(() => render(<IncomingTradeCard offer={malformed} onAccept={vi.fn()} onPass={vi.fn()} />)).not.toThrow()
    expect(screen.getByRole('status')).toHaveTextContent('Trade offer unavailable.')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('OutgoingTradeDialog', () => {
  it('submits one unambiguous legal pair only after both native radio groups are selected', () => {
    const onSubmit = vi.fn()
    render(
      <OutgoingTradeDialog
        open
        opponentId="balanced"
        portfolios={portfolios}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Offer Balanced a trade' })
    const submit = within(dialog).getByRole('button', { name: 'Send trade offer' })
    expect(submit).toBeDisabled()
    const give = portfolios.player.tickers[0] ?? ''
    const receive = portfolios.balanced.tickers[0] ?? ''
    fireEvent.click(within(dialog).getByLabelText(`Give ${give}`))
    fireEvent.click(within(dialog).getByLabelText(`Receive ${receive}`))
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    expect(onSubmit).toHaveBeenCalledWith('balanced', give, receive)
  })

  it('renders no selectable pair for malformed or overlapping portfolios', () => {
    const overlapping = {
      ...portfolios,
      balanced: {
        participantId: 'balanced',
        tickers: [...portfolios.player.tickers],
      },
    } as PortfolioMap

    expect(() => render(
      <OutgoingTradeDialog
        open
        opponentId="balanced"
        portfolios={overlapping}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )).not.toThrow()

    const dialog = screen.getByRole('dialog', { name: 'Offer Balanced a trade' })
    expect(within(dialog).getByText('No legal one-for-one trade is available.')).toBeVisible()
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Send trade offer' })).toBeDisabled()
  })
})

describe('TradeTransferAnimation', () => {
  const event: TradeEvent = { ...incoming, status: 'accepted' }

  it('keeps accepted status while reduced motion removes decorative flight', () => {
    render(<TradeTransferAnimation event={event} reducedMotion />)
    expect(screen.queryByTestId('trade-flight')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      `Trade complete: received ${playerReceives} and gave ${playerGives}`,
    )
  })

  it('removes the flight after 700ms without removing status', () => {
    vi.useFakeTimers()
    render(<TradeTransferAnimation event={event} reducedMotion={false} />)
    expect(screen.getByTestId('trade-flight')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(700))
    expect(screen.queryByTestId('trade-flight')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does not announce a rejected event as complete', () => {
    render(<TradeTransferAnimation event={{ ...event, status: 'rejected' }} reducedMotion={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByTestId('trade-flight')).not.toBeInTheDocument()
  })
})
