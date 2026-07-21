import { describe, expect, it } from 'vitest'
import type {
  FounderChoice,
  FounderDecision,
  FounderEpisode,
  FounderSource,
} from './types'
import { validateEpisode } from './validateEpisode'

function decisionAt(episode: FounderEpisode, index: number): FounderDecision {
  const decision = episode.decisions[index]
  if (!decision) throw new RangeError(`Missing fixture decision ${index}`)
  return decision
}

function choiceAt(decision: FounderDecision, index: number): FounderChoice {
  const choice = decision.choices[index]
  if (!choice) throw new RangeError(`Missing fixture choice ${index}`)
  return choice
}

function sourceAt(episode: FounderEpisode, index: number): FounderSource {
  const source = episode.sources[index]
  if (!source) throw new RangeError(`Missing fixture source ${index}`)
  return source
}

function createValidEpisode(): FounderEpisode {
  return {
    id: 'sample',
    episodeNumber: 1,
    company: 'Sample Co',
    founder: 'Ada Founder',
    startYear: 2000,
    rulesetVersion: 1,
    initialValueBn: 10,
    historicalEndValueBn: 12,
    intro: {
      classic: 'A documented setup.',
      brainrot: 'A documented setup, but loud.',
    },
    sources: [
      {
        id: 's1',
        title: 'Primary filing',
        url: 'https://example.com/filing',
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
      choices: [0, 1, 2].map((choiceIndex) => ({
        id: `c${choiceIndex + 1}`,
        label: `Choice ${choiceIndex + 1}`,
        matchedHistory: choiceIndex === 0,
        worked: choiceIndex !== 2,
        valueMultiplier:
          choiceIndex === 0 ? 1.1 : choiceIndex === 1 ? 1.05 : 0.9,
        styleWeights: {
          visionary: choiceIndex === 0 ? 2 : 0,
          operator: choiceIndex === 1 ? 2 : 0,
          consensus: choiceIndex === 2 ? 2 : 0,
        },
        outcome: {
          classic: 'Outcome.',
          brainrot: 'Outcome, somehow.',
        },
      })),
    })),
  }
}

