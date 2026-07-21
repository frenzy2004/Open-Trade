// @ts-expect-error -- Vitest runs in Node, while the application tsconfig intentionally omits Node ambient types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import route from '../FanStocksRoute.tsx?raw'

const css = readFileSync('src/games/fanstocks/fanstocks.css', 'utf8') as string

describe('FanStocks CSS contract', () => {
  it('contains the required mobile, focus, touch, overflow, and reduced-motion rules', () => {
    expect(css).toContain('@media (max-width: 767px)')
    expect(css).toContain('@media (max-width: 900px)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('scroll-snap-type: x mandatory')
    expect(css).toContain('min-height: 44px')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('overflow-x: clip')
    expect(css).toContain('.league-screen__player {')
    expect(css).toContain('position: fixed')
    expect(css).toContain('.trade-flight { display: none; }')
  })

  it('loads the generated local draft-room atmosphere with a fallback overlay', () => {
    expect(css).toContain('var(--fs-draft-room, none)')
    expect(css).not.toContain("url('../../assets/generated/fanstocks/draft-room.webp')")
    expect(css).toContain('linear-gradient(')
    expect(route).toContain("import './fanstocks.css'")
    expect(route).toContain("asset('fs-draft-room').url")
    expect(css).toContain('.fanstocks-app::before { position: absolute; }')
  })
})
