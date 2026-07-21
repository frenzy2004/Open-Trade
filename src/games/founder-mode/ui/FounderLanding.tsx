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
          <Button
            variant={style === 'classic' ? 'primary' : 'secondary'}
            role="radio"
            aria-checked={style === 'classic'}
            onClick={() => onStyleChange('classic')}
          >
            Classic
          </Button>
          <Button
            variant={style === 'brainrot' ? 'primary' : 'secondary'}
            role="radio"
            aria-checked={style === 'brainrot'}
            onClick={() => onStyleChange('brainrot')}
          >
            Brainrot
          </Button>
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
