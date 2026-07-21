import {
  formatChallenge,
  parseChallenge,
  type ChallengeDescriptor,
} from '../../shared/routing/challenge'

const RUNNER_HASH_PATH = '/wallstreet-surfers'

export function createChallengeHash(
  seed: string,
  rulesetVersion: number,
): string {
  try {
    return `#${RUNNER_HASH_PATH}${formatChallenge({ seed, rulesetVersion })}`
  } catch {
    throw new RangeError('Runner challenge descriptor is invalid')
  }
}

export function parseChallengeHash(input: string): ChallengeDescriptor | null {
  if (typeof input !== 'string') return null
  const hashIndex = input.indexOf('#')
  const fragment = hashIndex === -1 ? input : input.slice(hashIndex + 1)
  const queryIndex = fragment.indexOf('?')
  if (queryIndex === -1 || fragment.slice(0, queryIndex) !== RUNNER_HASH_PATH) {
    return null
  }
  return parseChallenge(fragment.slice(queryIndex + 1))
}
