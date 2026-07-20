const SEED_PATTERN = /^[a-z0-9_-]{1,64}$/i

export interface ChallengeDescriptor {
  readonly seed: string
  readonly rulesetVersion: number
}

export function parseChallenge(
  input: string | URLSearchParams,
): ChallengeDescriptor | null {
  const params =
    typeof input === 'string'
      ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
      : input
  const rawSeed = params.get('seed')
  const rawRuleset = params.get('rules')

  if (rawSeed === null || rawRuleset === null) {
    return null
  }

  const rulesetVersion = Number(rawRuleset)
  if (
    !SEED_PATTERN.test(rawSeed) ||
    !Number.isSafeInteger(rulesetVersion) ||
    rulesetVersion < 1
  ) {
    return null
  }

  return { seed: rawSeed, rulesetVersion }
}

export function formatChallenge(descriptor: ChallengeDescriptor): string {
  const parsed = parseChallenge(
    new URLSearchParams({
      seed: descriptor.seed,
      rules: String(descriptor.rulesetVersion),
    }),
  )

  if (parsed === null) {
    throw new RangeError('Challenge descriptor is invalid')
  }

  const params = new URLSearchParams()
  params.set('seed', parsed.seed)
  params.set('rules', String(parsed.rulesetVersion))
  return '?' + params.toString()
}

export function createGuestSeed(): string {
  const values = new Uint32Array(2)
  crypto.getRandomValues(values)
  return Array.from(values, (value) =>
    value.toString(36).padStart(7, '0'),
  ).join('')
}
