import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import {
  readGameProgress,
  setGameProgress,
} from '../../app/routes/progressStore'
import { FounderModeRoute } from './FounderModeRoute'
import { founderStore } from './persistence/founderSave'
import { gameRoute } from './route'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

const cachedZero = {
  label: 'Founder streak',
  value: '0 days',
  tone: 'neutral',
} as const

describe('Founder route progress derivation', () => {
  it('derives a streak from the Founder save when the hub cache diverges', () => {
    expect(setGameProgress('founder-mode', cachedZero)).toEqual({ ok: true })
    expect(
      founderStore.save({
        schemaVersion: 2,
        selectedEpisodeId: 'netflix-2011',
        episodeRulesetVersion: 1,
        style: 'classic',
        streakDays: 7,
        lastCompletedDate: '2026-07-21',
        activeRun: null,
      }),
    ).toEqual({ ok: true })

    expect(readGameProgress('founder-mode')).toEqual(cachedZero)
    expect(gameRoute.getProgressBadge()).toEqual({
      label: 'Founder streak',
      value: '7 days',
      tone: 'positive',
    })
  })

  it('uses empty and recovery badges instead of stale cached progress', () => {
    expect(
      setGameProgress('founder-mode', {
        label: 'Founder streak',
        value: '9 days',
        tone: 'positive',
      }),
    ).toEqual({ ok: true })
    expect(gameRoute.getProgressBadge()).toEqual(cachedZero)

    window.localStorage.setItem(gameRoute.saveKey, '{broken')
    expect(gameRoute.getProgressBadge()).toEqual({
      label: 'Founder streak',
      value: 'Recovery required',
      tone: 'warning',
    })
  })

  it('repairs the hub cache when a saved route is loaded', async () => {
    expect(setGameProgress('founder-mode', cachedZero)).toEqual({ ok: true })
    expect(
      founderStore.save({
        schemaVersion: 2,
        selectedEpisodeId: 'netflix-2011',
        episodeRulesetVersion: 1,
        style: 'classic',
        streakDays: 4,
        lastCompletedDate: '2026-07-21',
        activeRun: null,
      }),
    ).toEqual({ ok: true })

    render(
      <MemoryRouter>
        <FounderModeRoute />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(readGameProgress('founder-mode')).toEqual({
        label: 'Founder streak',
        value: '4 days',
        tone: 'positive',
      })
    })
  })
})
