import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRunnerState } from '../engine/createRunnerState'
import type { RunnerState } from '../engine/types'
import {
  createChallengeHash,
  parseChallengeHash,
} from '../challenge'
import { MarketGatePrompt } from './MarketGatePrompt'
import { RunnerDebugOverlay } from './RunnerDebugOverlay'
import { RunnerGameOver } from './RunnerGameOver'
import { RunnerHud } from './RunnerHud'

afterEach(cleanup)

function state(overrides: Partial<RunnerState> = {}): RunnerState {
  return {
    ...createRunnerState({ seed: 'hud-seed', reducedMotion: false }),
    ...overrides,
  }
}

describe('RunnerHud', () => {
  it('shows score, distance, coins, streak, Powell gap, and pause/resume', () => {
    const onPause = vi.fn()
    const running = state({
      score: 1_234,
      bestScore: 2_000,
      distanceM: 321.8,
      coins: 7,
      streak: 4,
      powellGap: 42,
    })
    const view = render(<RunnerHud state={running} onPause={onPause} />)

    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('321 m')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('4×')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pause run' }))
    expect(onPause).toHaveBeenCalledTimes(1)

    view.rerender(<RunnerHud state={state({ phase: 'paused' })} onPause={onPause} />)
    expect(screen.getByRole('button', { name: 'Resume run' })).toBeInTheDocument()
    expect(view.container.querySelector('[aria-live]')).toBeNull()
  })
})

describe('MarketGatePrompt', () => {
  it('offers explicit LONG/SHORT answers and announces only semantic feedback', () => {
    const onAnswer = vi.fn()
    const active = state()
    active.currentGate = {
      eventId: 'gate-event',
      promptDistanceM: 100,
      responseDistanceM: 150,
      gate: {
        id: 'test-gate',
        ticker: 'TEST',
        setup: 'Test Company raised profit guidance well above the previous expected range.',
        answer: 'long',
        explanation: 'Higher profit guidance increases expected future cash generation for shareholders.',
        difficulty: 1,
      },
    }
    const view = render(<MarketGatePrompt state={active} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByRole('button', { name: /long.*up/i }))
    fireEvent.click(screen.getByRole('button', { name: /short.*down/i }))
    expect(onAnswer.mock.calls).toEqual([['long'], ['short']])
    expect(view.container.querySelector('[aria-live]')).toBeNull()

    const feedback = state()
    feedback.lastGateFeedback = {
      gateId: 'test-gate',
      ticker: 'TEST',
      answer: 'long',
      expected: 'long',
      correct: true,
      timedOut: false,
      scoreDelta: 200,
      explanation: 'Higher profit guidance increases expected future cash generation for shareholders.',
      resolvedAtTick: 10,
    }
    view.rerender(<MarketGatePrompt state={feedback} onAnswer={onAnswer} />)
    expect(screen.getByRole('status')).toHaveTextContent(/correct.*\+200/i)
  })
})

describe('RunnerDebugOverlay and RunnerGameOver', () => {
  it('renders all requested debug fields only when enabled', () => {
    const snapshot = state({ distanceM: 12.5, speedMps: 9, lane: -1 })
    const view = render(
      <RunnerDebugOverlay state={snapshot} enabled={false} diagnostics={null} />,
    )
    expect(view.container).toBeEmptyDOMElement()

    view.rerender(
      <RunnerDebugOverlay
        state={snapshot}
        enabled
        diagnostics={{
          catchUpLimit: 5,
          commandDrainCount: 2,
          droppedCommands: 1,
          droppedFrameMs: 3,
          pendingCommands: 0,
        }}
      />,
    )
    for (const label of [
      'Seed', 'Time', 'Distance', 'Speed', 'Lane', 'Vertical',
      'Next entity', 'Collision bounds', 'Current answer', 'Powell gap',
    ]) {
      expect(screen.getByText(new RegExp(`^${label}$`, 'i'))).toBeInTheDocument()
    }
  })

  it('shows exact failure recovery, replay, back, and share actions', () => {
    const onRunAgain = vi.fn()
    const onShare = vi.fn()
    const failed = state({
      phase: 'gameOver',
      score: 900,
      bestScore: 1_200,
      lastFailure: {
        kind: 'train',
        ticker: 'NVLN',
        message: 'NVLN train flattened you',
        tip: 'Switch lanes before the ticker train',
      },
    })
    render(
      <MemoryRouter>
        <RunnerGameOver
          state={failed}
          onRunAgain={onRunAgain}
          onShare={onShare}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'NVLN train flattened you' })).toBeInTheDocument()
    expect(screen.getByText('Switch lanes before the ticker train')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }))
    expect(onRunAgain).toHaveBeenCalledTimes(1)
    expect(onShare).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Back to games' })).toHaveAttribute('href', '/')
  })
})

describe('runner challenge hashes', () => {
  it('round-trips a compatible seed and rejects malformed or foreign hashes', () => {
    const hash = createChallengeHash('share-seed', 1)
    expect(hash).toBe('#/wallstreet-surfers?seed=share-seed&rules=1')
    expect(parseChallengeHash(hash)).toEqual({ seed: 'share-seed', rulesetVersion: 1 })
    expect(parseChallengeHash(`https://trade.test/${hash}`)).toEqual({
      seed: 'share-seed',
      rulesetVersion: 1,
    })
    expect(parseChallengeHash('#/fanstocks?seed=share-seed&rules=1')).toBeNull()
    expect(parseChallengeHash('#/wallstreet-surfers?seed=bad%20seed&rules=1')).toBeNull()
    expect(() => createChallengeHash('bad seed', 1)).toThrow(/invalid/i)
  })
})
