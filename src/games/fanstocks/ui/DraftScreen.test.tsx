import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import type { ReactElement } from 'react'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createSeededRng } from '../../../shared/rng/seededRng'
import { STOCKS } from '../content/stocks'
import type { StockCard } from '../content/types'
import {
  createDraftState,
  type DraftState,
} from '../engine/draftReducer'
import { DraftScreen } from './DraftScreen'
import { FanStocksIntro } from './FanStocksIntro'
import { StockArtwork } from './StockArtwork'
import { StockDetailDialog } from './StockDetailDialog'
import { TutorialDialog } from './TutorialDialog'

const originalShowModalDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
)
const originalCloseDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
)

beforeAll(() => {
  if (HTMLDialogElement.prototype.showModal === undefined) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      writable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '')
      },
    })
  }

  if (HTMLDialogElement.prototype.close === undefined) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      writable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open')
      },
    })
  }
})

afterAll(() => {
  if (originalShowModalDescriptor === undefined) {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  } else {
    Object.defineProperty(
      HTMLDialogElement.prototype,
      'showModal',
      originalShowModalDescriptor,
    )
  }

  if (originalCloseDescriptor === undefined) {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  } else {
    Object.defineProperty(
      HTMLDialogElement.prototype,
      'close',
      originalCloseDescriptor,
    )
  }

  expect(
    Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      'showModal',
    ),
  ).toEqual(originalShowModalDescriptor)
  expect(
    Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
  ).toEqual(originalCloseDescriptor)
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

function arrayWithInheritedEntries<T>(values: readonly T[]): T[] {
  const sparse = new Array<T>(values.length)
  const prototype = Object.create(Array.prototype) as object
  values.forEach((value, index) => {
    Object.defineProperty(prototype, String(index), {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    })
  })
  Object.setPrototypeOf(sparse, prototype)
  return sparse
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

function expectDraftUnavailable() {
  expect(
    screen.getByRole('heading', { name: 'Draft unavailable' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: /^Read /u }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
}

function expectEmptyDraftSlots() {
  expect(
    screen.getByRole('progressbar', {
      name: '0 of 3 stocks drafted',
    }),
  ).toHaveAttribute('aria-valuenow', '0')
  const hand = screen.getByRole('list', { name: 'Your drafted stocks' })
  expect(
    within(hand).getAllByRole('listitem').map((slot) => slot.textContent),
  ).toEqual(['Empty slot 1', 'Empty slot 2', 'Empty slot 3'])
}

describe('FanStocksIntro', () => {
  it('composes under the app main as a single labelled region', () => {
    const { container } = render(
      <main>
        <FanStocksIntro onStart={vi.fn()} />
      </main>,
    )

    expect(container.querySelectorAll('main')).toHaveLength(1)
    const region = screen.getByRole('region', {
      name: 'Fantasy Stock Leagues',
    })
    const heading = within(region).getByRole('heading', {
      name: 'Fantasy Stock Leagues',
    })
    expect(heading.id).not.toBe('')
    expect(region).toHaveAttribute('aria-labelledby', heading.id)
  })

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
  it('preserves valid frozen reducer state objects', () => {
    const draft = createDraftState(
      STOCKS.map(({ ticker }) => ticker),
      createSeededRng('task-10-frozen-draft'),
    )
    expect(Object.isFrozen(draft)).toBe(true)

    renderDraft(draft)

    expect(
      screen.getByRole('heading', { name: 'Round 1 of 3 · Pick 1 stock' }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: /^Read /u }),
    ).toHaveLength(3)
  })

  it('rejects an array masquerading as a draft object', () => {
    const draft = Object.assign([], selectingDraft) as unknown as DraftState

    expectRenderDoesNotThrow(<DraftScreen draft={draft} {...callbacks()} />)
    expectDraftUnavailable()
  })

  it('rejects inherited draft state fields', () => {
    const inheritedDraft = {
      ...selectingDraft,
      roundIndex: 1,
      picks: ['XLE'],
    } satisfies DraftState
    const draft = Object.create(inheritedDraft) as DraftState

    expectRenderDoesNotThrow(<DraftScreen draft={draft} {...callbacks()} />)
    expectDraftUnavailable()
    expectEmptyDraftSlots()
  })

  it('rejects outer group slots inherited through a custom prototype', () => {
    const draft = {
      ...selectingDraft,
      groups: arrayWithInheritedEntries(groups),
    } satisfies DraftState

    expectRenderDoesNotThrow(<DraftScreen draft={draft} {...callbacks()} />)
    expectDraftUnavailable()
  })

  it('rejects ticker slots inherited by a sparse inner group', () => {
    const inheritedGroup = arrayWithInheritedEntries(groups[0])
    const draft = {
      ...selectingDraft,
      groups: [inheritedGroup, groups[1], groups[2]],
    } satisfies DraftState

    expectRenderDoesNotThrow(<DraftScreen draft={draft} {...callbacks()} />)
    expectDraftUnavailable()
  })

  it('rejects prior picks inherited by a sparse picks array', () => {
    const draft = {
      ...selectingDraft,
      roundIndex: 1,
      picks: arrayWithInheritedEntries(['XLE']),
    } satisfies DraftState

    expectRenderDoesNotThrow(<DraftScreen draft={draft} {...callbacks()} />)
    expectDraftUnavailable()
    expectEmptyDraftSlots()
  })

  it('composes under the app main as a single labelled region', () => {
    const { container } = render(
      <main>
        <DraftScreen draft={selectingDraft} {...callbacks()} />
      </main>,
    )

    expect(container.querySelectorAll('main')).toHaveLength(1)
    const region = screen.getByRole('region', {
      name: 'Round 1 of 3 · Pick 1 stock',
    })
    const heading = within(region).getByRole('heading', {
      name: 'Round 1 of 3 · Pick 1 stock',
    })
    expect(heading.id).not.toBe('')
    expect(region).toHaveAttribute('aria-labelledby', heading.id)
  })

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

  it('normalizes picks to three canonical unique known tickers', () => {
    const malformedPicks = [
      '',
      'XLE',
      'XLE',
      'UNKNOWN',
      'DKNG',
      'HUBS',
      'AMZN',
    ]
    renderDraft({ ...selectingDraft, picks: malformedPicks })

    const progress = screen.getByRole('progressbar', {
      name: '3 of 3 stocks drafted',
    })
    expect(progress).toHaveAttribute('aria-valuenow', '3')
    const hand = screen.getByRole('list', { name: 'Your drafted stocks' })
    expect(
      within(hand).getAllByRole('listitem').map((slot) => slot.textContent),
    ).toEqual(['XLE', 'DKNG', 'HUBS'])
    expectDraftUnavailable()
  })

  it('does not normalize a polluted candidate group into playable controls', () => {
    const draft = {
      ...selectingDraft,
      groups: [
        ['XLE', 'XLE', 'UNKNOWN', 'DKNG', 'HUBS', 'AMZN'],
        ...groups.slice(1),
      ],
    } satisfies DraftState
    renderDraft(draft)

    expectDraftUnavailable()
  })

  it.each([
    {
      name: 'an extra group',
      rawGroups: [
        ...groups,
        STOCKS.slice(9, 12).map(({ ticker }) => ticker),
      ],
    },
    {
      name: 'a truncated non-current group',
      rawGroups: [groups[0], ['AMZN', 'ODFL'], groups[2]],
    },
    {
      name: 'an oversized non-current group',
      rawGroups: [
        groups[0],
        ['AMZN', 'ODFL', 'SBUX', 'SMCI'],
        groups[2],
      ],
    },
    {
      name: 'a duplicate inside a non-current group',
      rawGroups: [groups[0], ['AMZN', 'AMZN', 'SBUX'], groups[2]],
    },
    {
      name: 'an unknown ticker inside a non-current group',
      rawGroups: [groups[0], ['AMZN', 'UNKNOWN', 'SBUX'], groups[2]],
    },
    {
      name: 'an empty ticker inside a non-current group',
      rawGroups: [groups[0], ['AMZN', '', 'SBUX'], groups[2]],
    },
    {
      name: 'a non-string ticker inside a non-current group',
      rawGroups: [groups[0], ['AMZN', null, 'SBUX'], groups[2]],
    },
    {
      name: 'a ticker duplicated across groups',
      rawGroups: [groups[0], ['XLE', 'ODFL', 'SBUX'], groups[2]],
    },
  ])('rejects exact topology with $name', ({ rawGroups }) => {
    const draft = {
      ...selectingDraft,
      groups: rawGroups,
    } as unknown as DraftState
    renderDraft(draft)

    expectDraftUnavailable()
  })

  it.each([
    {
      name: 'round two with no prior pick',
      roundIndex: 1,
      rawPicks: [],
    },
    {
      name: 'a prior pick from the wrong group',
      roundIndex: 1,
      rawPicks: ['AMZN'],
    },
    {
      name: 'an extra pick in round one',
      roundIndex: 0,
      rawPicks: ['XLE'],
    },
    {
      name: 'an unknown raw pick normalized away',
      roundIndex: 1,
      rawPicks: ['XLE', 'UNKNOWN'],
    },
    {
      name: 'a duplicate raw pick normalized away',
      roundIndex: 1,
      rawPicks: ['XLE', 'XLE'],
    },
    {
      name: 'an empty raw pick normalized away',
      roundIndex: 1,
      rawPicks: ['XLE', ''],
    },
    {
      name: 'a missing picks array',
      roundIndex: 0,
      rawPicks: undefined,
    },
  ])('rejects selecting state with $name', ({ roundIndex, rawPicks }) => {
    const draft = {
      ...selectingDraft,
      roundIndex,
      picks: rawPicks,
    } as unknown as DraftState
    renderDraft(draft)

    expectDraftUnavailable()
  })

  it('rejects an inspected ticker outside the exact current group', () => {
    renderDraft({ ...selectingDraft, inspectedTicker: 'AMZN' })

    expectDraftUnavailable()
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

  it('renders repeated evidence without duplicate-key errors', () => {
    const baseStock = STOCKS[0]
    expect(baseStock).toBeDefined()
    if (baseStock === undefined) {
      return
    }

    const repeatedEvidenceStock: StockCard = {
      ...baseStock,
      evidence: ['Repeated evidence', 'Repeated evidence', 'Repeated evidence'],
    }
    const consoleErrors: unknown[][] = []
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        consoleErrors.push(args)
      })

    try {
      render(
        <StockDetailDialog
          stock={repeatedEvidenceStock}
          onMove={vi.fn()}
          onClose={vi.fn()}
          onDraft={vi.fn()}
        />,
      )

      const dialog = screen.getByRole('dialog', {
        name: repeatedEvidenceStock.company,
      })
      expect(within(dialog).getAllByRole('listitem')).toHaveLength(3)
      expect(
        consoleErrors.filter((call) =>
          call.some((part) => String(part).includes('same key')),
        ),
      ).toHaveLength(0)
    } finally {
      consoleError.mockRestore()
    }
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

  it('shows an accessible transition for an exact completed draft', () => {
    const draft: DraftState = {
      ...selectingDraft,
      roundIndex: 3,
      picks: ['XLE', 'AMZN', 'LOW'],
      status: 'complete',
    }
    renderDraft(draft)

    expect(
      screen.getByRole('heading', { name: 'Draft complete' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Read /u }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Draft complete. Preparing the market.',
    )
    expect(
      screen.queryByText('No stock cards are available for this draft round.'),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['negative', -1],
    ['past the last round', 3],
    ['far past the last round', 99],
    ['fractional', 0.5],
    ['NaN', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
  ])('treats a %s selecting round as unavailable', (_name, roundIndex) => {
    const draft = { ...selectingDraft, roundIndex }
    expectRenderDoesNotThrow(<DraftScreen draft={draft} {...callbacks()} />)

    expect(
      screen.getByRole('heading', { name: 'Draft unavailable' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Read /u }),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['missing', []],
    ['short', [['XLE', 'DKNG'], ...groups.slice(1)]],
    ['unknown-heavy', [['XLE', 'UNKNOWN', 'DKNG'], ...groups.slice(1)]],
  ])('treats a %s current candidate group as unavailable', (_name, rawGroups) => {
    const draft = {
      ...selectingDraft,
      groups: rawGroups,
    } as unknown as DraftState
    expectRenderDoesNotThrow(<DraftScreen draft={draft} {...callbacks()} />)

    expect(
      screen.getByRole('heading', { name: 'Draft unavailable' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Read /u }),
    ).not.toBeInTheDocument()
  })

  it.each([
    {
      name: 'the wrong terminal round',
      roundIndex: 2,
      picks: ['XLE', 'AMZN', 'LOW'],
    },
    {
      name: 'too few canonical picks',
      roundIndex: 3,
      picks: ['XLE', 'UNKNOWN'],
    },
  ])('does not claim completion with $name', ({ roundIndex, picks }) => {
    const draft: DraftState = {
      ...selectingDraft,
      roundIndex,
      picks,
      status: 'complete',
    }
    renderDraft(draft)

    expect(
      screen.getByRole('heading', { name: 'Draft unavailable' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Draft complete' }),
    ).not.toBeInTheDocument()
  })

  it.each([
    {
      name: 'missing dealt groups',
      completedGroups: [],
      picks: ['XLE', 'AMZN', 'LOW'],
    },
    {
      name: 'a pick that was not offered in its round',
      completedGroups: groups,
      picks: ['AMZN', 'XLE', 'LOW'],
    },
  ])('does not claim completion with $name', ({ completedGroups, picks }) => {
    const draft: DraftState = {
      ...selectingDraft,
      groups: completedGroups,
      roundIndex: 3,
      picks,
      status: 'complete',
    }
    renderDraft(draft)

    expect(
      screen.getByRole('heading', { name: 'Draft unavailable' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Draft complete' }),
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
      screen.getByRole('heading', { name: 'Draft unavailable' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Read /u }),
    ).not.toBeInTheDocument()
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
      screen.getByRole('heading', { name: 'Draft unavailable' }),
    ).toBeVisible()
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
