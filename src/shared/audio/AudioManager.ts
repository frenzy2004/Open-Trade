export interface PlayableAudio {
  currentTime: number
  loop: boolean
  volume: number
  play(): Promise<void>
  pause(): void
  addEventListener(
    type: 'ended',
    listener: () => void,
    options: { once: true },
  ): void
}

export type AudioFactory = (src: string) => PlayableAudio

interface ActiveAudio {
  readonly gain: number
  readonly source: string
  readonly loop: boolean
}

const DEFAULT_VOLUME = 0.7
const DEFAULT_LOOP_GAIN = 0.35
const SILENT_UNLOCK_SOURCE =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

function browserAudioFactory(src: string): PlayableAudio {
  return new Audio(src)
}

function validGain(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1
}

export class AudioManager {
  private muted = false
  private volume = DEFAULT_VOLUME
  private unlocked = false
  private disposed = false
  private pageSuspended = false
  private unlocking: Promise<boolean> | null = null
  private readonly active = new Map<PlayableAudio, ActiveAudio>()
  private readonly loops = new Map<string, PlayableAudio>()
  private readonly pausedForSuspend = new Set<PlayableAudio>()

  constructor(
    private readonly createAudio: AudioFactory = browserAudioFactory,
  ) {}

  isUnlocked(): boolean {
    return this.unlocked
  }

  getVolume(): number {
    return this.volume
  }

  async unlock(): Promise<boolean> {
    if (this.disposed) return false
    if (this.unlocked) return true
    if (this.unlocking !== null) return this.unlocking

    const attempt = this.performUnlock()
    this.unlocking = attempt
    try {
      return await attempt
    } finally {
      if (this.unlocking === attempt) this.unlocking = null
    }
  }

  private async performUnlock(): Promise<boolean> {
    let audio: PlayableAudio | null = null
    try {
      audio = this.createAudio(SILENT_UNLOCK_SOURCE)
      audio.loop = false
      audio.volume = 0
      audio.currentTime = 0
      await audio.play()
      audio.pause()
      audio.currentTime = 0
      if (this.disposed) return false
      this.unlocked = true
      return true
    } catch {
      if (audio !== null) this.pauseAndReset(audio)
      return false
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) this.stopAll()
  }

  setVolume(volume: number): void {
    if (!validGain(volume)) {
      throw new RangeError('Audio volume must be finite and between 0 and 1')
    }
    this.volume = volume
    for (const [audio, metadata] of this.active) {
      try {
        audio.volume = volume * metadata.gain
      } catch {
        // A broken element must not block the remaining volume updates.
      }
    }
  }

  play(src: string, gain = 1): Promise<boolean> {
    return this.start(src, gain, false)
  }

  loop(src: string, gain = DEFAULT_LOOP_GAIN): Promise<boolean> {
    return this.start(src, gain, true)
  }

  private async start(
    src: string,
    gain: number,
    shouldLoop: boolean,
  ): Promise<boolean> {
    if (
      this.disposed
      || this.muted
      || this.pageSuspended
      || typeof src !== 'string'
      || src.length === 0
      || !validGain(gain)
    ) {
      return false
    }

    if (shouldLoop) {
      const existing = this.loops.get(src)
      if (existing !== undefined && this.active.has(existing)) return true
      this.loops.delete(src)
    }

    let audio: PlayableAudio | null = null
    try {
      const createdAudio = this.createAudio(src)
      audio = createdAudio
      createdAudio.currentTime = 0
      createdAudio.loop = shouldLoop
      createdAudio.volume = this.volume * gain
      const metadata = Object.freeze({
        gain,
        source: src,
        loop: shouldLoop,
      })
      this.active.set(createdAudio, metadata)
      if (shouldLoop) this.loops.set(src, createdAudio)
      createdAudio.addEventListener(
        'ended',
        () => this.forget(createdAudio),
        { once: true },
      )
      await createdAudio.play()
      return !this.disposed && !this.muted && this.active.has(createdAudio)
    } catch {
      if (audio !== null) {
        this.pauseAndReset(audio)
        this.forget(audio)
      }
      return false
    }
  }

  suspend(): void {
    if (this.disposed) return
    this.pageSuspended = true
    for (const audio of this.active.keys()) {
      try {
        audio.pause()
      } catch {
        // Continue suspending remaining sounds.
      }
      this.pausedForSuspend.add(audio)
    }
  }

  async resume(): Promise<void> {
    if (this.disposed) return
    this.pageSuspended = false
    if (this.muted) return
    const pending = [...this.pausedForSuspend]
    this.pausedForSuspend.clear()
    for (const audio of pending) {
      if (!this.active.has(audio)) continue
      try {
        await audio.play()
      } catch {
        this.pauseAndReset(audio)
        this.forget(audio)
      }
    }
  }

  stopAll(): void {
    for (const audio of this.active.keys()) this.pauseAndReset(audio)
    this.active.clear()
    this.loops.clear()
    this.pausedForSuspend.clear()
  }

  dispose(): void {
    if (this.disposed) return
    this.stopAll()
    this.disposed = true
  }

  private pauseAndReset(audio: PlayableAudio): void {
    try {
      audio.pause()
    } catch {
      // Continue cleanup even if pausing a broken element fails.
    }
    try {
      audio.currentTime = 0
    } catch {
      // Continue cleanup even if seeking a broken element fails.
    }
  }

  private forget(audio: PlayableAudio): void {
    const metadata = this.active.get(audio)
    this.active.delete(audio)
    this.pausedForSuspend.delete(audio)
    if (
      metadata?.loop === true
      && this.loops.get(metadata.source) === audio
    ) {
      this.loops.delete(metadata.source)
    }
  }
}
