import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { STOCKS } from '../content/stocks'
import type { StockCard } from '../content/types'
import type { DraftState } from '../engine/draftReducer'
import { DraftScreen } from './DraftScreen'
import { FanStocksIntro } from './FanStocksIntro'
import { StockArtwork } from './StockArtwork'
import { TutorialDialog } from './TutorialDialog'

beforeAll(() => {
  if (HTMLDialogElement.prototype.showModal === undefined) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '')
    }
  }

  if (HTMLDialogElement.prototype.close === undefined) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open')
    }
  }
})

afterEach(() => {
  cleanup()
})

const groups = [
  STOCKS.slice(0, 3).map(({ ticker }) => ticker),
  STOCKS.slice(3, 6).map(({ ticker }) => ticker),
  STOCKS.slice(6, 9).map(({ ticker }) => ticker),
] as const

const selectingDraft: DraftState = {
  groups,
  roundIndex: 0,
  picks: [],
  inspectedTicker: null,
  status: 'selecting',
}

const callbacks = () => ({
  onOpenDetail: vi.fn(),
  onMoveDetail: vi.fn(),
  onCloseDetail: vi.fn(),
  onDraft: vi.fn(),
})

function renderDraft(
  draft: DraftState,
  overrides: Partial<ReturnType<typeof callbacks>> = {},
) {
  const handlers = { ...callbacks(), ...overrides }
  const view = render(<DraftScreen draft={draft} {...handlers} />)
  return { ...view, ...handlers }
}

function expectRenderDoesNotThrow(element: ReactElement) {
  expect(() => render(element)).not.toThrow()
}

