import type { GameProgressBadge } from '../../../app/routes/types'
import {
  createGameStore,
  type GameSaveCodec,
  type GameStore,
  type GameStoreOptions,
} from '../../../shared/persistence/gameStore'
import { founderEpisodeById } from '../content/episodes'
import type { FounderEpisode, WritingStyle } from '../content/types'
import {
  freezeFounderRun,
  type FounderHistoryItem,
  type FounderPhase,
  type FounderRunState,
} from '../engine/founderState'

export const FOUNDER_SAVE_KEY = 'open-trade:game:founder-mode'

export interface FounderSaveV1 {
  readonly schemaVersion: 1
  readonly selectedEpisodeId: string
  readonly style: WritingStyle
  readonly streakDays: number
  readonly lastCompletedDate: string | null
  readonly activeRun: FounderRunState | null
}

type UnknownRecord = Record<string, unknown>

const RUN_PHASES: ReadonlySet<FounderPhase> = new Set([
  'intro',
  'decision',
  'outcome',
  'ending',
])

function asPlainRecord(value: unknown): UnknownRecord | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null
    }
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
      ? (value as UnknownRecord)
      : null
  } catch {
    return null
  }
}

function readOwn(record: UnknownRecord, key: string): unknown {
  try {
    return Object.hasOwn(record, key) ? record[key] : undefined
  } catch {
    return undefined
  }
}

function ownArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return null
    }
    const result: unknown[] = []
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) return null
      result.push(value[index])
    }
    return result
  } catch {
    return null
  }
}

function isStyle(value: unknown): value is WritingStyle {
  return value === 'classic' || value === 'brainrot'
}

function isUtcDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  )
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function expectedHistoryLength(
  phase: FounderPhase,
  decisionIndex: number,
  decisionCount: number,
): number | null {
  if (phase === 'intro') return decisionIndex === 0 ? 0 : null
  if (phase === 'decision') return decisionIndex
  if (phase === 'outcome') return decisionIndex + 1
  if (phase === 'ending') {
    return decisionIndex === decisionCount - 1 ? decisionCount : null
  }
  return null
}

function decodeHistoryItem(
  value: unknown,
  episode: FounderEpisode,
  index: number,
  expectedValueBeforeBn: number,
): FounderHistoryItem | null {
  const record = asPlainRecord(value)
  const decision = episode.decisions[index]
  if (!record || !decision) return null

  const decisionId = readOwn(record, 'decisionId')
  const choiceId = readOwn(record, 'choiceId')
  const valueBeforeBn = readOwn(record, 'valueBeforeBn')
  const valueAfterBn = readOwn(record, 'valueAfterBn')
  if (
    decisionId !== decision.id ||
    typeof choiceId !== 'string' ||
    valueBeforeBn !== expectedValueBeforeBn ||
    !isPositiveFinite(valueAfterBn)
  ) {
    return null
  }
  const choice = decision.choices.find(({ id }) => id === choiceId)
  if (!choice) return null
  const canonicalAfter =
    Math.round(expectedValueBeforeBn * choice.valueMultiplier * 10) / 10
  if (valueAfterBn !== canonicalAfter) return null

  return Object.freeze({
    decisionId: decision.id,
    choiceId: choice.id,
    valueBeforeBn: expectedValueBeforeBn,
    valueAfterBn: canonicalAfter,
  })
}

