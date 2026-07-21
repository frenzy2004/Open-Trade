import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FounderModeRoute } from '../FounderModeRoute'
import { netflix2011 } from '../content/netflix2011'
import { founderReducer } from '../engine/founderReducer'
import { createFounderRun } from '../engine/founderState'
import { FounderOutcome } from './FounderOutcome'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('Founder Mode decision loop', () => {
  it('plays one complete decision and advances with a semantic valuation chart', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FounderModeRoute />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Play episode' }))
    expect(
      screen.getByText(/Streaming is accelerating, DVDs still finance/),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Take the chair' }))
    expect(screen.getByText('Decision 1 of 5')).toBeVisible()
    expect(
      screen.getByText(/DVD and streaming now have different cost curves/),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', {
        name: 'Grandfather members, then phase by cohort',
      }),
    )

    expect(screen.getByText('Matched history: no')).toBeVisible()
    expect(screen.getByText('Outcome: worked')).toBeVisible()
    expect(
      screen.getByLabelText('Company value $23.2 billion'),
    ).toBeVisible()
    expect(screen.getByText('$20.0B → $23.2B')).toBeVisible()
    expect(screen.getByText('+$3.2B')).toBeVisible()
    const chart = screen.getByRole('figure')
    expect(within(chart).getByText('$25.0B')).toBeVisible()
    expect(within(chart).getByText('$23.2B')).toBeVisible()
    expect(
      screen.getByText(
        'Reality is $25 billion; your company is $23.2 billion after 1 decision.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue to decision 2' }),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'Continue to decision 2' }),
    )
    expect(screen.getByText('Decision 2 of 5')).toBeVisible()
    expect(
      screen.getByText(/Should the DVD service become a separate Qwikster brand/),
    ).toBeVisible()
  })

  it('renders a visible negative signed delta for a losing choice', () => {
    const deciding = founderReducer(
      createFounderRun(netflix2011, 'classic'),
      { type: 'TAKE_CHAIR' },
      netflix2011,
    )
    const outcome = founderReducer(
      deciding,
      { type: 'CHOOSE', choiceId: 'unbundle-now' },
      netflix2011,
    )
    render(
      <FounderOutcome
        episode={netflix2011}
        run={outcome}
        onContinue={() => undefined}
      />,
    )

    expect(screen.getByText('$20.0B → $18.4B')).toBeVisible()
    expect(screen.getByText('−$1.6B')).toBeVisible()
  })
})
