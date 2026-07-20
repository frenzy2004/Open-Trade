import { Link } from 'react-router-dom'
import { Button } from '../../shared/ui'
import type {
  GameProgressBadge,
  GameRouteMetadata,
} from '../routes/types'

export interface GameCardProps {
  readonly metadata: GameRouteMetadata
  readonly badge: GameProgressBadge
  readonly onHowItWorks: () => void
  readonly onReset: () => void
}

export function GameCard({
  metadata,
  badge,
  onHowItWorks,
  onReset,
}: GameCardProps) {
  return (
    <article className={'game-card game-card--' + metadata.accent}>
      <div
        className="game-card__cover"
        role="img"
        aria-label={metadata.coverLabel}
      >
        <span aria-hidden="true">{metadata.title.slice(0, 2)}</span>
      </div>
      <div className="game-card__body">
        <p className="game-card__eyebrow">{metadata.eyebrow}</p>
        <h2>{metadata.title}</h2>
        <p className="game-card__tagline">{metadata.tagline}</p>
        <p>{metadata.description}</p>
        <p
          className={'game-card__badge game-card__badge--' + badge.tone}
          aria-label={badge.label + ': ' + badge.value}
        >
          <span>{badge.label}</span>
          <strong>{badge.value}</strong>
        </p>
        <div className="game-card__actions">
          <Link
            aria-label={'Play ' + metadata.title}
            className="ui-button ui-button--primary"
            to={metadata.path}
          >
            Play {metadata.title}
          </Link>
          <Button
            aria-label={'How ' + metadata.title + ' works'}
            variant="secondary"
            onClick={onHowItWorks}
          >
            How it works
          </Button>
          <Button
            aria-label={'Reset ' + metadata.title + ' progress'}
            variant="secondary"
            onClick={onReset}
          >
            Reset progress
          </Button>
        </div>
      </div>
    </article>
  )
}
