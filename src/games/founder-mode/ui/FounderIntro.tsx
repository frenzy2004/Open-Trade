import { Button } from '../../../shared/ui/Button'
import type { FounderEpisode, WritingStyle } from '../content/types'

interface FounderIntroProps {
  readonly episode: FounderEpisode
  readonly style: WritingStyle
  readonly onTakeChair: () => void
}

export function FounderIntro({
  episode,
  style,
  onTakeChair,
}: FounderIntroProps) {
  return (
    <section className="founder-screen founder-intro" aria-labelledby="founder-intro-title">
      <div className="founder-kicker">
        Episode {episode.episodeNumber} · {episode.startYear}
      </div>
      <h1 id="founder-intro-title">You are {episode.founder}</h1>
      <p className="founder-company">{episode.company}</p>
      <p className="founder-deck">{episode.intro[style]}</p>
      <dl className="founder-value-card">
        <div>
          <dt>Starting value</dt>
          <dd>${episode.initialValueBn.toFixed(1)}B</dd>
        </div>
        <div>
          <dt>Decisions</dt>
          <dd>{episode.decisions.length}</dd>
        </div>
      </dl>
      <Button onClick={onTakeChair}>Take the chair</Button>
    </section>
  )
}
