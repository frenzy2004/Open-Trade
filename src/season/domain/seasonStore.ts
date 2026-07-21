import {
  createGameStore,
  type GameSaveCodec,
  type GameStore,
  type GameStoreLoadResult,
  type GameStoreWriteResult,
  type StorageLike,
} from '../../shared/persistence/gameStore'
import { findSeasonThesis, type SeasonDirection } from './content'
import {
  createSeasonReceipt,
  settleSeason,
  type SeasonCall,
  type SeasonCallRevision,
  type SeasonDraftCallInput,
  type SeasonLeague,
  type SeasonPhase,
  type SeasonState,
  type SeasonUpdateIndex,
} from './seasonEngine'

export const SEASON_SAVE_KEY = 'open-trade:season'

export interface SeasonSaveV1 {
  readonly schemaVersion: 1
  readonly rulesetVersion: 1
  readonly state: SeasonState
}

const SAVE_KEYS = Object.freeze(['schemaVersion', 'rulesetVersion', 'state'] as const)
const STATE_KEYS = Object.freeze([
  'phase',
  'weekIndex',
  'draft',
  'calls',
  'league',
  'updateIndex',
  'settlement',
  'receipt',
] as const)
const DRAFT_KEYS = Object.freeze([
  'thesisId',
  'direction',
  'confidence',
  'reason',
  'evidenceThatChangesMind',
] as const)
const CALL_KEYS = Object.freeze(['thesisId', 'original', 'current', 'revisions'] as const)
const REVISION_KEYS = Object.freeze([
  'updateIndex',
  'direction',
  'confidence',
  'reason',
  'evidenceThatChangesMind',
  'responseToEvidence',
] as const)
const LEAGUE_KEYS = Object.freeze(['code', 'role'] as const)
const LEAGUE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/
const PHASES: readonly SeasonPhase[] = Object.freeze([
  'draft',
  'invite',
  'updates',
  'settlement',
  'receipt',
])
const MAX_NOTE_LENGTH = 320

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length
    && expected.every((key) => Object.hasOwn(value, key))
}

function isStandardArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
}

function isDirection(value: unknown): value is SeasonDirection {
  return value === 'long' || value === 'short'
}

function isConfidence(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 50 && (value as number) <= 100
}

function isCanonicalNote(value: unknown, complete: boolean): value is string {
  return typeof value === 'string'
    && value.length <= MAX_NOTE_LENGTH
    && (!complete || (value === value.trim() && value.length >= 1))
}

function decodeDraftCall(
  value: unknown,
  complete: boolean,
): SeasonDraftCallInput | null {
  if (!isRecord(value) || !hasExactKeys(value, DRAFT_KEYS)) return null
  if (
    typeof value.thesisId !== 'string'
    || findSeasonThesis(value.thesisId) === null
    || !isDirection(value.direction)
    || !isConfidence(value.confidence)
    || !isCanonicalNote(value.reason, complete)
    || !isCanonicalNote(value.evidenceThatChangesMind, complete)
  ) return null
  return Object.freeze({
    thesisId: value.thesisId,
    direction: value.direction,
    confidence: value.confidence,
    reason: value.reason,
    evidenceThatChangesMind: value.evidenceThatChangesMind,
  })
}

function decodeRevision(value: unknown): SeasonCallRevision | null {
  if (!isRecord(value) || !hasExactKeys(value, REVISION_KEYS)) return null
  if (
    value.updateIndex !== 0
    && value.updateIndex !== 1
    && value.updateIndex !== 2
  ) return null
  if (
    !isDirection(value.direction)
    || !isConfidence(value.confidence)
    || !isCanonicalNote(value.reason, true)
    || !isCanonicalNote(value.evidenceThatChangesMind, true)
    || !isCanonicalNote(value.responseToEvidence, true)
  ) return null
  return Object.freeze({
    updateIndex: value.updateIndex,
    direction: value.direction,
    confidence: value.confidence,
    reason: value.reason,
    evidenceThatChangesMind: value.evidenceThatChangesMind,
    responseToEvidence: value.responseToEvidence,
  })
}

