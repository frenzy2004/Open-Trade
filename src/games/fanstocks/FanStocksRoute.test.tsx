import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FanStocksController } from './useFanStocksController'
import { createFanStocksState, fanStocksReducer, type FanStocksState } from './engine/fanStocksReducer'
import type { FanStocksResult } from './engine/ranking'
import FanStocksRoute from './FanStocksRoute'

vi.mock('./useFanStocksController', () => ({
  useFanStocksController: () => controller,
}))

function phaseStates() {
  const intro = createFanStocksState('route-test')
  const tutorial = fanStocksReducer(intro, { type: 'START_LEAGUE' })
  let draft = fanStocksReducer(tutorial, { type: 'DISMISS_TUTORIAL' })
  for (let index = 0; index < 3; index += 1) {
    const ticker = draft.draft.groups[draft.draft.roundIndex]?.[0]
    if (ticker === undefined) throw new Error('Expected a draft candidate')
    draft = fanStocksReducer(draft, { type: 'DRAFT', ticker })
  }
  const market = fanStocksReducer(draft, { type: 'AI_DRAFTS_READY' })
  const result: FanStocksResult = {
    rows: [
      { participantId: 'player', rank: 1, value: 55, returnPercent: 10, decisiveTicker: 'XLE', tied: false },
      { participantId: 'momentum', rank: 2, value: 53, returnPercent: 6, decisiveTicker: 'SMCI', tied: false },
      { participantId: 'balanced', rank: 3, value: 51, returnPercent: 2, decisiveTicker: 'BMY', tied: false },
      { participantId: 'contrarian', rank: 4, value: 48, returnPercent: -4, decisiveTicker: 'SBUX', tied: false },
    ],
    winnerIds: ['player'],
    isTie: false,
    acceptedTrades: [],
  }
  const results: FanStocksState = { ...market, phase: 'results', paused: true, result }
  return { intro, tutorial, draft: fanStocksReducer(tutorial, { type: 'DISMISS_TUTORIAL' }), aiDrafting: draft, market, results }
}

const states = phaseStates()
let controller: FanStocksController
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

function controllerFor(state: FanStocksState): FanStocksController {
  return {
    state,
    saveProblem: null,
    reducedMotion: false,
    lastAcceptedTrade: null,
    startLeague: vi.fn(),
    dismissTutorial: vi.fn(),
    openDetail: vi.fn(),
    moveDetail: vi.fn(),
    closeDetail: vi.fn(),
    draft: vi.fn(),
    setPaused: vi.fn(),
    setSpeed: vi.fn(),
    decideIncoming: vi.fn(),
    submitOutgoing: vi.fn(),
    rematch: vi.fn(),
    newLeague: vi.fn(),
    resetBrokenSave: vi.fn(),
  }
}

function renderRoute() {
  return render(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
}

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) { this.setAttribute('open', '') },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) { this.removeAttribute('open') },
  })
})

afterAll(() => {
  if (originalShowModal === undefined) Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  else Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal)
  if (originalClose === undefined) Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  else Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose)
})

