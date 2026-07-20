import { Link, useLocation } from 'react-router-dom'
import { APP_DISCLAIMER } from '../app/appMeta'
import type { GameRouteMetadata } from '../app/routes/types'
import { parseChallenge } from '../shared/routing/challenge'

export interface GameFoundationPageProps {
  readonly metadata: GameRouteMetadata
}

export function GameFoundationPage({
  metadata,
}: GameFoundationPageProps) {
  const location = useLocation()
  const challenge = parseChallenge(location.search)

  return (
    <section className="game-foundation" aria-labelledby="game-title">
      <p className="game-foundation__eyebrow">{metadata.eyebrow}</p>
      <h1 id="game-title">{metadata.title}</h1>
      <p>{metadata.description}</p>
      {challenge === null ? (
        <p>Start from the hub to create a fresh guest seed.</p>
      ) : (
        <p>
          Challenge seed {challenge.seed} · ruleset {challenge.rulesetVersion}
        </p>
      )}
      <p className="game-foundation__status">
        The shared shell, save boundary, and challenge contract are ready for
        this game vertical slice.
      </p>
      <p>{APP_DISCLAIMER}</p>
      <Link className="text-link" to="/">
        Back to all games
      </Link>
    </section>
  )
}
