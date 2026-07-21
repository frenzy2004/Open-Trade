import {
  findSeasonThesis,
  type SeasonDirection,
  type SeasonEvidenceUpdate,
  type SeasonIdealResponse,
} from './content'

export const SEASON_SCORE_WEIGHTS = Object.freeze({
  direction: 35,
  calibration: 25,
  reasoning: 15,
  evidenceResponse: 15,
  benchmark: 10,
} as const)

export type SeasonPhase = 'draft' | 'invite' | 'updates' | 'settlement' | 'receipt'
export type SeasonUpdateIndex = 0 | 1 | 2

export interface SeasonDraftCallInput {
  readonly thesisId: string
  readonly direction: SeasonDirection
  readonly confidence: number
  readonly reason: string
  readonly evidenceThatChangesMind: string
}

export interface SeasonCallRevisionInput {
  readonly direction: SeasonDirection
  readonly confidence: number
  readonly reason: string
  readonly evidenceThatChangesMind: string
  readonly responseToEvidence: string
}

export interface SeasonCallRevision extends SeasonCallRevisionInput {
  readonly updateIndex: SeasonUpdateIndex
}

export interface SeasonCall {
  readonly thesisId: string
  readonly original: SeasonDraftCallInput
  readonly current: SeasonDraftCallInput
  readonly revisions: readonly SeasonCallRevision[]
}

export interface SeasonLeague {
  readonly code: string
  readonly role: 'host' | 'member'
}

export interface SeasonScoreBreakdown {
  readonly direction: number
  readonly calibration: number
  readonly reasoning: number
  readonly evidenceResponse: number
  readonly benchmark: number
  readonly total: number
}

export interface SeasonCallSettlement {
  readonly thesisId: string
  readonly ticker: string
  readonly outcomeDirection: SeasonDirection
  readonly assetReturnBps: number
  readonly benchmarkReturnBps: number
  readonly matchedReasonSignals: readonly string[]
  readonly matchedEvidenceResponses: number
  readonly score: SeasonScoreBreakdown
}

export interface SeasonSettlement {
  readonly weekIndex: number
  readonly calls: readonly SeasonCallSettlement[]
  readonly score: SeasonScoreBreakdown
}

export interface SeasonReceipt {
  readonly weekIndex: number
  readonly leagueCode: string | null
  readonly score: number
  readonly headline: string
  readonly insights: readonly string[]
  readonly shareText: string
}

export interface SeasonState {
  readonly phase: SeasonPhase
  readonly weekIndex: number
  readonly draft: readonly SeasonDraftCallInput[]
  readonly calls: readonly SeasonCall[]
  readonly league: SeasonLeague | null
  readonly updateIndex: SeasonUpdateIndex
  readonly settlement: SeasonSettlement | null
  readonly receipt: SeasonReceipt | null
}

export interface SeasonCurrentUpdate {
  readonly thesisId: string
  readonly ticker: string
  readonly update: SeasonEvidenceUpdate
}

export type SeasonAction =
  | { readonly type: 'ADD_DRAFT_CALL'; readonly call: SeasonDraftCallInput }
  | { readonly type: 'REMOVE_DRAFT_CALL'; readonly thesisId: string }
  | { readonly type: 'COMMIT_DRAFT' }
  | { readonly type: 'CREATE_LEAGUE' }
  | { readonly type: 'JOIN_LEAGUE'; readonly code: string }
  | { readonly type: 'CONTINUE_SOLO' }
  | {
      readonly type: 'REVISE_CALL'
      readonly thesisId: string
      readonly revision: SeasonCallRevisionInput
    }
  | { readonly type: 'ADVANCE_UPDATE' }
  | { readonly type: 'VIEW_RECEIPT' }
  | { readonly type: 'REMATCH' }

const LEAGUE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const LEAGUE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/
const MAX_NOTE_LENGTH = 320

