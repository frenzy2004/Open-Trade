import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FounderModeRoute } from '../FounderModeRoute'

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
    expect(screen.getByText('$23.2B')).toBeVisible()
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
})
