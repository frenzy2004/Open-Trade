import { Link } from 'react-router-dom'
import { asset, type AssetId } from '../../assets/catalog'
import { SafeImage } from '../../shared/assets/SafeImage'
import { Button } from '../../shared/ui'
import type {
  GameId,
  GameProgressBadge,
  GameRouteMetadata,
} from '../routes/types'

type HubCoverAssetId = Extract<
  AssetId,
  'fs-draft-room' | 'fm-boardroom' | 'ws-runner-street'
>

const COVER_ASSET_BY_GAME: Readonly<Record<GameId, HubCoverAssetId>> = Object.freeze({
  fanstocks: 'fs-draft-room',
  'founder-mode': 'fm-boardroom',
  'wallstreet-surfers': 'ws-runner-street',
})

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
  const cover = asset(COVER_ASSET_BY_GAME[metadata.id])

  return (
    <article className={'game-card game-card--' + metadata.accent}>
      <SafeImage
        className="game-card__cover"
        src={cover.url}
        alt={metadata.coverLabel}
        fallbackLabel={`${metadata.title} artwork unavailable`}
        loading="eager"
      />
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
