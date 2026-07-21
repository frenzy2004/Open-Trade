import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RunnerTutorial } from './RunnerTutorial'
import { advanceTutorial, type TutorialStep } from './tutorialState'
import { TouchControls } from './TouchControls'

afterEach(cleanup)

describe('runner tutorial progression', () => {
  it('requires lane, jump, roll, and a correct sample LONG call in order', () => {
    let step: TutorialStep = 'lane'
    step = advanceTutorial(step, 'JUMP')
    expect(step).toBe('lane')
    step = advanceTutorial(step, 'MOVE_LEFT')
    expect(step).toBe('jump')
    step = advanceTutorial(step, 'ROLL')
    expect(step).toBe('jump')
    step = advanceTutorial(step, 'JUMP')
    expect(step).toBe('roll')
    step = advanceTutorial(step, 'ROLL')
    expect(step).toBe('gate')
    step = advanceTutorial(step, 'ROLL')
    expect(step).toBe('gate')
    step = advanceTutorial(step, 'JUMP')
    expect(step).toBe('complete')
    expect(advanceTutorial(step, 'MOVE_RIGHT')).toBe('complete')
  })

  it('maps Up/Jump to LONG and Down/Roll to SHORT at the sample gate', () => {
    expect(advanceTutorial('gate', 'MOVE_LEFT')).toBe('gate')
    expect(advanceTutorial('gate', 'MOVE_RIGHT')).toBe('gate')
    expect(advanceTutorial('gate', 'ROLL')).toBe('gate')
    expect(advanceTutorial('gate', 'JUMP')).toBe('complete')
  })

  it('renders one instructional status and accessible sample answers', () => {
    const onAction = vi.fn()
    const view = render(<RunnerTutorial step="lane" onAction={onAction} />)
    expect(screen.getByRole('status')).toHaveTextContent(/change lane/i)

    view.rerender(<RunnerTutorial step="gate" onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: /long/i }))
    fireEvent.click(screen.getByRole('button', { name: /short/i }))
    expect(onAction.mock.calls).toEqual([
      ['ANSWER_LONG'],
      ['ANSWER_SHORT'],
    ])

    view.rerender(<RunnerTutorial step="complete" onAction={onAction} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('TouchControls', () => {
  it('provides named controls for every runner movement and pause action', () => {
    const onCommand = vi.fn()
    render(<TouchControls onCommand={onCommand} />)

    for (const [name, command] of [
      [/move left/i, 'MOVE_LEFT'],
      [/move right/i, 'MOVE_RIGHT'],
      [/jump/i, 'JUMP'],
      [/roll/i, 'ROLL'],
      [/pause/i, 'PAUSE'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name }))
      expect(onCommand).toHaveBeenLastCalledWith(command)
    }
  })

  it('disables every control as a group', () => {
    render(<TouchControls onCommand={vi.fn()} disabled />)
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })
})
