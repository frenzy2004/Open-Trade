import type { ComponentType } from 'react'
import type { ChallengeDescriptor } from '../../shared/routing/challenge'

export type GameId =
  | 'fanstocks'
  | 'founder-mode'
  | 'wallstreet-surfers'

export interface GameProgressBadge {
  readonly label: string
  readonly value: string
  readonly tone: 'neutral' | 'positive' | 'warning'
}

export interface GameRouteMetadata {
  readonly id: GameId
  readonly path:
    | '/fanstocks'
    | '/founder-mode'
    | '/wallstreet-surfers'
  readonly title: string
  readonly eyebrow: string
  readonly tagline: string
  readonly description: string
  readonly howItWorks: readonly [string, string, string]
  readonly coverLabel: string
  readonly accent: 'yellow' | 'green' | 'red'
}

export interface GameRouteModule {
  readonly metadata: GameRouteMetadata
  readonly Entry: ComponentType
  readonly saveKey: string
  readonly reset: () => void
  readonly getProgressBadge: () => GameProgressBadge
  readonly parseChallenge?: (
    input: string | URLSearchParams,
  ) => ChallengeDescriptor | null
}

export interface GameRouteRegistration {
  readonly metadata: GameRouteMetadata
  readonly load: () => Promise<{ readonly gameRoute: GameRouteModule }>
}
