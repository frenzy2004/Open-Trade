import type { FounderEpisode, WritingStyle } from '../content/types'
import { Button } from '../../../shared/ui/Button'

interface FounderLandingProps {
  readonly episode: FounderEpisode
  readonly style: WritingStyle
  readonly streakDays: number
  readonly onStyleChange: (style: WritingStyle) => void
  readonly onPlay: () => void
  readonly onOpenArchive: () => void
}

export function FounderLanding({
  episode,
  style,
  streakDays,
  onStyleChange,
  onPlay,
  onOpenArchive,
}: FounderLandingProps) {
  return (
    <section className="founder-screen founder-landing" aria-labelledby="founder-title">
      <div className="founder-kicker">Episode {episode.episodeNumber}</div>
      <h1 id="founder-title">Founder Mode</h1>
      <p className="founder-company">{episode.company}</p>
      <p className="founder-deck">
        {episode.founder}, {episode.startYear}. The board is waiting for your call.
      </p>
      <p className="founder-streak" aria-live="polite">
        Founder streak: {streakDays} {streakDays === 1 ? 'day' : 'days'}
      </p>

      <fieldset className="founder-style-picker">
        <legend>Writing style</legend>
        <div className="founder-style-options" role="radiogroup" aria-label="Writing style">
          <label
            className="founder-style-option"
            data-selected={style === 'classic'}
          >
            <input
              className="visually-hidden"
              type="radio"
              name="founder-writing-style"
              value="classic"
              checked={style === 'classic'}
              onChange={() => onStyleChange('classic')}
            />
            <span>Classic</span>
          </label>
          <label
            className="founder-style-option"
            data-selected={style === 'brainrot'}
          >
            <input
              className="visually-hidden"
              type="radio"
              name="founder-writing-style"
              value="brainrot"
              checked={style === 'brainrot'}
              onChange={() => onStyleChange('brainrot')}
            />
            <span>Brainrot</span>
          </label>
        </div>
      </fieldset>

      <div className="founder-actions">
        <Button onClick={onPlay}>Play episode</Button>
        <Button variant="secondary" onClick={onOpenArchive}>
          Past episodes
        </Button>
      </div>
    </section>
  )
}