describe('FanStocksIntro', () => {
  it('states the complete game premise and investment disclaimer', () => {
    render(<FanStocksIntro onStart={vi.fn()} />)

    expect(
      screen.getByRole('heading', { name: 'Fantasy Stock Leagues' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Draft three stocks. Three AI strategies draft theirs. Highest simulated value at Friday close wins.',
      ),
    ).toBeVisible()
    expect(
      screen.getByText('Synthetic market game — not investment advice.'),
    ).toBeVisible()
  })

  it('starts the game from its native button', () => {
    const onStart = vi.fn()
    render(<FanStocksIntro onStart={onStart} />)

    const start = screen.getByRole('button', { name: 'Start drafting' })
    expect(start).toHaveAttribute('type', 'button')
    fireEvent.click(start)

    expect(onStart).toHaveBeenCalledOnce()
  })
})

describe('TutorialDialog', () => {
  it('accurately explains all four mechanics', () => {
    render(<TutorialDialog open onDismiss={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'How to play' })
    const steps = within(dialog).getAllByRole('listitem')
    expect(steps).toHaveLength(4)
    expect(steps[0]).toHaveTextContent(
      'Pick one stock in each of three rounds. Together they start as your $50 portfolio.',
    )
    expect(steps[1]).toHaveTextContent(
      'Momentum, Contrarian, and Balanced build their own $50 portfolios.',
    )
    expect(steps[2]).toHaveTextContent(
      'Select an opponent to offer a one-for-one stock trade; decide incoming offers with Accept or Pass.',
    )
    expect(steps[3]).toHaveTextContent(
      'The highest simulated portfolio value at Friday close wins. Tied leaders share first place.',
    )
  })

  it('delegates both tutorial dismissal controls', () => {
    const onDismiss = vi.fn()
    render(<TutorialDialog open onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close How to play' }))

    expect(onDismiss).toHaveBeenCalledTimes(2)
  })
})

describe('DraftScreen', () => {
  it('uses the reducer label, progress state, and exactly the current round candidates', () => {
    const draft: DraftState = {
      ...selectingDraft,
      roundIndex: 1,
      picks: ['XLE'],
    }
    const { container } = renderDraft(draft)

    expect(
      screen.getByRole('heading', { name: 'Round 2 of 3 · Pick 1 stock' }),
    ).toBeVisible()
    expect(
      screen.getByRole('progressbar', { name: '1 of 3 stocks drafted' }),
    ).toHaveAttribute('aria-valuenow', '1')
    expect(
      screen.getAllByRole('button', { name: /^Read /u }),
    ).toHaveLength(3)
    expect(
      screen.getByRole('button', { name: "Read AMZN, Amazon" }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', {
        name: 'Read XLE, Energy Select Sector SPDR Fund',
      }),
    ).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-art]')).toHaveLength(3)
  })

  it('renders exactly three drafted slots with filled and empty labels', () => {
    renderDraft({ ...selectingDraft, picks: ['XLE', 'DKNG'] })

    const hand = screen.getByRole('list', { name: 'Your drafted stocks' })
    const slots = within(hand).getAllByRole('listitem')
    expect(slots).toHaveLength(3)
    expect(slots[0]).toHaveTextContent('XLE')
    expect(slots[1]).toHaveTextContent('DKNG')
    expect(slots[2]).toHaveTextContent('Empty slot 3')
  })

  it('opens a stock through its semantic native card button', () => {
    const onOpenDetail = vi.fn()
    renderDraft(selectingDraft, { onOpenDetail })

    const stockButton = screen.getByRole('button', {
      name: 'Read XLE, Energy Select Sector SPDR Fund',
    })
    expect(stockButton).toHaveAttribute('type', 'button')
    fireEvent.click(stockButton)

    expect(onOpenDetail).toHaveBeenCalledOnce()
    expect(onOpenDetail).toHaveBeenCalledWith('XLE')
  })

  it('exposes the selected company, ticker, thesis, and exactly three evidence bullets', () => {
    renderDraft({ ...selectingDraft, inspectedTicker: 'XLE' })

    const dialog = screen.getByRole('dialog', {
      name: 'Energy Select Sector SPDR Fund',
    })
    expect(
      within(dialog).getByText('XLE', {
        selector: '.stock-detail__ticker',
      }),
    ).toBeVisible()
    expect(
      within(dialog).getByText(STOCKS[0]?.thesis ?? ''),
    ).toBeVisible()
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(3)
  })

  it('delegates previous, next, draft, Back, and shared close actions exactly', () => {
    const handlers = callbacks()
    render(<DraftScreen
      draft={{ ...selectingDraft, inspectedTicker: 'XLE' }}
      {...handlers}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Previous stock' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next stock' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draft XLE' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Close Energy Select Sector SPDR Fund',
      }),
    )

    expect(handlers.onMoveDetail.mock.calls).toEqual([[-1], [1]])
    expect(handlers.onDraft).toHaveBeenCalledOnce()
    expect(handlers.onDraft).toHaveBeenCalledWith('XLE')
    expect(handlers.onCloseDetail).toHaveBeenCalledTimes(2)
  })

  it('only delegates wrapped detail movement to the reducer callback', () => {
    const onMoveDetail = vi.fn()
    renderDraft({ ...selectingDraft, inspectedTicker: 'XLE' }, { onMoveDetail })

    fireEvent.click(screen.getByRole('button', { name: 'Previous stock' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next stock' }))

    expect(onMoveDetail.mock.calls).toEqual([[-1], [1]])
    expect(
      screen.getByRole('dialog', {
        name: 'Energy Select Sector SPDR Fund',
      }),
    ).toBeVisible()
  })

  it.each([
    {
      name: 'a completed draft',
      draft: {
        ...selectingDraft,
        roundIndex: 3,
        picks: ['XLE', 'AMZN', 'LOW'],
        status: 'complete' as const,
      },
      heading: 'Draft complete',
    },
    {
      name: 'an out-of-range round',
      draft: { ...selectingDraft, roundIndex: 99 },
      heading: 'Round 100 of 3 · Pick 1 stock',
    },
    {
      name: 'a missing current group',
      draft: { ...selectingDraft, groups: [] },
      heading: 'Round 1 of 3 · Pick 1 stock',
    },
  ])('hides candidate cards without crashing for $name', ({ draft, heading }) => {
    expectRenderDoesNotThrow(<DraftScreen draft={draft} {...callbacks()} />)
    expect(screen.getByRole('heading', { name: heading })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Read /u }),
    ).not.toBeInTheDocument()
  })

  it('hides unknown candidates and an unknown inspected ticker without crashing', () => {
    const draft = {
      ...selectingDraft,
      groups: [['XLE', 'UNKNOWN', 'DKNG'], ...groups.slice(1)],
      inspectedTicker: 'UNKNOWN',
    } satisfies DraftState

    expectRenderDoesNotThrow(<DraftScreen draft={draft} {...callbacks()} />)
    expect(
      screen.getAllByRole('button', { name: /^Read /u }),
    ).toHaveLength(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('survives incomplete runtime arrays and bounds malformed progress', () => {
    const malformed = {
      status: 'selecting',
      roundIndex: Number.NaN,
      groups: undefined,
      picks: undefined,
      inspectedTicker: null,
    } as unknown as DraftState

    expectRenderDoesNotThrow(
      <DraftScreen draft={malformed} {...callbacks()} />,
    )
    expect(
      screen.getByRole('progressbar', { name: '0 of 3 stocks drafted' }),
    ).toHaveAttribute('aria-valuenow', '0')
    expect(
      screen.queryByRole('button', { name: /^Read /u }),
    ).not.toBeInTheDocument()
  })

  it('renders card artwork without image requests', () => {
    const { container } = renderDraft(selectingDraft)

    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(container.querySelectorAll('[data-art]')).toHaveLength(3)
  })
})

describe('StockArtwork', () => {
  it.each([
    { artworkKey: '', label: 'empty' },
    { artworkKey: '../Remote URL?', label: 'unsafe' },
    { artworkKey: undefined, label: 'missing' },
  ])('uses local fallback art for a $label artwork key', ({ artworkKey }) => {
    const stock = {
      ...STOCKS[0],
      artworkKey,
    } as unknown as StockCard
    const { container } = render(<StockArtwork stock={stock} />)

    expect(container.firstElementChild).toHaveAttribute(
      'data-art',
      'fallback',
    )
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })
})
