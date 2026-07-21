import { describe, expect, it } from 'vitest'
import { ASSET_CATALOG, ASSET_CATALOG_IDS, asset } from './catalog'

const EXPECTED_IDS = [
  'season-week',
  'fs-draft-room',
  'fm-boardroom',
  'ws-runner-street',
  'ws-runner-avatar',
  'ws-train',
  'ws-barrier',
  'ws-long-arrow',
  'ws-short-arrow',
  'ws-coin',
  'ws-run-loop',
  'ui-confirm',
  'market-success',
  'market-failure',
  'coin-pickup',
  'collision',
  'arcade-loop',
] as const

describe('Higgsfield asset catalog', () => {
  it('exposes the exact immutable 17-asset contract', () => {
    expect(ASSET_CATALOG_IDS).toEqual(EXPECTED_IDS)
    expect(Object.keys(ASSET_CATALOG)).toEqual(EXPECTED_IDS)
    expect(Object.isFrozen(ASSET_CATALOG_IDS)).toBe(true)
    expect(Object.isFrozen(ASSET_CATALOG)).toBe(true)

    for (const id of EXPECTED_IDS) {
      expect(asset(id)).toBe(ASSET_CATALOG[id])
      expect(asset(id).id).toBe(id)
      expect(Object.isFrozen(asset(id))).toBe(true)
    }
  })

  it('resolves every entry to a bundled local URL', () => {
    for (const id of EXPECTED_IDS) {
      const record = asset(id)
      expect(record.url).toMatch(/\.(?:png|webp|ogg)(?:\?|$)/)
      expect(record.url).not.toMatch(/^https?:/)
      expect(record.alt.trim().length).toBeGreaterThan(0)
    }
  })

  it('rejects prototype and unknown runtime lookups', () => {
    expect(() => asset('toString' as never)).toThrow('Unknown asset id')
    expect(() => asset('missing' as never)).toThrow('Unknown asset id')
  })
})