function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizedNote(value: unknown, required = true): string | null {
  if (typeof value !== 'string') return null
  if (!required) return value.length <= MAX_NOTE_LENGTH ? value : null
  const normalized = value.trim()
  return normalized.length >= 1 && normalized.length <= MAX_NOTE_LENGTH
    ? normalized
    : null
}

function normalizedConfidence(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 50 && (value as number) <= 100
    ? value as number
    : null
}

function normalizeDraftCall(
  value: SeasonDraftCallInput,
  requireComplete = false,
): SeasonDraftCallInput | null {
  if (findSeasonThesis(value.thesisId) === null) return null
  if (value.direction !== 'long' && value.direction !== 'short') return null
  const confidence = normalizedConfidence(value.confidence)
  const reason = normalizedNote(value.reason, requireComplete)
  const evidenceThatChangesMind = normalizedNote(
    value.evidenceThatChangesMind,
    requireComplete,
  )
  if (confidence === null || reason === null || evidenceThatChangesMind === null) return null
  return Object.freeze({
    thesisId: value.thesisId,
    direction: value.direction,
    confidence,
    reason,
    evidenceThatChangesMind,
  })
}

function normalizeRevision(
  value: SeasonCallRevisionInput,
  updateIndex: SeasonUpdateIndex,
): SeasonCallRevision | null {
  if (value.direction !== 'long' && value.direction !== 'short') return null
  const confidence = normalizedConfidence(value.confidence)
  const reason = normalizedNote(value.reason)
  const evidenceThatChangesMind = normalizedNote(value.evidenceThatChangesMind)
  const responseToEvidence = normalizedNote(value.responseToEvidence)
  if (
    confidence === null
    || reason === null
    || evidenceThatChangesMind === null
    || responseToEvidence === null
  ) return null
  return Object.freeze({
    updateIndex,
    direction: value.direction,
    confidence,
    reason,
    evidenceThatChangesMind,
    responseToEvidence,
  })
}

function freezeLeague(league: SeasonLeague | null): SeasonLeague | null {
  return league === null ? null : Object.freeze({ ...league })
}

function freezeState(state: SeasonState): SeasonState {
  return Object.freeze({
    ...state,
    draft: Object.freeze([...state.draft]),
    calls: Object.freeze([...state.calls]),
    league: freezeLeague(state.league),
  })
}

function normalizeLeagueCode(code: unknown): string | null {
  if (typeof code !== 'string') return null
  const normalized = code.trim().toUpperCase()
  return LEAGUE_CODE_PATTERN.test(normalized) ? normalized : null
}

function deterministicLeagueCode(state: SeasonState): string {
  const source = `${state.weekIndex}:${state.calls.map((call) => call.thesisId).join(':')}`
  let hash = 2_166_136_261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619) >>> 0
  }
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    hash = (Math.imul(hash, 1_664_525) + 1_013_904_223) >>> 0
    code += LEAGUE_ALPHABET[hash % LEAGUE_ALPHABET.length]
  }
  return code
}

export function createSeasonState(
  weekIndex = 1,
  leagueCode?: string,
): SeasonState {
  if (!Number.isSafeInteger(weekIndex) || weekIndex < 1) {
    throw new RangeError('Season week index must be a positive safe integer')
  }
  const normalizedCode = leagueCode === undefined ? null : normalizeLeagueCode(leagueCode)
  if (leagueCode !== undefined && normalizedCode === null) {
    throw new RangeError('Season league code must contain six unambiguous characters')
  }
  return freezeState({
    phase: 'draft',
    weekIndex,
    draft: Object.freeze([]),
    calls: Object.freeze([]),
    league: normalizedCode === null
      ? null
      : Object.freeze({ code: normalizedCode, role: 'member' }),
    updateIndex: 0,
    settlement: null,
    receipt: null,
  })
}

