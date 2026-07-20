import { describe, expect, it } from 'vitest'
import { APP_DISCLAIMER, APP_NAME } from './appMeta'

describe('app metadata', () => {
  it('uses the approved product name and disclaimer', () => {
    expect(APP_NAME).toBe('OpenTrade')
    expect(APP_DISCLAIMER).toBe('Simulated game — not investment advice')
  })
})
