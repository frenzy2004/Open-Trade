import type { FounderEpisode } from '../content/types'
import { Button } from '../../../shared/ui/Button'

interface EpisodeArchiveProps {
  readonly episodes: readonly FounderEpisode[]
  readonly selectedEpisodeId: string
  readonly onSelect: (episodeId: string) => void
  readonly onBack: () => void
}

export function EpisodeArchive({
  episodes,
  selectedEpisodeId,
  onSelect,
  onBack,
}: EpisodeArchiveProps) {
  const newestFirst = [...episodes].sort(
    (left, right) => right.episodeNumber - left.episodeNumber,
  )

  return (
    <section className="founder-screen founder-archive" aria-labelledby="archive-title">
      <div className="founder-kicker">The archive</div>
      <h1 id="archive-title">Past episodes</h1>
      <p className="founder-deck">Revisit the calls that made—or broke—the company.</p>
      <div className="founder-episode-list">
        {newestFirst.map((episode) => {
          const selected = episode.id === selectedEpisodeId
          return (
            <Button
              key={episode.id}
              className="founder-episode-card"
              variant={selected ? 'primary' : 'secondary'}
              aria-pressed={selected}
              aria-label={`Select Episode ${episode.episodeNumber}: ${episode.company}`}
              onClick={() => onSelect(episode.id)}
            >
              <span>Episode {episode.episodeNumber}</span>
              <strong>{episode.company}</strong>
              <small>{episode.startYear}</small>
            </Button>
          )
        })}
      </div>
      <Button variant="ghost" onClick={onBack}>
        Back to episode
      </Button>
    </section>
  )
}