function callFromDraft(original: SeasonDraftCallInput): SeasonCall {
  return Object.freeze({
    thesisId: original.thesisId,
    original,
    current: original,
    revisions: Object.freeze([]),
  })
}

function currentFromRevision(
  thesisId: string,
  revision: SeasonCallRevision,
): SeasonDraftCallInput {
  return Object.freeze({
    thesisId,
    direction: revision.direction,
    confidence: revision.confidence,
    reason: revision.reason,
    evidenceThatChangesMind: revision.evidenceThatChangesMind,
  })
}

function classifyResponse(
  previous: SeasonDraftCallInput,
  next: SeasonDraftCallInput,
): SeasonIdealResponse {
  if (previous.direction !== next.direction) return 'flip'
  const change = next.confidence - previous.confidence
  if (change >= 5) return 'increase'
  if (change <= -5) return 'reduce'
  return 'hold'
}

function evidenceResponseScore(call: SeasonCall): {
  readonly points: number
  readonly matches: number
} {
  const thesis = findSeasonThesis(call.thesisId)
  if (thesis === null) return { points: 0, matches: 0 }
  let previous = call.original
  let matches = 0
  for (const update of thesis.updates) {
    const revision = call.revisions.find((candidate) => candidate.updateIndex === update.index)
    const next = revision === undefined
      ? previous
      : currentFromRevision(call.thesisId, revision)
    if (classifyResponse(previous, next) === update.idealResponse) matches += 1
    previous = next
  }
  return {
    points: roundScore(SEASON_SCORE_WEIGHTS.evidenceResponse * matches / 3),
    matches,
  }
}

function scoreBreakdown(
  direction: number,
  calibration: number,
  reasoning: number,
  evidenceResponse: number,
  benchmark: number,
): SeasonScoreBreakdown {
  const values = {
    direction: roundScore(direction),
    calibration: roundScore(calibration),
    reasoning: roundScore(reasoning),
    evidenceResponse: roundScore(evidenceResponse),
    benchmark: roundScore(benchmark),
  }
  return Object.freeze({
    ...values,
    total: roundScore(
      values.direction
      + values.calibration
      + values.reasoning
      + values.evidenceResponse
      + values.benchmark,
    ),
  })
}

export function scoreSeasonCall(call: SeasonCall): SeasonCallSettlement {
  const thesis = findSeasonThesis(call.thesisId)
  if (thesis === null) throw new RangeError(`Unknown Season thesis: ${call.thesisId}`)

  const directionWasRight = call.current.direction === thesis.result.direction
  const probabilityAssignedToOutcome = directionWasRight
    ? call.current.confidence
    : 100 - call.current.confidence
  const reason = call.original.reason.toLowerCase()
  const matchedReasonSignals = thesis.result.reasonSignals.filter((signal) =>
    reason.includes(signal.toLowerCase()),
  )
  const reasoning = matchedReasonSignals.length >= 2
    ? SEASON_SCORE_WEIGHTS.reasoning
    : matchedReasonSignals.length === 1
      ? SEASON_SCORE_WEIGHTS.reasoning / 2
      : 0
  const signedRelativeReturn = call.current.direction === 'long'
    ? thesis.result.assetReturnBps - thesis.result.benchmarkReturnBps
    : thesis.result.benchmarkReturnBps - thesis.result.assetReturnBps
  const benchmark = signedRelativeReturn > 0
    ? SEASON_SCORE_WEIGHTS.benchmark
    : signedRelativeReturn === 0
      ? SEASON_SCORE_WEIGHTS.benchmark / 2
      : 0
  const evidence = evidenceResponseScore(call)
  const score = scoreBreakdown(
    directionWasRight ? SEASON_SCORE_WEIGHTS.direction : 0,
    SEASON_SCORE_WEIGHTS.calibration * probabilityAssignedToOutcome / 100,
    reasoning,
    evidence.points,
    benchmark,
  )

  return Object.freeze({
    thesisId: thesis.id,
    ticker: thesis.ticker,
    outcomeDirection: thesis.result.direction,
    assetReturnBps: thesis.result.assetReturnBps,
    benchmarkReturnBps: thesis.result.benchmarkReturnBps,
    matchedReasonSignals: Object.freeze([...matchedReasonSignals]),
    matchedEvidenceResponses: evidence.matches,
    score,
  })
}

