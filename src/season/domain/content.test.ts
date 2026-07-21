import { describe, expect, it } from 'vitest'
import { SEASON_THESIS_DECK } from './content'

describe('SEASON_THESIS_DECK', () => {
  it('ships six unique deterministic theses with a complete Tue-to-Fri arc', () => {
    expect(SEASON_THESIS_DECK).toHaveLength(6)
    expect(new Set(SEASON_THESIS_DECK.map((thesis) => thesis.id)).size).toBe(6)

    for (const thesis of SEASON_THESIS_DECK) {
      expect(thesis).toMatchObject({
        id: expect.stringMatching(/^[a-z0-9-]+$/),
        ticker: expect.stringMatching(/^[A-Z]{1,5}$/),
        benchmark: expect.stringMatching(/^[A-Z]{1,5}$/),
        startingAiConfidence: expect.any(Number),
      })
      expect(thesis.prompt.length).toBeGreaterThan(30)
      expect(thesis.updates.map((update) => update.day)).toEqual([
        'Tuesday',
        'Wednesday',
        'Thursday',
      ])
      expect(thesis.updates.map((update) => update.index)).toEqual([0, 1, 2])
      expect(thesis.updates.every((update) => update.summary.length > 30)).toBe(true)
      expect(thesis.result.reasonSignals.length).toBeGreaterThanOrEqual(2)
      expect(Number.isFinite(thesis.result.assetReturnBps)).toBe(true)
      expect(Number.isFinite(thesis.result.benchmarkReturnBps)).toBe(true)
    }
  })

  it('is deeply frozen so canonical evidence cannot be rewritten at runtime', () => {
    expect(Object.isFrozen(SEASON_THESIS_DECK)).toBe(true)

    for (const thesis of SEASON_THESIS_DECK) {
      expect(Object.isFrozen(thesis)).toBe(true)
      expect(Object.isFrozen(thesis.updates)).toBe(true)
      expect(Object.isFrozen(thesis.result)).toBe(true)
      expect(Object.isFrozen(thesis.result.reasonSignals)).toBe(true)
      expect(thesis.updates.every(Object.isFrozen)).toBe(true)
    }
  })
})
