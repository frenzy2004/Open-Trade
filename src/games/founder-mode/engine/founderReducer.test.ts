import { describe, expect, it } from 'vitest'
import type { FounderEpisode, WritingStyle } from '../content/types'
import { founderReducer } from './founderReducer'
import { scoreFounderRun } from './scoreFounderRun'
import {
  createFounderRun,
  type FounderAction,
  type FounderRunState,
} from './founderState'

function createEpisode(): FounderEpisode {
  return {
    id: 'sample',
    episodeNumber: 1,
    company: 'Sample Co',
    founder: 'Ada Founder',
    startYear: 2000,
    rulesetVersion: 1,
    initialValueBn: 10,
    historicalEndValueBn: 12,
    intro: { classic: 'Documented setup.', brainrot: 'Documented setup, loudly.' },
    sources: [
      {
        id: 's1',
        title: 'Source',
        url: 'https://example.com/source',
        publisher: 'Example',
        accessed: '2026-07-21',
      },
    ],
    decisions: Array.from({ length: 5 }, (_, decisionIndex) => ({
      id: `d${decisionIndex + 1}`,
      year: 2000 + decisionIndex,
      prompt: {
        classic: `Decision ${decisionIndex + 1}`,
        brainrot: `Decision ${decisionIndex + 1}, no cap`,
      },
      sourceIds: ['s1'],
      choices: [
        {
          id: 'c1',
          label: 'Bold choice',
          matchedHistory: true,
          worked: true,
          valueMultiplier: 1.1,
          styleWeights: { visionary: 2, operator: 0, consensus: 0 },
          outcome: { classic: 'Bold result.', brainrot: 'Bold result, huge W.' },
        },
        {
          id: 'c2',
          label: 'Operational choice',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.05,
          styleWeights: { visionary: 0, operator: 2, consensus: 0 },
          outcome: { classic: 'Steady result.', brainrot: 'Steady hands, no panic.' },
        },
        {
          id: 'c3',
          label: 'Consensus choice',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.9,
          styleWeights: { visionary: 0, operator: 0, consensus: 2 },
          outcome: { classic: 'Weak result.', brainrot: 'The committee fumbled.' },
        },
      ],
    })),
  }
}

function takeChoice(
  state: FounderRunState,
  episode: FounderEpisode,
  choiceId: string,
): FounderRunState {
  const outcome = founderReducer(state, { type: 'CHOOSE', choiceId }, episode)
  return founderReducer(outcome, { type: 'NEXT' }, episode)
}

function completeRun(
  episode: FounderEpisode,
  style: WritingStyle,
  choiceIds: readonly string[],
): FounderRunState {
  let state = founderReducer(
    createFounderRun(episode, style),
    { type: 'TAKE_CHAIR' },
    episode,
  )
  for (const choiceId of choiceIds) state = takeChoice(state, episode, choiceId)
  return state
}