function averageBreakdown(calls: readonly SeasonCallSettlement[]): SeasonScoreBreakdown {
  const average = (key: Exclude<keyof SeasonScoreBreakdown, 'total'>) =>
    calls.reduce((sum, call) => sum + call.score[key], 0) / calls.length
  return scoreBreakdown(
    average('direction'),
    average('calibration'),
    average('reasoning'),
    average('evidenceResponse'),
    average('benchmark'),
  )
}

export function settleSeason(state: SeasonState): SeasonSettlement {
  if (state.calls.length !== 3 || state.updateIndex !== 2) {
    throw new RangeError('Season settlement requires three calls after Thursday')
  }
  const calls = Object.freeze(state.calls.map(scoreSeasonCall))
  return Object.freeze({
    weekIndex: state.weekIndex,
    calls,
    score: averageBreakdown(calls),
  })
}

export function generateReceiptInsights(
  settlement: SeasonSettlement,
): readonly string[] {
  const best = settlement.calls.reduce((winner, call) =>
    call.score.total > winner.score.total ? call : winner,
  )
  const directionWins = settlement.calls.filter((call) => call.score.direction > 0).length
  const evidenceMatches = settlement.calls.reduce(
    (total, call) => total + call.matchedEvidenceResponses,
    0,
  )
  const reasoningMiss = settlement.calls.find((call) =>
    call.score.direction > 0 && call.score.reasoning === 0,
  )
  const insights = [
    `${directionWins} of 3 final directions were right; luck never replaces the process score.`,
    `${best.ticker} was your strongest receipt at ${best.score.total.toFixed(2)} points.`,
    `You matched ${evidenceMatches} of 9 evidence-response signals across Tuesday through Thursday.`,
    reasoningMiss === undefined
      ? 'Your original reasons were tested separately from the final price move.'
      : `You were right about ${reasoningMiss.ticker}, but the result did not confirm your original reason.`,
  ]
  return Object.freeze(insights)
}

function receiptHeadline(score: number): string {
  if (score >= 85) return 'Elite process, not just a lucky week.'
  if (score >= 70) return 'A strong week with repeatable decisions.'
  if (score >= 50) return 'Mixed results, useful receipts.'
  return 'The misses are now evidence for next week.'
}

export function createSeasonReceipt(
  settlement: SeasonSettlement,
  league: SeasonLeague | null,
): SeasonReceipt {
  const headline = receiptHeadline(settlement.score.total)
  const insights = generateReceiptInsights(settlement)
  return Object.freeze({
    weekIndex: settlement.weekIndex,
    leagueCode: league?.code ?? null,
    score: settlement.score.total,
    headline,
    insights,
    shareText: `OpenTrade Season · Week ${settlement.weekIndex}\n${settlement.score.total.toFixed(2)}/100 · ${headline}`,
  })
}

export function currentSeasonUpdate(
  state: SeasonState,
): readonly SeasonCurrentUpdate[] | null {
  if (state.phase !== 'updates') return null
  return Object.freeze(state.calls.map((call) => {
    const thesis = findSeasonThesis(call.thesisId)
    if (thesis === null) throw new RangeError(`Unknown Season thesis: ${call.thesisId}`)
    return Object.freeze({
      thesisId: thesis.id,
      ticker: thesis.ticker,
      update: thesis.updates[state.updateIndex],
    })
  }))
}

