import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useState } from 'react'
import { FounderModeRoute } from '../FounderModeRoute'
import { apple1997 } from '../content/apple1997'
import { founderEpisodes } from '../content/episodes'
import { netflix2011 } from '../content/netflix2011'
import { FOUNDER_SAVE_KEY } from '../persistence/founderSave'
import { EpisodeArchive } from './EpisodeArchive'
import { FounderLanding } from './FounderLanding'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('FounderLanding', () => {
  it('renders the featured Episode 4 controls and accessible style radios', async () => {
    const user = userEvent.setup()
    const onStyleChange = vi.fn()
    const onPlay = vi.fn()
    const onOpenArchive = vi.fn()

    render(
      <FounderLanding
        episode={netflix2011}
        style="classic"
        streakDays={0}
        onStyleChange={onStyleChange}
        onPlay={onPlay}
        onOpenArchive={onOpenArchive}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Founder Mode', level: 1 }),
    ).toBeVisible()
    expect(screen.getByText('Episode 4')).toBeVisible()
    expect(screen.getByText('Netflix')).toBeVisible()
    expect(screen.getByText('Founder streak: 0 days')).toBeVisible()
    expect(
      screen.getByRole('radiogroup', { name: 'Writing style' }),
    ).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Classic' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Brainrot' })).not.toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'Brainrot' }))
    await user.click(screen.getByRole('button', { name: 'Play episode' }))
    await user.click(screen.getByRole('button', { name: 'Past episodes' }))

    expect(onStyleChange).toHaveBeenCalledWith('brainrot')
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onOpenArchive).toHaveBeenCalledTimes(1)
  })

  it('uses native radio arrow-key behavior with one tab stop', async () => {
    function KeyboardHarness() {
      const [style, setStyle] = useState<'classic' | 'brainrot'>('classic')
      return (
        <FounderLanding
          episode={netflix2011}
          style={style}
          streakDays={0}
          onStyleChange={setStyle}
          onPlay={vi.fn()}
          onOpenArchive={vi.fn()}
        />
      )
    }

    const user = userEvent.setup()
    render(<KeyboardHarness />)
    const classic = screen.getByRole('radio', { name: 'Classic' })
    const brainrot = screen.getByRole('radio', { name: 'Brainrot' })
    expect(classic.tagName).toBe('INPUT')

    classic.focus()
    await user.keyboard('{ArrowRight}')
    expect(brainrot).toHaveFocus()
    expect(brainrot).toBeChecked()
    expect(classic).not.toBeChecked()
  })

  it('renders all archive episodes newest first and returns the selection', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onBack = vi.fn()

    render(
      <EpisodeArchive
        episodes={founderEpisodes}
        selectedEpisodeId={netflix2011.id}
        onSelect={onSelect}
        onBack={onBack}
      />,
    )

    const episodeButtons = screen.getAllByRole('button', {
      name: /Select Episode \d:/,
    })
    expect(episodeButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining('Netflix'),
      expect.stringContaining('Eastman Kodak'),
      expect.stringContaining('Apple Computer'),
      expect.stringContaining('Blockbuster'),
    ])

    await user.click(
      screen.getByRole('button', { name: 'Select Episode 2: Apple Computer' }),
    )
    expect(onSelect).toHaveBeenCalledWith(apple1997.id)
    await user.click(screen.getByRole('button', { name: 'Back to episode' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('FounderModeRoute landing persistence', () => {
  it('persists style and archive episode selection across remounts', async () => {
    const user = userEvent.setup()
    const first = render(
      <MemoryRouter>
        <FounderModeRoute />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('radio', { name: 'Brainrot' }))
    await user.click(screen.getByRole('button', { name: 'Past episodes' }))
    await user.click(
      screen.getByRole('button', { name: 'Select Episode 2: Apple Computer' }),
    )
    expect(screen.getByText('Episode 2')).toBeVisible()
    expect(screen.getByText('Apple Computer')).toBeVisible()
    first.unmount()

    render(
      <MemoryRouter>
        <FounderModeRoute />
      </MemoryRouter>,
    )
    expect(screen.getByRole('radio', { name: 'Brainrot' })).toBeChecked()
    expect(screen.getByText('Apple Computer')).toBeVisible()
  })

  it('does not erase corrupt recovery data before explicit consent', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(FOUNDER_SAVE_KEY, '{broken')

    render(
      <MemoryRouter>
        <FounderModeRoute />
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Save recovery required',
    )
    expect(window.localStorage.getItem(FOUNDER_SAVE_KEY)).toBe('{broken')

    await user.click(
      screen.getByRole('button', { name: 'Start fresh and replace save' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Founder Mode', level: 1 }),
    ).toBeVisible()
    expect(window.localStorage.getItem(FOUNDER_SAVE_KEY)).not.toBe('{broken')
  })

  it('surfaces a hub-progress failure after replacing a corrupt save', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(FOUNDER_SAVE_KEY, '{broken')
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === 'open-trade:hub-progress') {
        throw new Error('Hub storage unavailable')
      }
      originalSetItem.call(this, key, value)
    })

    render(
      <MemoryRouter>
        <FounderModeRoute />
      </MemoryRouter>,
    )
    await user.click(
      screen.getByRole('button', { name: 'Start fresh and replace save' }),
    )

    expect(
      screen.getByText(/hub streak could not update/i),
    ).toBeVisible()
    expect(window.localStorage.getItem(FOUNDER_SAVE_KEY)).not.toBe('{broken')
  })
})
