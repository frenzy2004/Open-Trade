import { describe, expect, it } from 'vitest'
import { founderEpisodes } from '../content/episodes'
import type { FounderEpisode } from '../content/types'
import { founderReducer } from './founderReducer'
import { scoreFounderRun, type FounderScoreTier } from './scoreFounderRun'
import { createFounderRun, type FounderRunState } from './founderState'

const ALL_TIERS: readonly FounderScoreTier[] = [
  'cautionary',
  'survivor',
  'builder',
  'legend',
]

function endingRuns(episode: FounderEpisode): readonly FounderRunState[] {
  let runs: readonly FounderRunState[] = [
    founderReducer(
      createFounderRun(episode, 'classic'),
      { type: 'TAKE_CHAIR' },
      episode,
    ),
  ]
  for (const decision of episode.decisions) {
    runs = runs.flatMap((run) =>
      decision.choices.map((choice) => {
        const outcome = founderReducer(
          run,
          { type: 'CHOOSE', choiceId: choice.id },
          episode,
        )
        return founderReducer(outcome, { type: 'NEXT' }, episode)
      }),
    )
  }
  return runs
}

describe('Founder tier calibration', () => {
  it.each(founderEpisodes)(
    'gives $company meaningful tier diversity across all 243 rounded paths',
    (episode) => {
      const runs = endingRuns(episode)
      expect(runs).toHaveLength(3 ** 5)
      expect(runs.every(({ phase }) => phase === 'ending')).toBe(true)

      const distribution = Object.fromEntries(
        ALL_TIERS.map((tier) => [
          tier,
          runs.filter((run) => scoreFounderRun(run, episode).tier === tier)
            .length,
        ]),
      ) as Record<FounderScoreTier, number>
      const diagnostic = `${episode.company}: ${JSON.stringify(distribution)}`

      for (const tier of ALL_TIERS) {
        expect(distribution[tier], diagnostic).toBeGreaterThanOrEqual(5)
      }
      expect(Math.max(...Object.values(distribution)), diagnostic).toBeLessThan(
        runs.length * 0.7,
      )
    },
  )
})
