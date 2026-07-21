import type {
  FounderChoice,
  FounderEpisode,
  FounderStyle,
} from '../content/types'
import type { FounderRunState } from './founderState'

export type FounderScoreTier =
  | 'legend'
  | 'builder'
  | 'survivor'
  | 'cautionary'

export interface FounderScore {
  readonly valueRatio: number
  readonly matchedHistoryCount: number
  readonly workedCount: number
  readonly stylePercentages: Readonly<Record<FounderStyle, number>>
  readonly tier: FounderScoreTier
}

const STYLE_ORDER: readonly FounderStyle[] = [
  'visionary',
  'operator',
  'consensus',
]

function choiceForHistory(
  state: FounderRunState,
  episode: FounderEpisode,
): readonly FounderChoice[] {
  const choices: FounderChoice[] = []
  const seenDecisionIds = new Set<string>()

  for (const item of state.history) {
    if (seenDecisionIds.has(item.decisionId)) continue
    const decision = episode.decisions.find(({ id }) => id === item.decisionId)
    const choice = decision?.choices.find(({ id }) => id === item.choiceId)
    if (!choice) continue
    seenDecisionIds.add(item.decisionId)
    choices.push(choice)
  }

  return choices
}

function normalizedPercentages(
  choices: readonly FounderChoice[],
): Readonly<Record<FounderStyle, number>> {
  const weights: Record<FounderStyle, number> = {
    visionary: 0,
    operator: 0,
    consensus: 0,
  }
  for (const choice of choices) {
    for (const style of STYLE_ORDER) {
      const value = choice.styleWeights[style]
      if (Number.isFinite(value) && value > 0) weights[style] += value
    }
  }

  const total = STYLE_ORDER.reduce((sum, style) => sum + weights[style], 0)
  if (total <= 0) {
    return Object.freeze({ visionary: 34, operator: 33, consensus: 33 })
  }

  const raw = STYLE_ORDER.map((style) => (weights[style] / total) * 100)
  const whole = raw.map(Math.floor)
  let remainder = 100 - whole.reduce((sum, value) => sum + value, 0)
  const remainderOrder = STYLE_ORDER.map((style, index) => ({
    style,
    index,
    fraction: (raw[index] ?? 0) - (whole[index] ?? 0),
  })).sort(
    (left, right) =>
      right.fraction - left.fraction || left.index - right.index,
  )

  for (const item of remainderOrder) {
    if (remainder <= 0) break
    whole[item.index] = (whole[item.index] ?? 0) + 1
    remainder -= 1
  }

  return Object.freeze({
    visionary: whole[0] ?? 0,
    operator: whole[1] ?? 0,
    consensus: whole[2] ?? 0,
  })
}

function tierForRatio(valueRatio: number): FounderScoreTier {
  if (valueRatio >= 1.5) return 'legend'
  if (valueRatio >= 1) return 'builder'
  if (valueRatio >= 0.7) return 'survivor'
  return 'cautionary'
}

const reachableValuesByEpisode = new WeakMap<
  FounderEpisode,
  readonly number[]
>()

function reachableEndingValues(episode: FounderEpisode): readonly number[] {
  const cached = reachableValuesByEpisode.get(episode)
  if (cached) return cached

  let values: readonly number[] = [episode.initialValueBn]
  for (const decision of episode.decisions) {
    values = values.flatMap((value) =>
      decision.choices.map(
        ({ valueMultiplier }) =>
          Math.round(value * valueMultiplier * 10) / 10,
      ),
    )
  }
  const sorted = Object.freeze([...values].sort((left, right) => left - right))
  reachableValuesByEpisode.set(episode, sorted)
  return sorted
}

function tierForCompletedRun(
  currentValueBn: number,
  episode: FounderEpisode,
): FounderScoreTier {
  const values = reachableEndingValues(episode)
  if (values.length === 0 || !Number.isFinite(currentValueBn)) {
    return 'cautionary'
  }
  let lowerCount = 0
  let equalCount = 0
  for (const value of values) {
    if (value < currentValueBn) lowerCount += 1
    else if (value === currentValueBn) equalCount += 1
  }
  const percentile = (lowerCount + equalCount / 2) / values.length
  if (percentile >= 0.9) return 'legend'
  if (percentile >= 0.55) return 'builder'
  if (percentile >= 0.25) return 'survivor'
  return 'cautionary'
}

export function scoreFounderRun(
  state: FounderRunState,
  episode: FounderEpisode,
): FounderScore {
  const denominator = episode.historicalEndValueBn
  const valueRatio =
    Number.isFinite(state.currentValueBn) &&
    state.currentValueBn >= 0 &&
    Number.isFinite(denominator) &&
    denominator > 0
      ? state.currentValueBn / denominator
      : 0
  const choices = choiceForHistory(state, episode)
  const stylePercentages = normalizedPercentages(choices)

  return Object.freeze({
    valueRatio,
    matchedHistoryCount: choices.filter(({ matchedHistory }) => matchedHistory)
      .length,
    workedCount: choices.filter(({ worked }) => worked).length,
    stylePercentages,
    tier:
      state.history.length === episode.decisions.length
        ? tierForCompletedRun(state.currentValueBn, episode)
        : tierForRatio(valueRatio),
  })
}
