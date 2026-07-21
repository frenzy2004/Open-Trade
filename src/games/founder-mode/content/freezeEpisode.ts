import type {
  FounderChoice,
  FounderDecision,
  FounderEpisode,
  FounderSource,
} from './types'

function freezeSource(source: FounderSource): FounderSource {
  return Object.freeze({ ...source })
}

function freezeChoice(choice: FounderChoice): FounderChoice {
  return Object.freeze({
    ...choice,
    styleWeights: Object.freeze({ ...choice.styleWeights }),
    outcome: Object.freeze({ ...choice.outcome }),
  })
}

function freezeDecision(decision: FounderDecision): FounderDecision {
  return Object.freeze({
    ...decision,
    prompt: Object.freeze({ ...decision.prompt }),
    sourceIds: Object.freeze([...decision.sourceIds]) as unknown as string[],
    choices: Object.freeze(
      decision.choices.map(freezeChoice),
    ) as unknown as FounderChoice[],
  })
}

/** Detaches and recursively freezes one authored episode graph. */
export function freezeEpisode(episode: FounderEpisode): FounderEpisode {
  return Object.freeze({
    ...episode,
    intro: Object.freeze({ ...episode.intro }),
    sources: Object.freeze(
      episode.sources.map(freezeSource),
    ) as unknown as FounderSource[],
    decisions: Object.freeze(
      episode.decisions.map(freezeDecision),
    ) as unknown as FounderDecision[],
  })
}