function decodeRun(
  value: unknown,
  episode: FounderEpisode,
  style: WritingStyle,
): FounderRunState | null {
  const record = asPlainRecord(value)
  if (!record) return null
  const episodeId = readOwn(record, 'episodeId')
  const runStyle = readOwn(record, 'style')
  const phase = readOwn(record, 'phase')
  const decisionIndex = readOwn(record, 'decisionIndex')
  const currentValueBn = readOwn(record, 'currentValueBn')
  const historyValues = ownArray(readOwn(record, 'history'))
  if (
    episodeId !== episode.id ||
    runStyle !== style ||
    typeof phase !== 'string' ||
    !RUN_PHASES.has(phase as FounderPhase) ||
    !Number.isSafeInteger(decisionIndex) ||
    (decisionIndex as number) < 0 ||
    (decisionIndex as number) >= episode.decisions.length ||
    !isPositiveFinite(currentValueBn) ||
    !historyValues
  ) {
    return null
  }

  const founderPhase = phase as FounderPhase
  const index = decisionIndex as number
  const historyLength = expectedHistoryLength(
    founderPhase,
    index,
    episode.decisions.length,
  )
  if (historyLength === null || historyValues.length !== historyLength) {
    return null
  }

  const history: FounderHistoryItem[] = []
  let expectedValue = episode.initialValueBn
  for (let historyIndex = 0; historyIndex < historyValues.length; historyIndex += 1) {
    const item = decodeHistoryItem(
      historyValues[historyIndex],
      episode,
      historyIndex,
      expectedValue,
    )
    if (!item) return null
    history.push(item)
    expectedValue = item.valueAfterBn
  }
  if (currentValueBn !== expectedValue) return null

  return freezeFounderRun({
    episodeId: episode.id,
    style,
    phase: founderPhase,
    decisionIndex: index,
    currentValueBn: expectedValue,
    history,
  })
}

function decodeSave(value: unknown):
  | { readonly ok: true; readonly value: FounderSaveV1 }
  | { readonly ok: false; readonly reason: string } {
  const record = asPlainRecord(value)
  if (!record || readOwn(record, 'schemaVersion') !== 1) {
    return { ok: false, reason: 'Founder save fields are invalid' }
  }

  const selectedEpisodeId = readOwn(record, 'selectedEpisodeId')
  if (typeof selectedEpisodeId !== 'string') {
    return { ok: false, reason: 'Founder save selected episode is invalid' }
  }
  const episode = founderEpisodeById(selectedEpisodeId)
  if (!episode) {
    return { ok: false, reason: 'Founder save selected episode is invalid' }
  }

  const style = readOwn(record, 'style')
  const streakDays = readOwn(record, 'streakDays')
  const lastCompletedDate = readOwn(record, 'lastCompletedDate')
  const rawActiveRun = readOwn(record, 'activeRun')
  if (
    !isStyle(style) ||
    !Number.isSafeInteger(streakDays) ||
    (streakDays as number) < 0 ||
    !(
      lastCompletedDate === null ||
      isUtcDate(lastCompletedDate)
    ) ||
    rawActiveRun === undefined
  ) {
    return { ok: false, reason: 'Founder save fields are invalid' }
  }
  if (
    (streakDays === 0 && lastCompletedDate !== null) ||
    ((streakDays as number) > 0 && lastCompletedDate === null)
  ) {
    return { ok: false, reason: 'Founder save fields are invalid' }
  }

  const activeRun =
    rawActiveRun === null ? null : decodeRun(rawActiveRun, episode, style)
  if (rawActiveRun !== null && !activeRun) {
    return { ok: false, reason: 'Founder save active run is invalid' }
  }

  return {
    ok: true,
    value: Object.freeze({
      schemaVersion: 1,
      selectedEpisodeId: episode.id,
      style,
      streakDays: streakDays as number,
      lastCompletedDate,
      activeRun,
    }),
  }
}

export const founderSaveCodec: GameSaveCodec<FounderSaveV1> = Object.freeze({
  key: FOUNDER_SAVE_KEY,
  version: 1,
  encode(value: FounderSaveV1) {
    const decoded = decodeSave(value)
    if (!decoded.ok) throw new TypeError(decoded.reason)
    return decoded.value
  },
  decode: decodeSave,
})

export function createDefaultFounderSave(): FounderSaveV1 {
  return Object.freeze({
    schemaVersion: 1,
    selectedEpisodeId: 'netflix-2011',
    style: 'classic',
    streakDays: 0,
    lastCompletedDate: null,
    activeRun: null,
  })
}

export function createFounderStore(
  options: GameStoreOptions = {},
): GameStore<FounderSaveV1> {
  return createGameStore(founderSaveCodec, options)
}

export const founderStore = createFounderStore()

export function progressBadgeForFounderSave(
  save: Pick<FounderSaveV1, 'streakDays'>,
): GameProgressBadge {
  const days = save.streakDays
  return Object.freeze({
    label: 'Founder streak',
    value: `${days} ${days === 1 ? 'day' : 'days'}`,
    tone: days > 0 ? 'positive' : 'neutral',
  })
}
