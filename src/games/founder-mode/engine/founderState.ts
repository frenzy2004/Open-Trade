import type { FounderEpisode, WritingStyle } from '../content/types'

export type FounderPhase =
  | 'landing'
  | 'intro'
  | 'decision'
  | 'outcome'
  | 'ending'

export interface FounderHistoryItem {
  readonly decisionId: string
  readonly choiceId: string
  readonly valueBeforeBn: number
  readonly valueAfterBn: number
}

export interface FounderRunState {
  readonly episodeId: string
  readonly style: WritingStyle
  readonly phase: FounderPhase
  readonly decisionIndex: number
  readonly currentValueBn: number
  readonly history: readonly FounderHistoryItem[]
}

export type FounderAction =
  | { readonly type: 'PLAY' }
  | { readonly type: 'TAKE_CHAIR' }
  | { readonly type: 'CHOOSE'; readonly choiceId: string }
  | { readonly type: 'NEXT' }
  | { readonly type: 'SET_STYLE'; readonly style: WritingStyle }
  | { readonly type: 'REPLAY' }

function isWritingStyle(value: unknown): value is WritingStyle {
  return value === 'classic' || value === 'brainrot'
}

export function freezeFounderRun(
  state: Omit<FounderRunState, 'history'> & {
    readonly history: readonly FounderHistoryItem[]
  },
): FounderRunState {
  const history = Object.freeze(
    state.history.map((item) =>
      Object.freeze({
        decisionId: item.decisionId,
        choiceId: item.choiceId,
        valueBeforeBn: item.valueBeforeBn,
        valueAfterBn: item.valueAfterBn,
      }),
    ),
  )
  return Object.freeze({ ...state, history })
}

export function createFounderRun(
  episode: FounderEpisode,
  style: WritingStyle,
): FounderRunState {
  if (!isWritingStyle(style)) {
    throw new TypeError('Founder style must be classic or brainrot')
  }
  if (
    typeof episode?.id !== 'string' ||
    !episode.id.trim() ||
    typeof episode.initialValueBn !== 'number' ||
    !Number.isFinite(episode.initialValueBn) ||
    episode.initialValueBn <= 0
  ) {
    throw new TypeError('Founder episode must have an id and positive initial value')
  }

  return freezeFounderRun({
    episodeId: episode.id,
    style,
    phase: 'intro',
    decisionIndex: 0,
    currentValueBn: episode.initialValueBn,
    history: [],
  })
}