export function seasonReducer(state: SeasonState, action: SeasonAction): SeasonState {
  switch (action.type) {
    case 'ADD_DRAFT_CALL': {
      if (state.phase !== 'draft') return state
      const call = normalizeDraftCall(action.call)
      if (call === null) return state
      const existingIndex = state.draft.findIndex(({ thesisId }) => thesisId === call.thesisId)
      if (existingIndex === -1 && state.draft.length >= 3) return state
      const draft = [...state.draft]
      if (existingIndex === -1) draft.push(call)
      else draft[existingIndex] = call
      return freezeState({ ...state, draft: Object.freeze(draft) })
    }
    case 'REMOVE_DRAFT_CALL': {
      if (state.phase !== 'draft') return state
      const draft = state.draft.filter(({ thesisId }) => thesisId !== action.thesisId)
      return draft.length === state.draft.length
        ? state
        : freezeState({ ...state, draft: Object.freeze(draft) })
    }
    case 'COMMIT_DRAFT': {
      if (state.phase !== 'draft' || state.draft.length !== 3) return state
      const canonicalDraft: SeasonDraftCallInput[] = []
      for (const call of state.draft) {
        const canonical = normalizeDraftCall(call, true)
        if (canonical === null) return state
        canonicalDraft.push(canonical)
      }
      const draft = Object.freeze(canonicalDraft)
      const calls = Object.freeze(draft.map(callFromDraft))
      return freezeState({ ...state, phase: 'invite', draft, calls })
    }
    case 'CREATE_LEAGUE': {
      if (state.phase !== 'invite') return state
      const league = Object.freeze({
        code: deterministicLeagueCode(state),
        role: 'host' as const,
      })
      return freezeState({ ...state, league })
    }
    case 'JOIN_LEAGUE': {
      if (state.phase !== 'invite') return state
      const code = normalizeLeagueCode(action.code)
      if (code === null) return state
      return freezeState({
        ...state,
        league: Object.freeze({ code, role: 'member' }),
      })
    }
    case 'CONTINUE_SOLO':
      return state.phase === 'invite'
        ? freezeState({ ...state, phase: 'updates' })
        : state
    case 'REVISE_CALL': {
      if (state.phase !== 'updates') return state
      const callIndex = state.calls.findIndex(({ thesisId }) => thesisId === action.thesisId)
      if (callIndex === -1) return state
      const revision = normalizeRevision(action.revision, state.updateIndex)
      if (revision === null) return state
      const existing = state.calls[callIndex]
      if (existing === undefined) return state
      const revisions = existing.revisions
        .filter(({ updateIndex }) => updateIndex !== state.updateIndex)
        .concat(revision)
        .sort((left, right) => left.updateIndex - right.updateIndex)
      const updatedCall = Object.freeze({
        ...existing,
        current: currentFromRevision(existing.thesisId, revision),
        revisions: Object.freeze(revisions),
      })
      const calls = [...state.calls]
      calls[callIndex] = updatedCall
      return freezeState({ ...state, calls: Object.freeze(calls) })
    }
    case 'ADVANCE_UPDATE': {
      if (state.phase !== 'updates') return state
      if (state.updateIndex < 2) {
        return freezeState({
          ...state,
          updateIndex: (state.updateIndex + 1) as SeasonUpdateIndex,
        })
      }
      const settlement = settleSeason(state)
      return freezeState({ ...state, phase: 'settlement', settlement })
    }
    case 'VIEW_RECEIPT': {
      if (state.phase !== 'settlement' || state.settlement === null) return state
      return freezeState({
        ...state,
        phase: 'receipt',
        receipt: createSeasonReceipt(state.settlement, state.league),
      })
    }
    case 'REMATCH': {
      if (state.phase !== 'receipt') return state
      return freezeState({
        phase: 'draft',
        weekIndex: state.weekIndex + 1,
        draft: Object.freeze([]),
        calls: Object.freeze([]),
        league: state.league,
        updateIndex: 0,
        settlement: null,
        receipt: null,
      })
    }
  }
}
