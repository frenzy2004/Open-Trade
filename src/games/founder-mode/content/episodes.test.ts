import { describe, expect, it } from 'vitest'
import { apple1997 } from './apple1997'
import { blockbuster2000 } from './blockbuster2000'
import {
  founderEpisodeById,
  founderEpisodes,
} from './episodes'
import { kodak1975 } from './kodak1975'
import { netflix2011 } from './netflix2011'
import type { FounderChoice, FounderDecision, FounderEpisode } from './types'
import { validateEpisode } from './validateEpisode'

const EXPECTED_DECISION_IDS: Readonly<Record<string, readonly string[]>> = {
  'netflix-2011': [
    'split-pricing',
    'announce-qwikster',
    'reverse-qwikster',
    'expand-internationally',
    'fund-house-of-cards',
  ],
  'kodak-1975': [
    'first-digital-camera',
    'build-digital-unit',
    'japanese-competition',
    'photo-cd-workflows',
    'digital-restructure',
  ],
  'apple-1997': [
    'microsoft-investment',
    'simplify-product-matrix',
    'open-apple-retail',
    'ipod-itunes-ecosystem',
    'intel-transition',
  ],
  'blockbuster-2000': [
    'netflix-acquisition',
    'sustainable-late-fees',
    'online-subscriptions',
    'stores-mail-integration',
    'recapitalize-before-crisis',
  ],
}

function decisionAt(episode: FounderEpisode, index: number): FounderDecision {
  const decision = episode.decisions[index]
  if (!decision) throw new RangeError(`Missing decision ${index}`)
  return decision
}

function choiceAt(decision: FounderDecision, index: number): FounderChoice {
  const choice = decision.choices[index]
  if (!choice) throw new RangeError(`Missing choice ${index}`)
  return choice
}

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  seen.add(value)
  expect(Object.isFrozen(value)).toBe(true)
  for (const child of Object.values(value)) expectDeepFrozen(child, seen)
}

describe('Founder Mode episode registry', () => {
  it('registers the four episodes in stable public order', () => {
    expect(founderEpisodes).toEqual([
      netflix2011,
      kodak1975,
      apple1997,
      blockbuster2000,
    ])
    expect(founderEpisodes.map(({ id }) => id)).toEqual([
      'netflix-2011',
      'kodak-1975',
      'apple-1997',
      'blockbuster-2000',
    ])
    expect(founderEpisodes.map(({ episodeNumber }) => episodeNumber)).toEqual([
      4, 3, 2, 1,
    ])
  })

  it('looks up only canonical immutable episodes', () => {
    for (const episode of founderEpisodes) {
      expect(founderEpisodeById(episode.id)).toBe(episode)
    }
    expect(founderEpisodeById('missing')).toBeUndefined()
    expect(
      founderEpisodeById(null as unknown as string),
    ).toBeUndefined()
  })

  it('contains four valid episodes, twenty decisions, and sixty choices', () => {
    expect(founderEpisodes).toHaveLength(4)
    expect(
      founderEpisodes.reduce(
        (total, episode) => total + episode.decisions.length,
        0,
      ),
    ).toBe(20)
    expect(
      founderEpisodes.reduce(
        (total, episode) =>
          total +
          episode.decisions.reduce(
            (decisionTotal, decision) =>
              decisionTotal + decision.choices.length,
            0,
          ),
        0,
      ),
    ).toBe(60)

    for (const episode of founderEpisodes) {
      expect(validateEpisode(episode), episode.id).toEqual([])
      expect(episode.decisions).toHaveLength(5)
      expect(
        episode.decisions.every((decision) => decision.choices.length === 3),
      ).toBe(true)
    }
  })

  it('uses the planned five historical decision topics in order', () => {
    for (const episode of founderEpisodes) {
      const expected = EXPECTED_DECISION_IDS[episode.id]
      if (!expected) throw new Error(`Missing expected topics for ${episode.id}`)
      expect(episode.decisions.map(({ id }) => id)).toEqual(expected)
      expect(
        episode.decisions.every(
          (decision, index) =>
            index === 0 ||
            decision.year >= decisionAt(episode, index - 1).year,
        ),
      ).toBe(true)
    }
  })

  it('keeps mechanics in bounds and gives every dilemma one historical answer', () => {
    for (const episode of founderEpisodes) {
      for (const decision of episode.decisions) {
        expect(
          decision.choices.filter(({ matchedHistory }) => matchedHistory),
          `${episode.id}/${decision.id}`,
        ).toHaveLength(1)
        expect(decision.choices.some(({ worked }) => worked)).toBe(true)
        expect(decision.choices.some(({ worked }) => !worked)).toBe(true)
        expect(new Set(decision.choices.map(({ label }) => label)).size).toBe(3)

        const multipliers = decision.choices.map(
          ({ valueMultiplier }) => valueMultiplier,
        )
        expect(Math.min(...multipliers)).toBeGreaterThanOrEqual(0.65)
        expect(Math.max(...multipliers)).toBeLessThanOrEqual(1.45)
        expect(Math.max(...multipliers) - Math.min(...multipliers)).toBeLessThanOrEqual(0.45)
      }
    }
  })

  it('ships complete original classic and brainrot copy with citations', () => {
    const serialized = JSON.stringify(founderEpisodes)
    expect(serialized).not.toMatch(/TBD|TODO|lorem ipsum|placeholder/i)

    for (const episode of founderEpisodes) {
      expect(episode.sources.length).toBeGreaterThanOrEqual(2)
      for (const decision of episode.decisions) {
        expect(decision.sourceIds.length).toBeGreaterThan(0)
        expect(decision.prompt.classic).not.toBe(decision.prompt.brainrot)
        for (const choice of decision.choices) {
          expect(choice.outcome.classic).not.toBe(choice.outcome.brainrot)
          expect(choice.outcome.classic.length).toBeGreaterThan(35)
          expect(choice.outcome.brainrot.length).toBeGreaterThan(35)
        }
      }
    }
  })

  it('deep-freezes detached episode graphs at every module boundary', () => {
    expectDeepFrozen(founderEpisodes)
    for (const episode of founderEpisodes) expectDeepFrozen(episode)

    expect(new Set(founderEpisodes.map(({ sources }) => sources)).size).toBe(4)
    const decisions = founderEpisodes.flatMap(({ decisions }) => decisions)
    const choices = decisions.flatMap(({ choices }) => choices)
    expect(new Set(decisions).size).toBe(20)
    expect(new Set(choices).size).toBe(60)

    const firstChoice = choiceAt(decisionAt(netflix2011, 0), 0)
    expect(() => {
      firstChoice.label = 'mutated'
    }).toThrow(TypeError)
  })
})
