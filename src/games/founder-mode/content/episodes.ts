import { apple1997 } from './apple1997'
import { blockbuster2000 } from './blockbuster2000'
import { kodak1975 } from './kodak1975'
import { netflix2011 } from './netflix2011'
import type { FounderEpisode } from './types'

export const founderEpisodes: readonly FounderEpisode[] = Object.freeze([
  netflix2011,
  kodak1975,
  apple1997,
  blockbuster2000,
])

const EPISODE_BY_ID = new Map(
  founderEpisodes.map((episode) => [episode.id, episode] as const),
)

export function founderEpisodeById(id: string): FounderEpisode | undefined {
  return typeof id === 'string' ? EPISODE_BY_ID.get(id) : undefined
}