function sameCanonicalValue(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true
  if (isStandardArray(actual) && isStandardArray(expected)) {
    return actual.length === expected.length
      && actual.every((value, index) => sameCanonicalValue(value, expected[index]))
  }
  if (isRecord(actual) && isRecord(expected)) {
    const keys = Object.keys(expected)
    return hasExactKeys(actual, keys)
      && keys.every((key) => sameCanonicalValue(actual[key], expected[key]))
  }
  return false
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

function decodeCall(
  value: unknown,
  updateIndex: SeasonUpdateIndex,
): SeasonCall | null {
  if (!isRecord(value) || !hasExactKeys(value, CALL_KEYS)) return null
  if (typeof value.thesisId !== 'string') return null
  const original = decodeDraftCall(value.original, true)
  const current = decodeDraftCall(value.current, true)
  if (
    original === null
    || current === null
    || original.thesisId !== value.thesisId
    || current.thesisId !== value.thesisId
    || !isStandardArray(value.revisions)
    || value.revisions.length > 3
  ) return null
  const revisions: SeasonCallRevision[] = []
  for (const raw of value.revisions) {
    const revision = decodeRevision(raw)
    if (
      revision === null
      || revision.updateIndex > updateIndex
      || revisions.some(({ updateIndex: seen }) => seen === revision.updateIndex)
      || (revisions.at(-1)?.updateIndex ?? -1) >= revision.updateIndex
    ) return null
    revisions.push(revision)
  }
  const latestRevision = revisions.at(-1)
  const expectedCurrent = latestRevision === undefined
    ? original
    : currentFromRevision(value.thesisId, latestRevision)
  if (!sameCanonicalValue(value.current, expectedCurrent)) return null
  return Object.freeze({
    thesisId: value.thesisId,
    original,
    current,
    revisions: Object.freeze(revisions),
  })
}

function decodeLeague(value: unknown): SeasonLeague | null | false {
  if (value === null) return null
  if (!isRecord(value) || !hasExactKeys(value, LEAGUE_KEYS)) return false
  if (
    typeof value.code !== 'string'
    || !LEAGUE_CODE_PATTERN.test(value.code)
    || (value.role !== 'host' && value.role !== 'member')
  ) return false
  return Object.freeze({ code: value.code, role: value.role })
}

function allUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function phaseShapeIsValid(
  phase: SeasonPhase,
  draft: readonly SeasonDraftCallInput[],
  calls: readonly SeasonCall[],
  updateIndex: SeasonUpdateIndex,
  settlement: unknown,
  receipt: unknown,
): boolean {
  switch (phase) {
    case 'draft':
      return draft.length <= 3
        && calls.length === 0
        && updateIndex === 0
        && settlement === null
        && receipt === null
    case 'invite':
      return draft.length === 3
        && calls.length === 3
        && calls.every((call) => call.revisions.length === 0)
        && updateIndex === 0
        && settlement === null
        && receipt === null
    case 'updates':
      return draft.length === 3
        && calls.length === 3
        && settlement === null
        && receipt === null
    case 'settlement':
      return draft.length === 3
        && calls.length === 3
        && updateIndex === 2
        && settlement !== null
        && receipt === null
    case 'receipt':
      return draft.length === 3
        && calls.length === 3
        && updateIndex === 2
        && settlement !== null
        && receipt !== null
  }
}

function decodeSeasonState(value: unknown): SeasonState | null {
  if (!isRecord(value) || !hasExactKeys(value, STATE_KEYS)) return null
  if (
    typeof value.phase !== 'string'
    || !PHASES.includes(value.phase as SeasonPhase)
    || !Number.isSafeInteger(value.weekIndex)
    || (value.weekIndex as number) < 1
    || (value.updateIndex !== 0 && value.updateIndex !== 1 && value.updateIndex !== 2)
    || !isStandardArray(value.draft)
    || !isStandardArray(value.calls)
  ) return null
  const phase = value.phase as SeasonPhase
  const updateIndex = value.updateIndex as SeasonUpdateIndex
  const draft: SeasonDraftCallInput[] = []
  for (const raw of value.draft) {
    const call = decodeDraftCall(raw, phase !== 'draft')
    if (call === null) return null
    draft.push(call)
  }
  const calls: SeasonCall[] = []
  for (const raw of value.calls) {
    const call = decodeCall(raw, updateIndex)
    if (call === null) return null
    calls.push(call)
  }
  const league = decodeLeague(value.league)
  if (league === false) return null
  if (
    !allUnique(draft.map(({ thesisId }) => thesisId))
    || !allUnique(calls.map(({ thesisId }) => thesisId))
    || (calls.length > 0 && calls.some((call, index) =>
      !sameCanonicalValue(call.original, draft[index]),
    ))
    || !phaseShapeIsValid(
      phase,
      draft,
      calls,
      updateIndex,
      value.settlement,
      value.receipt,
    )
  ) return null

  const provisional: SeasonState = Object.freeze({
    phase,
    weekIndex: value.weekIndex as number,
    draft: Object.freeze(draft),
    calls: Object.freeze(calls),
    league,
    updateIndex,
    settlement: null,
    receipt: null,
  })
  if (phase !== 'settlement' && phase !== 'receipt') return provisional

  const settlement = settleSeason(provisional)
  if (!sameCanonicalValue(value.settlement, settlement)) return null
  if (phase === 'settlement') {
    return Object.freeze({ ...provisional, settlement })
  }
  const receipt = createSeasonReceipt(settlement, league)
  if (!sameCanonicalValue(value.receipt, receipt)) return null
  return Object.freeze({ ...provisional, settlement, receipt })
}

function decodeSeasonSave(value: unknown) {
  if (!isRecord(value) || !hasExactKeys(value, SAVE_KEYS)) {
    return { ok: false as const, reason: 'corrupt' }
  }
  if (
    !Number.isSafeInteger(value.schemaVersion)
    || !Number.isSafeInteger(value.rulesetVersion)
  ) return { ok: false as const, reason: 'corrupt' }
  if (value.schemaVersion !== 1 || value.rulesetVersion !== 1) {
    return { ok: false as const, reason: 'incompatible' }
  }
  const state = decodeSeasonState(value.state)
  if (state === null) return { ok: false as const, reason: 'corrupt' }
  return {
    ok: true as const,
    value: Object.freeze({
      schemaVersion: 1 as const,
      rulesetVersion: 1 as const,
      state,
    }),
  }
}

export const seasonSaveCodec: GameSaveCodec<SeasonSaveV1> = {
  key: SEASON_SAVE_KEY,
  version: 1,
  encode(value) {
    const decoded = decodeSeasonSave(value)
    if (!decoded.ok) throw new RangeError(`Cannot encode ${decoded.reason} Season save`)
    return {
      schemaVersion: decoded.value.schemaVersion,
      rulesetVersion: decoded.value.rulesetVersion,
      state: decoded.value.state,
    }
  },
  decode: decodeSeasonSave,
}

function normalizeLoad(
  loaded: GameStoreLoadResult<SeasonSaveV1>,
): GameStoreLoadResult<SeasonSaveV1> {
  return loaded.status === 'recovery-required'
    && loaded.reason === 'corrupt'
    && loaded.detail === 'incompatible'
    ? {
        status: 'recovery-required',
        reason: 'incompatible',
        detail: 'Saved Season rules or schema are incompatible',
      }
    : loaded
}

export function createSeasonStore(storage?: StorageLike): GameStore<SeasonSaveV1> {
  const base = storage === undefined
    ? createGameStore(seasonSaveCodec)
    : createGameStore(seasonSaveCodec, { storage })
  return Object.freeze({
    save: base.save,
    clear: base.clear,
    load: () => normalizeLoad(base.load()),
  })
}

export const seasonStore = createSeasonStore()

export function createSeasonSave(state: SeasonState): SeasonSaveV1 {
  const decoded = decodeSeasonSave({
    schemaVersion: 1,
    rulesetVersion: 1,
    state,
  })
  if (!decoded.ok) throw new RangeError(`Season state is ${decoded.reason}`)
  return decoded.value
}

export function loadSeasonState(
  store: GameStore<SeasonSaveV1> = seasonStore,
): GameStoreLoadResult<SeasonSaveV1> {
  return normalizeLoad(store.load())
}

export function resetSeasonProgress(
  store: GameStore<SeasonSaveV1> = seasonStore,
): GameStoreWriteResult {
  return store.clear()
}