beforeEach(() => {
  controller = controllerFor(states.intro)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

afterEach(cleanup)

describe('FanStocksRoute', () => {
  it('composes every controller phase without adding a nested main landmark', () => {
    const { container, rerender } = renderRoute()
    expect(screen.getByRole('button', { name: 'Start drafting' })).toBeVisible()

    controller = controllerFor(states.tutorial)
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeVisible()

    controller = controllerFor(states.draft)
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
    expect(screen.getAllByRole('button', { name: /^Read /u })).toHaveLength(3)

    controller = controllerFor(states.aiDrafting)
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
    expect(screen.getByText('AI opponents are building their portfolios.')).toHaveAttribute('role', 'status')

    controller = controllerFor(states.market)
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Portfolio race' })).toBeVisible()

    controller = controllerFor(states.results)
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
    expect(screen.getByText('Friday close')).toBeVisible()
    expect(container.querySelectorAll('main')).toHaveLength(0)
  })

  it('wires market trade selection, submission, and incoming decisions', () => {
    const pendingTrade = {
      id: 'incoming-1',
      direction: 'incoming' as const,
      opponentId: 'momentum' as const,
      playerGives: states.market.portfolios?.player.tickers[0] ?? 'XLE',
      playerReceives: states.market.portfolios?.momentum.tickers[0] ?? 'SMCI',
      createdAtTick: 0,
    }
    controller = controllerFor({ ...states.market, pendingTrade })
    const { rerender } = renderRoute()

    fireEvent.click(screen.getByRole('button', { name: /^Accept:/u }))
    expect(controller.decideIncoming).toHaveBeenCalledWith('accepted')

    controller = controllerFor(states.market)
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Offer Momentum a trade' }))
    const gives = states.market.portfolios?.player.tickers[0]
    const receives = states.market.portfolios?.momentum.tickers[0]
    expect(gives).toBeDefined()
    expect(receives).toBeDefined()
    if (gives === undefined || receives === undefined) return
    fireEvent.click(screen.getByRole('radio', { name: `Give ${gives}` }))
    fireEvent.click(screen.getByRole('radio', { name: `Receive ${receives}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Send trade offer' }))
    expect(controller.submitOutgoing).toHaveBeenCalledWith('momentum', gives, receives)
  })

  it('reports clipboard success and failure without rejecting the UI action', async () => {
    controller = controllerFor(states.market)
    const { rerender } = renderRoute()
    fireEvent.click(screen.getByRole('button', { name: 'Copy challenge link' }))
    expect(await screen.findByText('Challenge link copied.')).toBeInTheDocument()

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    controller = controllerFor(states.market)
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Copy challenge link' }))
    expect(await screen.findByText('Challenge link could not be copied.')).toBeInTheDocument()
  })

  it('requires explicit reset consent and keeps hub recovery available', async () => {
    controller = {
      ...controllerFor(states.intro),
      saveProblem: { source: 'load', reason: 'corrupt', detail: 'Invalid saved state' },
    }
    renderRoute()

    const dialog = screen.getByRole('dialog', { name: 'FanStocks progress could not be loaded' })
    expect(screen.getByRole('link', { name: 'Return to games' })).toHaveAttribute('href', '/')
    fireEvent.click(screen.getByRole('button', { name: 'Reset FanStocks progress' }))
    expect(controller.resetBrokenSave).not.toHaveBeenCalled()
    expect(screen.getByText('This permanently removes the saved FanStocks league.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }))
    await waitFor(() => expect(controller.resetBrokenSave).toHaveBeenCalledOnce())
    expect(dialog).toBeInTheDocument()
  })

  it('uses source-specific challenge, save, and reset recovery surfaces', async () => {
    controller = {
      ...controllerFor(states.intro),
      saveProblem: { source: 'challenge', reason: 'malformed', detail: 'Bad challenge query' },
    }
    const { rerender } = renderRoute()
    expect(screen.getByRole('dialog', { name: 'FanStocks challenge could not be opened' })).toBeVisible()

    controller = {
      ...controllerFor(states.market),
      saveProblem: { source: 'save', reason: 'storage-unavailable', detail: 'Storage denied' },
    }
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
    const saveAlert = screen.getByRole('alert')
    expect(saveAlert).toHaveTextContent('FanStocks progress could not be saved')
    expect(saveAlert).toHaveTextContent('Your current league remains open')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset and start a new league' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new league' }))
    await waitFor(() => expect(controller.resetBrokenSave).toHaveBeenCalledOnce())

    controller = {
      ...controllerFor(states.market),
      saveProblem: { source: 'reset', reason: 'storage-unavailable', detail: 'Clear denied' },
    }
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('FanStocks progress could not be reset')
    fireEvent.click(screen.getByRole('button', { name: 'Try reset again' }))
    expect(controller.resetBrokenSave).toHaveBeenCalledOnce()
  })

  it('clears open trade and share transactions when an external seed reinitializes', async () => {
    controller = controllerFor(states.market)
    const { rerender } = renderRoute()
    fireEvent.click(screen.getByRole('button', { name: 'Offer Momentum a trade' }))
    expect(screen.getByRole('dialog', { name: 'Offer Momentum a trade' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Copy challenge link' }))
    expect(await screen.findByText('Challenge link copied.')).toBeInTheDocument()

    controller = controllerFor({ ...states.market, seed: 'external-reinit' })
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Offer Momentum a trade' })).not.toBeInTheDocument()
      expect(screen.queryByText('Challenge link copied.')).not.toBeInTheDocument()
    })
  })

  it('offers a safe pass action for malformed incoming trades without disabling the table', () => {
    const malformed = {
      id: 'bad-offer',
      direction: 'incoming' as const,
      opponentId: 'momentum' as const,
      playerGives: 'UNKNOWN',
      playerReceives: 'SMCI',
      createdAtTick: 0,
    }
    controller = controllerFor({
      ...states.market,
      pendingTrade: malformed as FanStocksState['pendingTrade'],
    })
    renderRoute()

    expect(screen.getByRole('status', { name: 'Invalid trade offer' })).toHaveTextContent('Trade offer unavailable.')
    expect(screen.getByRole('button', { name: 'Pause market' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Pass invalid trade offer' }))
    expect(controller.decideIncoming).toHaveBeenCalledWith('passed')
  })

  it('renders a safe recovery status for missing or unknown runtime state', () => {
    controller = { ...controllerFor(states.intro), state: null as unknown as FanStocksState }
    const { rerender } = renderRoute()
    expect(screen.getByText('FanStocks is unavailable.')).toHaveAttribute('role', 'status')

    controller = {
      ...controllerFor(states.intro),
      state: { ...states.intro, phase: 'unknown' } as unknown as FanStocksState,
    }
    rerender(<MemoryRouter><FanStocksRoute /></MemoryRouter>)
    expect(screen.getByText('FanStocks is unavailable.')).toHaveAttribute('role', 'status')
  })
})
