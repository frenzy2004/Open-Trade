export const RUNNER_E2E_CHALLENGE = Object.freeze({
  seed: 'e2e-6',
  firstEntity: 'coin:iqmj8u-obstacle-0-0@62.0m',
  failure: 'AUCL train flattened you',
  tip: 'Switch lanes before the ticker train',
})

export function runnerChallengeHash(): string {
  const params = new URLSearchParams({
    seed: RUNNER_E2E_CHALLENGE.seed,
    rules: '1',
    debug: '1',
  })
  return `#/wallstreet-surfers?${params.toString()}`
}

