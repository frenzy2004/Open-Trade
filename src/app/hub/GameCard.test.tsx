import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { asset } from '../../assets/catalog'
import { FANSTOCKS_METADATA } from '../routes/metadata'
import { GameCard } from './GameCard'

describe('GameCard media', () => {
  it('uses the accepted local Higgsfield cover with useful alternative text', () => {
    render(
      <MemoryRouter>
        <GameCard
          metadata={FANSTOCKS_METADATA}
          badge={{ label: 'League', value: 'Ready', tone: 'neutral' }}
          onHowItWorks={vi.fn()}
          onReset={vi.fn()}
        />
      </MemoryRouter>,
    )

    const cover = screen.getByRole('img', {
      name: FANSTOCKS_METADATA.coverLabel,
    })
    expect(cover.tagName).toBe('IMG')
    expect(cover).toHaveAttribute('src', asset('fs-draft-room').url)
    expect(cover).toHaveAttribute('loading', 'eager')
  })
})
