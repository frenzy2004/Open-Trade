import type { RunnerCommand } from '../engine/types'

export type TutorialStep = 'lane' | 'jump' | 'roll' | 'gate' | 'complete'
export type TutorialAction = RunnerCommand | 'ANSWER_LONG' | 'ANSWER_SHORT'

export function advanceTutorial(
  step: TutorialStep,
  action: TutorialAction,
): TutorialStep {
  switch (step) {
    case 'lane':
      return action === 'MOVE_LEFT' || action === 'MOVE_RIGHT' ? 'jump' : step
    case 'jump':
      return action === 'JUMP' ? 'roll' : step
    case 'roll':
      return action === 'ROLL' ? 'gate' : step
    case 'gate':
      return action === 'ANSWER_LONG' || action === 'JUMP' ? 'complete' : step
    case 'complete':
      return step
  }
}
