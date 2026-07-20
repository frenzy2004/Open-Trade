export interface PlayableAudio {
  currentTime: number
  play(): Promise<void>
  pause(): void
  addEventListener(
    type: 'ended',
    listener: () => void,
    options: { once: true },
  ): void
}

export type AudioFactory = (src: string) => PlayableAudio

function browserAudioFactory(src: string): PlayableAudio {
  return new Audio(src)
}

export class AudioManager {
  private muted = false
  private readonly active = new Set<PlayableAudio>()

  constructor(
    private readonly createAudio: AudioFactory = browserAudioFactory,
  ) {}

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) {
      this.stopAll()
    }
  }

  async play(src: string): Promise<boolean> {
    if (this.muted) {
      return false
    }

    let audio: PlayableAudio | null = null
    try {
      const createdAudio = this.createAudio(src)
      audio = createdAudio
      createdAudio.currentTime = 0
      this.active.add(createdAudio)
      createdAudio.addEventListener(
        'ended',
        () => {
          this.active.delete(createdAudio)
        },
        { once: true },
      )
      await createdAudio.play()
      return true
    } catch {
      if (audio !== null) {
        this.active.delete(audio)
      }
      return false
    }
  }

  stopAll(): void {
    for (const audio of this.active) {
      try {
        audio.pause()
      } catch {
        // Continue attempting to stop the remaining active sounds.
      }
      try {
        audio.currentTime = 0
      } catch {
        // A broken audio element must not block cleanup of other sounds.
      }
    }
    this.active.clear()
  }
}
