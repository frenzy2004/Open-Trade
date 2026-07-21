import type { FounderEpisode, WritingStyle } from '../content/types'
import {
  createFounderRun,
  freezeFounderRun,
  type FounderAction,
  type FounderRunState,
} from './founderState'

type UnknownRecord = Record<string, unknown>

function read(record: UnknownRecord, key: string): unknown {
  try {
    return record[key]
  } catch {
    return undefined
  }
}

function asActionRecord(action: FounderAction): UnknownRecord | null {
  try {
    return typeof action === 'object' && action !== null
      ? (action as unknown as UnknownRecord)
      : null
  } catch {
    return null
  }
}

function isWritingStyle(value: unknown): value is WritingStyle {
  return value === 'classic' || value === 'brainrot'
}

function withPhase(
  state: FounderRunState,
  phase: FounderRunState['phase'],
  decisionIndex = state.decisionIndex,
): FounderRunState {
  return freezeFounderRun({ ...state, phase, decisionIndex })
}

function choose(
  state: FounderRunState,
  action: UnknownRecord,
  episode: FounderEpisode,
): FounderRunState {
  if (state.phase !== 'decision') return state
  const choiceId = read(action, 'choiceId')
  if (typeof choiceId !== 'string') return state

  const decision = episode.decisions[state.decisionIndex]
  if (!decision) return state
  if (state.history.some(({ decisionId }) => decisionId === decision.id)) {
    return state
  }
  const choice = decision.choices.find(({ id }) => id === choiceId)
  if (
    !choice ||
    !Number.isFinite(choice.valueMultiplier) ||
    choice.valueMultiplier <= 0 ||
    !Number.isFinite(state.currentValueBn) ||
    state.currentValueBn <= 0
  ) {
    return state
  }

  const valueAfterBn =
    Math.round(state.currentValueBn * choice.valueMultiplier * 10) / 10
  if (!Number.isFinite(valueAfterBn) || valueAfterBn <= 0) return state

  return freezeFounderRun({
    ...state,
    phase: 'outcome',
    currentValueBn: valueAfterBn,
    history: [
      ...state.history,
      {
        decisionId: decision.id,
        choiceId: choice.id,
        valueBeforeBn: state.currentValueBn,
        valueAfterBn,
      },
    ],
  })
}

function advance(
  state: FounderRunState,
  episode: FounderEpisode,
): FounderRunState {
  if (state.phase !== 'outcome') return state
  const decision = episode.decisions[state.decisionIndex]
  const latest = state.history[state.history.length - 1]
  if (
    !decision ||
    !latest ||
    latest.decisionId !== decision.id ||
    state.history.length !== state.decisionIndex + 1
  ) {
    return state
  }

  if (state.decisionIndex === episode.decisions.length - 1) {
    return withPhase(state, 'ending')
  }
  if (state.decisionIndex >= episode.decisions.length - 1) return state
  return withPhase(state, 'decision', state.decisionIndex + 1)
}

/** Pure, phase-gated Founder Mode transition function. */
export function founderReducer(
  state: FounderRunState,
  action: FounderAction,
  episode: FounderEpisode,
): FounderRunState {
  try {
    if (state.episodeId !== episode.id) return state
    const candidate = asActionRecord(action)
    if (!candidate) return state
    const type = read(candidate, 'type')

    switch (type) {
      case 'PLAY':
        return state.phase === 'landing' ? withPhase(state, 'intro', 0) : state
      case 'TAKE_CHAIR':
        return state.phase === 'intro' ? withPhase(state, 'decision', 0) : state
      case 'CHOOSE':
        return choose(state, candidate, episode)
      case 'NEXT':
        return advance(state, episode)
      case 'SET_STYLE': {
        const style = read(candidate, 'style')
        return isWritingStyle(style) && style !== state.style
          ? freezeFounderRun({ ...state, style })
          : state
      }
      case 'REPLAY':
        return state.phase === 'ending'
          ? createFounderRun(episode, state.style)
          : state
      default:
        return state
    }
  } catch {
    return state
  }
}
