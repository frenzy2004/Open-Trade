import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gameRoute as fanstocksRoute } from './fanstocks/route'
import { gameRoute as founderModeRoute } from './founder-mode/route'
import { gameRoute as wallstreetSurfersRoute } from './wallstreet-surfers/route'

const routes = [
  { name: 'FanStocks', route: fanstocksRoute },
  { name: 'Founder Mode', route: founderModeRoute },
  { name: 'Wallstreet Surfers', route: wallstreetSurfersRoute },
] as const

describe('game route resets', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it.each(routes)(
    'stops at the game-save stage when $name storage clearing fails',
    ({ name, route }) => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage remove failed')
      })
      const write = vi.spyOn(Storage.prototype, 'setItem')

      expect(() => route.reset()).toThrow(name + ' game save reset failed')
      expect(write).not.toHaveBeenCalled()
    },
  )

  it.each(routes)(
    'reports the derived-progress stage when $name progress saving fails',
    ({ name, route }) => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage write failed')
      })

      expect(() => route.reset()).toThrow(name + ' progress reset failed')
    },
  )
})
