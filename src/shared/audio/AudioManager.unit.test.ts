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
    loop: false,
    volume: 1,
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

  it('unlocks once with silent playback and never rejects a blocked unlock', async () => {
    const playable = makeAudio()
    const factory = vi.fn<AudioFactory>(() => playable)
    const manager = new AudioManager(factory)

    await expect(manager.unlock()).resolves.toBe(true)
    await expect(manager.unlock()).resolves.toBe(true)
    expect(factory).toHaveBeenCalledOnce()
    expect(playable.volume).toBe(0)
    expect(playable.pause).toHaveBeenCalledOnce()
    expect(manager.isUnlocked()).toBe(true)

    const blocked = new AudioManager(() =>
      makeAudio(() => Promise.reject(new Error('gesture blocked'))),
    )
    await expect(blocked.unlock()).resolves.toBe(false)
    expect(blocked.isUnlocked()).toBe(false)
  })

  it('keeps one loop per source and applies master and per-sound gain', async () => {
    const playable = makeAudio()
    const factory = vi.fn<AudioFactory>(() => playable)
    const manager = new AudioManager(factory)
    manager.setVolume(0.5)

    await expect(manager.loop('/audio/arcade.ogg', 0.4)).resolves.toBe(true)
    await expect(manager.loop('/audio/arcade.ogg', 0.4)).resolves.toBe(true)
    expect(factory).toHaveBeenCalledOnce()
    expect(playable.loop).toBe(true)
    expect(playable.volume).toBeCloseTo(0.2)

    manager.setVolume(0.25)
    expect(playable.volume).toBeCloseTo(0.1)
  })

  it('suspends and resumes active audio without surfacing playback failures', async () => {
    const firstPlay = vi.fn<() => Promise<void>>().mockResolvedValue()
    const secondPlay = vi.fn<() => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('decode failed'))
    const first = makeAudio(firstPlay)
    const second = makeAudio(secondPlay)
    const queue = [first, second]
    const manager = new AudioManager(() => {
      const next = queue.shift()
      if (next === undefined) throw new Error('No audio left')
      return next
    })
    await manager.play('/audio/first.ogg')
    await manager.play('/audio/second.ogg')

    manager.suspend()
    expect(first.pause).toHaveBeenCalledOnce()
    expect(second.pause).toHaveBeenCalledOnce()
    await expect(manager.resume()).resolves.toBeUndefined()
    expect(firstPlay).toHaveBeenCalledTimes(2)
    expect(secondPlay).toHaveBeenCalledTimes(2)
  })

  it('drops new sounds while suspended and accepts them after resume', async () => {
    const playable = makeAudio()
    const factory = vi.fn<AudioFactory>(() => playable)
    const manager = new AudioManager(factory)

    manager.suspend()
    await expect(manager.play('/audio/hidden.ogg')).resolves.toBe(false)
    await expect(manager.loop('/audio/hidden-loop.ogg')).resolves.toBe(false)
    expect(factory).not.toHaveBeenCalled()

    await manager.resume()
    await expect(manager.play('/audio/visible.ogg')).resolves.toBe(true)
    expect(factory).toHaveBeenCalledOnce()
  })

  it('disposes all audio and refuses later playback', async () => {
    const playable = makeAudio()
    const factory = vi.fn<AudioFactory>(() => playable)
    const manager = new AudioManager(factory)
    await manager.play('/audio/first.ogg')

    manager.dispose()
    await expect(manager.play('/audio/second.ogg')).resolves.toBe(false)
    await expect(manager.loop('/audio/loop.ogg')).resolves.toBe(false)
    expect(playable.pause).toHaveBeenCalledOnce()
    expect(factory).toHaveBeenCalledOnce()
  })

  it('rejects invalid master volume without mutating the current value', () => {
    const manager = new AudioManager()
    expect(() => manager.setVolume(Number.NaN)).toThrow('between 0 and 1')
    expect(() => manager.setVolume(-0.1)).toThrow('between 0 and 1')
    expect(() => manager.setVolume(1.1)).toThrow('between 0 and 1')
    expect(manager.getVolume()).toBe(0.7)
  })
})
