import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGuestSeed,
  formatChallenge,
  parseChallenge,
} from './challenge'

describe('challenge descriptors', () => {
  it('round-trips a seed and ruleset in stable key order', () => {
    const descriptor = { seed: 'guest-314159', rulesetVersion: 1 }

    expect(formatChallenge(descriptor)).toBe(
      '?seed=guest-314159&rules=1',
    )
    expect(parseChallenge(formatChallenge(descriptor))).toEqual(descriptor)
  })

  it('rejects missing, unsafe, fractional, and non-positive values', () => {
    expect(parseChallenge('?rules=1')).toBeNull()
    expect(parseChallenge('?seed=contains%20spaces&rules=1')).toBeNull()
    expect(parseChallenge('?seed=guest&rules=1.5')).toBeNull()
    expect(parseChallenge('?seed=guest&rules=0')).toBeNull()
  })

  it('creates a guest seed from browser cryptography', () => {
    vi.stubGlobal('crypto', {
      getRandomValues(buffer: Uint32Array) {
        buffer[0] = 987654321
        buffer[1] = 123456789
        return buffer
      },
    })

    expect(createGuestSeed()).toBe('0gc0uy9021i3v9')
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
