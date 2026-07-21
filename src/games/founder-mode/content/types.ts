export type WritingStyle = 'classic' | 'brainrot'

export type StyledCopy = Record<WritingStyle, string>

export type FounderStyle = 'visionary' | 'operator' | 'consensus'

export interface FounderSource {
  id: string
  title: string
  url: string
  publisher: string
  accessed: string
}

export interface FounderChoice {
  id: string
  label: string
  matchedHistory: boolean
  worked: boolean
  valueMultiplier: number
  styleWeights: Record<FounderStyle, number>
  outcome: StyledCopy
}

export interface FounderDecision {
  id: string
  year: number
  prompt: StyledCopy
  sourceIds: string[]
  choices: FounderChoice[]
}

export interface FounderEpisode {
  id: string
  episodeNumber: number
  company: string
  founder: string
  startYear: number
  rulesetVersion: number
  initialValueBn: number
  historicalEndValueBn: number
  intro: StyledCopy
  sources: FounderSource[]
  decisions: FounderDecision[]
}
