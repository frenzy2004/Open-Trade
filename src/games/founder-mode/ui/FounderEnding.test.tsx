import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FounderModeRoute } from '../FounderModeRoute'
import { netflix2011 } from '../content/netflix2011'
import { founderReducer } from '../engine/founderReducer'
import {
  createFounderRun,
  type FounderRunState,
} from '../engine/founderState'
import {
  createFounderStore,
  nextStreak,
} from '../persistence/founderSave'
import { FounderEnding } from './FounderEnding'

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
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function completeRun(finalPhase: 'outcome' | 'ending' = 'ending'): FounderRunState {
  let run = founderReducer(
    createFounderRun(netflix2011, 'classic'),
    { type: 'TAKE_CHAIR' },
    netflix2011,
  )
  for (let index = 0; index < netflix2011.decisions.length; index += 1) {
    const decision = netflix2011.decisions[index]
    const choice = decision?.choices[0]
    if (!choice) throw new Error('Expected complete Netflix content')
    run = founderReducer(
      run,
      { type: 'CHOOSE', choiceId: choice.id },
      netflix2011,
    )
    if (index < netflix2011.decisions.length - 1 || finalPhase === 'ending') {
      run = founderReducer(run, { type: 'NEXT' }, netflix2011)
    }
  }
  return run
}

describe('FounderEnding', () => {
  it('shows score, explainable style mix, five recaps, and cited decision detail', async () => {
    const user = userEvent.setup()
    const onReplay = vi.fn()
    const onOpenArchive = vi.fn()
    const run = completeRun()
    const { container } = render(
      <FounderEnding
        episode={netflix2011}
        run={run}
        streakDays={4}
        onReplay={onReplay}
        onOpenArchive={onOpenArchive}
      />,
    )

    const finalValues = screen.getByRole('group', { name: 'Final valuations' })
    expect(
      within(finalValues).getByText(`$${run.currentValueBn.toFixed(1)}B`),
    ).toBeVisible()
    expect(within(finalValues).getByText('$25.0B')).toBeVisible()
    expect(screen.getByText(/Founder tier:/)).toBeVisible()
    expect(screen.getByText('Founder streak: 4 days')).toBeVisible()
    expect(
      screen.getByText(
        'Your mix is based on the style weights of all five choices',
      ),
    ).toBeVisible()

    const percentages = Array.from(
      container.querySelectorAll<HTMLElement>('.founder-style-stat dd'),
      (node) => Number.parseInt(node.textContent ?? '0', 10),
    )
    expect(percentages).toHaveLength(3)
    expect(percentages.reduce((sum, value) => sum + value, 0)).toBe(100)
    expect(
      screen.getAllByRole('button', { name: /Review decision \d:/ }),
    ).toHaveLength(5)

    await user.click(
      screen.getByRole('button', {
        name: 'Review decision 1: Unbundle and reprice immediately',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Decision 1 recap' })
    expect(
      within(dialog).getByText(/DVD and streaming now have different cost curves/),
    ).toBeVisible()
    expect(
      within(dialog).getByText('Unbundle and reprice immediately'),
    ).toBeVisible()
    expect(within(dialog).getByText('$20.0B → $18.4B')).toBeVisible()
    expect(
      within(dialog).getByRole('link', {
        name: 'Netflix Q1 2011 Letter to Shareholders',
      }),
    ).toHaveAttribute('href', expect.stringContaining('sec.gov'))

    await user.click(
      within(dialog).getByRole('button', { name: 'Close Decision 1 recap' }),
    )

    await user.click(screen.getByRole('button', { name: 'Replay episode' }))
    await user.click(screen.getByRole('button', { name: 'Browse episodes' }))
    expect(onReplay).toHaveBeenCalledTimes(1)
    expect(onOpenArchive).toHaveBeenCalledTimes(1)
  })
})

describe('Founder streak and replay persistence', () => {
  it('uses UTC calendar days and never increments twice on the same date', () => {
    expect(nextStreak(null, 0, '2026-07-21')).toBe(1)
    expect(nextStreak('2026-07-20', 4, '2026-07-21')).toBe(5)
    expect(nextStreak('2026-07-21', 5, '2026-07-21')).toBe(5)
    expect(nextStreak('2026-07-18', 5, '2026-07-21')).toBe(1)
  })

  it('keeps a same-day streak and resets only the active run on replay', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const store = createFounderStore()
    expect(
      store.save({
        schemaVersion: 1,
        selectedEpisodeId: netflix2011.id,
        style: 'classic',
        streakDays: 3,
        lastCompletedDate: today,
        activeRun: completeRun('outcome'),
      }),
    ).toEqual({ ok: true })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FounderModeRoute />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'See your result' }))
    expect(screen.getByText('Founder streak: 3 days')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Replay episode' }))
    expect(screen.getByRole('button', { name: 'Take the chair' })).toBeVisible()
    const loaded = store.load()
    expect(loaded.status).toBe('ready')
    if (loaded.status !== 'ready') throw new Error('Expected ready save')
    expect(loaded.value.streakDays).toBe(3)
    expect(loaded.value.lastCompletedDate).toBe(today)
    expect(loaded.value.activeRun?.phase).toBe('intro')
    expect(loaded.value.activeRun?.history).toEqual([])
  })
})