describe('validateEpisode', () => {
  it('accepts a complete five-by-three episode without changing it', () => {
    const episode = createValidEpisode()
    const before = structuredClone(episode)

    expect(validateEpisode(episode)).toEqual([])
    expect(episode).toEqual(before)
  })

  it('requires exactly five decisions and three unique choices per decision', () => {
    const episode = createValidEpisode()
    episode.decisions = episode.decisions.slice(0, 4)
    decisionAt(episode, 0).choices.pop()
    decisionAt(episode, 1).choices.splice(1, 1, {
      ...choiceAt(decisionAt(episode, 1), 0),
    })

    expect(validateEpisode(episode)).toEqual([
      'sample must contain exactly 5 decisions',
      'sample/d1 must contain exactly 3 choices',
      'sample/d2/c1 choice id must be unique within its decision',
    ])
  })

  it('rejects unresolved sources and non-positive or non-finite valuation numbers', () => {
    const episode = createValidEpisode()
    episode.initialValueBn = Number.NaN
    episode.historicalEndValueBn = Number.POSITIVE_INFINITY
    decisionAt(episode, 0).sourceIds = ['missing']
    choiceAt(decisionAt(episode, 0), 0).valueMultiplier = 0
    choiceAt(decisionAt(episode, 0), 1).valueMultiplier = Number.NaN

    expect(validateEpisode(episode)).toEqual([
      'sample initialValueBn must be a positive finite number',
      'sample historicalEndValueBn must be a positive finite number',
      'sample/d1 references unknown source missing',
      'sample/d1/c1 valueMultiplier must be greater than 0',
      'sample/d1/c2 valueMultiplier must be greater than 0',
    ])
  })

  it('checks duplicate IDs, copy variants, citations, and a historical choice', () => {
    const episode = createValidEpisode()
    episode.sources.push({ ...sourceAt(episode, 0) })
    decisionAt(episode, 1).id = 'd1'
    decisionAt(episode, 0).sourceIds = []
    decisionAt(episode, 0).prompt.brainrot = ' '
    decisionAt(episode, 0).choices.forEach((choice) => {
      choice.matchedHistory = false
    })
    choiceAt(decisionAt(episode, 0), 0).outcome.classic = ''

    expect(validateEpisode(episode)).toEqual([
      'sample/s1 source id must be unique',
      'sample/d1 prompt.brainrot must be non-empty',
      'sample/d1 must reference at least 1 source',
      'sample/d1 must contain at least 1 historical choice',
      'sample/d1/c1 outcome.classic must be non-empty',
      'sample/d1 decision id must be unique',
    ])
  })

  it('validates source metadata, core fields, chronology, and style weights', () => {
    const episode = createValidEpisode()
    episode.episodeNumber = 0
    episode.company = ' '
    episode.rulesetVersion = -1
    episode.sources.push({
      id: 's2',
      title: 'Second filing',
      url: 'https://example.com/second',
      publisher: 'Example',
      accessed: '2026-07-21',
    })
    episode.decisions.forEach((decision) => {
      decision.sourceIds = ['s2']
    })
    episode.sources[0] = {
      id: '',
      title: '',
      url: 'javascript:alert(1)',
      publisher: ' ',
      accessed: '21 July 2026',
    }
    decisionAt(episode, 1).year = 1999
    choiceAt(decisionAt(episode, 0), 0).styleWeights.operator = -1
    choiceAt(decisionAt(episode, 0), 1).styleWeights.consensus = Number.NaN

    expect(validateEpisode(episode)).toEqual([
      'sample episodeNumber must be a positive integer',
      'sample company must be non-empty',
      'sample rulesetVersion must be a positive integer',
      'sample/<missing source id> source id must be non-empty',
      'sample/<missing source id> title must be non-empty',
      'sample/<missing source id> url must be an absolute http(s) URL',
      'sample/<missing source id> publisher must be non-empty',
      'sample/<missing source id> accessed must use YYYY-MM-DD',
      'sample/d1/c1 styleWeights.operator must be a non-negative finite number',
      'sample/d1/c2 styleWeights.consensus must be a non-negative finite number',
      'sample/d2 year must not precede the episode start year',
      'sample/d2 year must not precede the previous decision year',
    ])
  })

  it('rejects a non-integer episode start year', () => {
    const episode = createValidEpisode()
    episode.startYear = 2000.5

    expect(validateEpisode(episode)).toContain(
      'sample startYear must be an integer',
    )
  })

  it('reports hostile JavaScript values deterministically instead of throwing', () => {
    expect(validateEpisode(null)).toEqual(['<episode> must be an object'])
    expect(validateEpisode('episode')).toEqual([
      '<episode> must be an object',
    ])

    const hostile = {
      id: 17,
      episodeNumber: 'one',
      company: null,
      founder: undefined,
      startYear: '2000',
      rulesetVersion: Number.NaN,
      initialValueBn: '10',
      historicalEndValueBn: null,
      intro: null,
      sources: [null, 1] as unknown as FounderSource[],
      decisions: [null, 'decision'] as unknown as FounderDecision[],
    } as unknown as FounderEpisode

    expect(() => validateEpisode(hostile)).not.toThrow()
    expect(validateEpisode(hostile)).toEqual([
      '<missing episode id> id must be non-empty',
      '<missing episode id> episodeNumber must be a positive integer',
      '<missing episode id> company must be non-empty',
      '<missing episode id> founder must be non-empty',
      '<missing episode id> startYear must be an integer',
      '<missing episode id> rulesetVersion must be a positive integer',
      '<missing episode id> initialValueBn must be a positive finite number',
      '<missing episode id> historicalEndValueBn must be a positive finite number',
      '<missing episode id> intro.classic must be non-empty',
      '<missing episode id> intro.brainrot must be non-empty',
      '<missing episode id>/sources[0] must be an object',
      '<missing episode id>/sources[1] must be an object',
      '<missing episode id> must contain exactly 5 decisions',
      '<missing episode id>/decisions[0] must be an object',
      '<missing episode id>/decisions[1] must be an object',
    ])
  })
})
