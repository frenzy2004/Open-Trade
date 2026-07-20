import { describe, expect, it, vi } from 'vitest'
import {
  AudioManager,
  type AudioFactory,
  type PlayableAudio,
} from './AudioManager'

function makeAudio(
  play: () => Promise<void> = () => Promise.resolve(),
): PlayableAudio {
  return {
    currentTime: 0,
    play,
    pause: vi.fn(),
    addEventListener: vi.fn(),
  }
}

describe('AudioManager', () => {
  it('does not create audio while muted', async () => {
    const factory = vi.fn<AudioFactory>(() => makeAudio())
    const manager = new AudioManager(factory)
    manager.setMuted(true)

    await expect(manager.play('/audio/coin.ogg')).resolves.toBe(false)
    expect(factory).not.toHaveBeenCalled()
  })

  it('degrades rejected playback to false', async () => {
    const manager = new AudioManager(() =>
      makeAudio(() => Promise.reject(new Error('blocked'))),
    )

    await expect(manager.play('/audio/coin.ogg')).resolves.toBe(false)
  })

  it('stops every active sound', async () => {
    const first = makeAudio()
    const second = makeAudio()
    const queue = [first, second]
    const manager = new AudioManager(() => {
      const audio = queue.shift()
      if (audio === undefined) {
        throw new Error('No audio left in the test queue')
      }
      return audio
    })

    await manager.play('/audio/first.ogg')
    await manager.play('/audio/second.ogg')
    manager.stopAll()

    expect(first.pause).toHaveBeenCalledOnce()
    expect(second.pause).toHaveBeenCalledOnce()
  })

  it('continues stopping active sounds if one pause fails', async () => {
    const first = makeAudio()
    first.pause = vi.fn(() => {
      throw new Error('pause failed')
    })
    const second = makeAudio()
    const queue = [first, second]
    const manager = new AudioManager(() => {
      const audio = queue.shift()
      if (audio === undefined) {
        throw new Error('No audio left in the test queue')
      }
      return audio
    })

    await manager.play('/audio/first.ogg')
    await manager.play('/audio/second.ogg')

    expect(() => manager.stopAll()).not.toThrow()
    expect(first.pause).toHaveBeenCalledOnce()
    expect(second.pause).toHaveBeenCalledOnce()
  })
})
