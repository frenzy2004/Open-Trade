import { describe, expect, it } from 'vitest'
import { createSeededRng } from './seededRng'

describe('createSeededRng', () => {
  it('matches the approved Mulberry32 sequence', () => {
    const rng = createSeededRng(123456789)

    expect([rng.next(), rng.next(), rng.next()]).toEqual([
      0.2577907438389957,
      0.9707721115555614,
      0.7853280142880976,
    ])
  })

  it('normalizes string seeds deterministically', () => {
    expect(createSeededRng('guest-league').seed).toBe(
      createSeededRng('guest-league').seed,
    )
    expect(createSeededRng('guest-league').seed).not.toBe(
      createSeededRng('other-league').seed,
    )
  })

  it('keeps integer results inside a half-open range', () => {
    const rng = createSeededRng(42)
    const values = Array.from({ length: 200 }, () => rng.int(2, 5))

    expect(values.every((value) => value >= 2 && value < 5)).toBe(true)
    expect(new Set(values)).toEqual(new Set([2, 3, 4]))
  })

  it('picks and shuffles without mutating source content', () => {
    const rng = createSeededRng(9)
    const source = ['A', 'B', 'C', 'D'] as const
    const shuffled = rng.shuffle(source)

    expect(source).toEqual(['A', 'B', 'C', 'D'])
    expect([...shuffled].sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(source).toContain(rng.pick(source))
  })

  it('rejects invalid ranges and empty picks', () => {
    const rng = createSeededRng(1)

    expect(() => rng.int(4, 4)).toThrow('maxExclusive must be greater')
    expect(() => rng.pick([])).toThrow('Cannot pick from an empty list')
  })

  it('forks stable independent streams from a label', () => {
    const rng = createSeededRng(77)

    expect(rng.fork('prices').seed).toBe(rng.fork('prices').seed)
    expect(rng.fork('prices').seed).not.toBe(rng.fork('trades').seed)
  })
})