describe('Founder Mode reducer', () => {
  it('starts at the intro and records one rounded outcome', () => {
    const episode = createEpisode()
    const start = createFounderRun(episode, 'classic')
    expect(start).toMatchObject({
      episodeId: 'sample',
      style: 'classic',
      phase: 'intro',
      decisionIndex: 0,
      currentValueBn: 10,
      history: [],
    })

    const deciding = founderReducer(start, { type: 'TAKE_CHAIR' }, episode)
    const outcome = founderReducer(
      deciding,
      { type: 'CHOOSE', choiceId: 'c1' },
      episode,
    )

    expect(outcome).toMatchObject({ phase: 'outcome', currentValueBn: 11 })
    expect(outcome.history).toEqual([
      {
        decisionId: 'd1',
        choiceId: 'c1',
        valueBeforeBn: 10,
        valueAfterBn: 11,
      },
    ])
    expect(start).toMatchObject({ phase: 'intro', history: [] })
  })

  it('rounds after every choice rather than only at the ending', () => {
    const episode = createEpisode()
    let state = founderReducer(
      createFounderRun(episode, 'classic'),
      { type: 'TAKE_CHAIR' },
      episode,
    )

    state = takeChoice(state, episode, 'c1')
    state = takeChoice(state, episode, 'c1')
    state = takeChoice(state, episode, 'c1')

    expect(state.currentValueBn).toBe(13.3)
    expect(state.history.map(({ valueAfterBn }) => valueAfterBn)).toEqual([
      11, 12.1, 13.3,
    ])
  })

  it('preserves exact object identity for invalid transitions and duplicate choices', () => {
    const episode = createEpisode()
    const intro = createFounderRun(episode, 'classic')
    expect(founderReducer(intro, { type: 'NEXT' }, episode)).toBe(intro)
    expect(
      founderReducer(intro, { type: 'CHOOSE', choiceId: 'c1' }, episode),
    ).toBe(intro)

    const deciding = founderReducer(intro, { type: 'TAKE_CHAIR' }, episode)
    const unknown = founderReducer(
      deciding,
      { type: 'CHOOSE', choiceId: 'missing' },
      episode,
    )
    expect(unknown).toBe(deciding)

    const outcome = founderReducer(
      deciding,
      { type: 'CHOOSE', choiceId: 'c1' },
      episode,
    )
    expect(
      founderReducer(outcome, { type: 'CHOOSE', choiceId: 'c2' }, episode),
    ).toBe(outcome)
    expect(founderReducer(deciding, { type: 'REPLAY' }, episode)).toBe(deciding)
  })

  it('advances decision five to ending and replay resets the run', () => {
    const episode = createEpisode()
    const ending = completeRun(
      episode,
      'brainrot',
      ['c1', 'c2', 'c3', 'c1', 'c2'],
    )

    expect(ending).toMatchObject({
      phase: 'ending',
      decisionIndex: 4,
      style: 'brainrot',
    })
    expect(ending.history).toHaveLength(5)

    const replay = founderReducer(ending, { type: 'REPLAY' }, episode)
    expect(replay).toMatchObject({
      phase: 'intro',
      decisionIndex: 0,
      currentValueBn: 10,
      style: 'brainrot',
      history: [],
    })
  })

  it('changes prose style without changing numeric results', () => {
    const episode = createEpisode()
    const classicStart = createFounderRun(episode, 'classic')
    const brainrotStart = founderReducer(
      classicStart,
      { type: 'SET_STYLE', style: 'brainrot' },
      episode,
    )

    const classic = completeRun(
      episode,
      'classic',
      ['c1', 'c2', 'c3', 'c1', 'c2'],
    )
    const brainrot = completeRun(
      episode,
      brainrotStart.style,
      ['c1', 'c2', 'c3', 'c1', 'c2'],
    )

    expect(brainrotStart.currentValueBn).toBe(classicStart.currentValueBn)
    expect(brainrot.currentValueBn).toBe(classic.currentValueBn)
    expect(brainrot.history).toEqual(classic.history)
    expect(scoreFounderRun(brainrot, episode)).toEqual(
      scoreFounderRun(classic, episode),
    )
  })

  it('scores history, outcomes, and an exact normalized founder-style mix', () => {
    const episode = createEpisode()
    const ending = completeRun(
      episode,
      'classic',
      ['c1', 'c1', 'c2', 'c3', 'c1'],
    )

    const score = scoreFounderRun(ending, episode)
    expect(score.valueRatio).toBeCloseTo(ending.currentValueBn / 12)
    expect(score.matchedHistoryCount).toBe(3)
    expect(score.workedCount).toBe(4)
    expect(score.stylePercentages).toEqual({
      visionary: 60,
      operator: 20,
      consensus: 20,
    })
    expect(
      Object.values(score.stylePercentages).reduce(
        (total, percentage) => total + percentage,
        0,
      ),
    ).toBe(100)
    expect(score.tier).toBe('builder')
  })

  it.each([
    [18, 'legend'],
    [12, 'builder'],
    [8.4, 'survivor'],
    [8.3, 'cautionary'],
  ] as const)('assigns $%sB to the %s tier', (currentValueBn, tier) => {
    const episode = createEpisode()
    const state: FounderRunState = {
      ...createFounderRun(episode, 'classic'),
      currentValueBn,
    }

    expect(scoreFounderRun(state, episode).tier).toBe(tier)
  })

  it('replays the same choices deterministically and freezes detached output', () => {
    const episode = createEpisode()
    const choices = ['c1', 'c2', 'c1', 'c3', 'c2'] as const
    const first = completeRun(episode, 'classic', choices)
    const replayStart = founderReducer(first, { type: 'REPLAY' }, episode)
    let second = founderReducer(
      replayStart,
      { type: 'TAKE_CHAIR' },
      episode,
    )
    for (const choiceId of choices) second = takeChoice(second, episode, choiceId)

    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(Object.isFrozen(second)).toBe(true)
    expect(Object.isFrozen(second.history)).toBe(true)
    expect(second.history.every((item) => Object.isFrozen(item))).toBe(true)

    const score = scoreFounderRun(second, episode)
    expect(Object.isFrozen(score)).toBe(true)
    expect(Object.isFrozen(score.stylePercentages)).toBe(true)
  })

  it('rejects mismatched episodes and hostile runtime actions without throwing', () => {
    const episode = createEpisode()
    const state = createFounderRun(episode, 'classic')
    const otherEpisode = { ...episode, id: 'other' }
    const hostile = null as unknown as FounderAction

    expect(founderReducer(state, { type: 'TAKE_CHAIR' }, otherEpisode)).toBe(
      state,
    )
    expect(() => founderReducer(state, hostile, episode)).not.toThrow()
    expect(founderReducer(state, hostile, episode)).toBe(state)
  })
})
