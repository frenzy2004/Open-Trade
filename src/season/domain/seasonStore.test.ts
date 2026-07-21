import { describe, expect, it } from 'vitest'
import type { StorageLike } from '../../shared/persistence/gameStore'
import {
  createSeasonState,
  seasonReducer,
  type SeasonState,
} from './seasonEngine'
import {
  SEASON_SAVE_KEY,
  createSeasonSave,
  createSeasonStore,
  loadSeasonState,
  resetSeasonProgress,
  seasonSaveCodec,
} from './seasonStore'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  failRead = false
  failWrite = false
  failClear = false

  getItem(key: string): string | null {
    if (this.failRead) throw new Error('read denied')
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrite) throw new Error('write denied')
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    if (this.failClear) throw new Error('clear denied')
    this.values.delete(key)
  }
}

function settledState(): SeasonState {
  let state = createSeasonState(3)
  for (const [thesisId, direction] of [
    ['nvda-ai-capex', 'long'],
    ['tsla-margin-reset', 'short'],
    ['dkng-promo-normalization', 'short'],
  ] as const) {
    state = seasonReducer(state, {
      type: 'ADD_DRAFT_CALL',
      call: {
        thesisId,
        direction,
        confidence: 72,
        reason: 'Demand margin discount and tax evidence shape this decision.',
        evidenceThatChangesMind: 'A directly contrary catalyst would change my mind.',
      },
    })
  }
  state = seasonReducer(state, { type: 'COMMIT_DRAFT' })
  state = seasonReducer(state, { type: 'CREATE_LEAGUE' })
  state = seasonReducer(state, { type: 'CONTINUE_SOLO' })
  state = seasonReducer(state, { type: 'ADVANCE_UPDATE' })
  state = seasonReducer(state, { type: 'ADVANCE_UPDATE' })
  return seasonReducer(state, { type: 'ADVANCE_UPDATE' })
}

function receiptState(): SeasonState {
  return seasonReducer(settledState(), { type: 'VIEW_RECEIPT' })
}

function encodedSave(state: SeasonState = receiptState()): Record<string, unknown> {
  return structuredClone(seasonSaveCodec.encode(createSeasonSave(state))) as Record<string, unknown>
}

describe('Season save codec', () => {
  it('round-trips raw controlled-input text only while a draft is provisional', () => {
    let state = createSeasonState()
    state = seasonReducer(state, {
      type: 'ADD_DRAFT_CALL',
      call: {
        thesisId: 'nvda-ai-capex',
        direction: 'long',
        confidence: 70,
        reason: '  AI  demand ',
        evidenceThatChangesMind: '',
      },
    })
    const decoded = seasonSaveCodec.decode(seasonSaveCodec.encode(createSeasonSave(state)))
    expect(decoded).toMatchObject({
      ok: true,
      value: {
        state: {
          draft: [{ reason: '  AI  demand ', evidenceThatChangesMind: '' }],
        },
      },
    })
  })

  it('round-trips a detached, deeply frozen version-one receipt save', () => {
    const state = receiptState()
    const save = createSeasonSave(state)
    const encoded = seasonSaveCodec.encode(save)
    const decoded = seasonSaveCodec.decode(encoded)

    expect(save).toMatchObject({ schemaVersion: 1, rulesetVersion: 1, state })
    expect(decoded).toEqual({ ok: true, value: save })
    if (!decoded.ok) throw new Error(decoded.reason)
    expect(decoded.value).not.toBe(save)
    expect(decoded.value.state).not.toBe(state)
    expect(decoded.value.state.calls[0]?.original).toBe(decoded.value.state.draft[0])
    expect(decoded.value.state.calls[0]?.current).toBe(decoded.value.state.calls[0]?.original)
    expect(Object.isFrozen(decoded.value)).toBe(true)
    expect(Object.isFrozen(decoded.value.state)).toBe(true)
    expect(Object.isFrozen(decoded.value.state.calls[0]?.original)).toBe(true)
    expect(Object.isFrozen(decoded.value.state.settlement?.calls)).toBe(true)
    expect(Object.isFrozen(decoded.value.state.receipt?.insights)).toBe(true)
  })

  it.each([
    ['null', null, 'corrupt'],
    ['empty', {}, 'corrupt'],
    ['extra root key', { ...encodedSave(), injected: true }, 'corrupt'],
    ['future schema', { ...encodedSave(), schemaVersion: 2 }, 'incompatible'],
    ['future rules', { ...encodedSave(), rulesetVersion: 2 }, 'incompatible'],
  ] as const)('rejects %s saves as %s', (_label, candidate, reason) => {
    expect(seasonSaveCodec.decode(candidate)).toEqual({ ok: false, reason })
  })

  it('rejects inherited fields and unexpected nested keys', () => {
    const inherited = Object.create(encodedSave())
    const customPrototype = Object.assign(
      Object.create({ polluted: true }) as Record<string, unknown>,
      encodedSave(),
    )
    const extraState = encodedSave()
    extraState.state = {
      ...(extraState.state as Record<string, unknown>),
      injected: true,
    }
    const extraCall = encodedSave()
    const state = extraCall.state as Record<string, unknown>
    const calls = structuredClone(state.calls) as Array<Record<string, unknown>>
    const firstCall = calls[0]
    if (firstCall === undefined) throw new Error('Expected a committed call')
    calls[0] = { ...firstCall, injected: true }
    state.calls = calls

    expect(seasonSaveCodec.decode(inherited)).toEqual({ ok: false, reason: 'corrupt' })
    expect(seasonSaveCodec.decode(customPrototype)).toEqual({ ok: false, reason: 'corrupt' })
    expect(seasonSaveCodec.decode(extraState)).toEqual({ ok: false, reason: 'corrupt' })
    expect(seasonSaveCodec.decode(extraCall)).toEqual({ ok: false, reason: 'corrupt' })
  })

  it('returns corrupt instead of throwing for hostile traps and exotic arrays', () => {
    const throwingProxy = new Proxy<Record<string, unknown>>({}, {
      getPrototypeOf: () => Object.prototype,
      ownKeys: () => {
        throw new Error('ownKeys denied')
      },
    })
    const throwingAccessor = encodedSave()
    Object.defineProperty(throwingAccessor, 'state', {
      enumerable: true,
      get: () => {
        throw new Error('state denied')
      },
    })
    const benignAccessor = encodedSave()
    const accessorState = benignAccessor.state
    Object.defineProperty(benignAccessor, 'state', {
      enumerable: true,
      get: () => accessorState,
    })
    const hiddenExtra = encodedSave()
    Object.defineProperty(hiddenExtra, 'hidden', {
      value: true,
      enumerable: false,
    })
    const symbolExtra = encodedSave()
    Object.defineProperty(symbolExtra, Symbol('injected'), {
      value: true,
      enumerable: true,
    })
    const sparseInsights = encodedSave()
    const sparseReceipt = (sparseInsights.state as Record<string, unknown>)
      .receipt as Record<string, unknown>
    sparseReceipt.insights = new Array(4)

    const decoratedInsights = encodedSave()
    const decoratedReceipt = (decoratedInsights.state as Record<string, unknown>)
      .receipt as Record<string, unknown>
    const insights = decoratedReceipt.insights as string[] & { injected?: boolean }
    insights.injected = true

    for (const candidate of [
      throwingProxy,
      throwingAccessor,
      benignAccessor,
      hiddenExtra,
      symbolExtra,
      sparseInsights,
      decoratedInsights,
    ]) {
      expect(() => seasonSaveCodec.decode(candidate)).not.toThrow()
      expect(seasonSaveCodec.decode(candidate)).toEqual({ ok: false, reason: 'corrupt' })
    }
  })

  it('rejects impossible phases, duplicates, future revisions, and forged scores', () => {
    const impossible = encodedSave()
    ;(impossible.state as Record<string, unknown>).phase = 'draft'

    const duplicate = encodedSave()
    const duplicateState = duplicate.state as Record<string, unknown>
    const duplicateDraft = duplicateState.draft as Array<Record<string, unknown>>
    const firstDraft = duplicateDraft[0]
    if (firstDraft === undefined) throw new Error('Expected a committed draft')
    duplicateDraft[1] = structuredClone(firstDraft)

    const futureRevision = encodedSave()
    const futureState = futureRevision.state as Record<string, unknown>
    futureState.phase = 'updates'
    futureState.updateIndex = 0
    futureState.settlement = null
    futureState.receipt = null
    const futureCalls = futureState.calls as Array<Record<string, unknown>>
    const firstFutureCall = futureCalls[0]
    if (firstFutureCall === undefined) throw new Error('Expected a committed call')
    firstFutureCall.revisions = [{
      updateIndex: 2,
      direction: 'long',
      confidence: 80,
      reason: 'Demand remains strong.',
      evidenceThatChangesMind: 'A demand reversal.',
      responseToEvidence: 'I raised confidence.',
    }]

    const forged = encodedSave()
    const forgedState = forged.state as Record<string, unknown>
    const settlement = forgedState.settlement as Record<string, unknown>
    settlement.score = { ...(settlement.score as object), total: 100 }

    for (const candidate of [impossible, duplicate, futureRevision, forged]) {
      expect(seasonSaveCodec.decode(candidate)).toEqual({ ok: false, reason: 'corrupt' })
    }
  })

  it('refuses to create saves from malformed in-memory states', () => {
    const malformed = {
      ...receiptState(),
      updateIndex: 9,
    } as unknown as SeasonState
    expect(() => createSeasonSave(malformed)).toThrow(RangeError)
  })
})

describe('Season store helpers', () => {
  it('loads empty and ready state while preserving save metadata', () => {
    const storage = new MemoryStorage()
    const store = createSeasonStore(storage)
    expect(loadSeasonState(store)).toEqual({ status: 'empty' })

    const state = receiptState()
    expect(store.save(createSeasonSave(state), {
      seed: 'season-week-3',
      savedAt: '2026-07-21T12:00:00.000Z',
    })).toEqual({ ok: true })
    expect(loadSeasonState(store)).toMatchObject({
      status: 'ready',
      seed: 'season-week-3',
      savedAt: '2026-07-21T12:00:00.000Z',
      value: { state },
    })

    expect(resetSeasonProgress(store)).toEqual({ ok: true })
    expect(loadSeasonState(store)).toEqual({ status: 'empty' })
  })

  it('distinguishes corrupt and incompatible envelopes without overwriting them', () => {
    const storage = new MemoryStorage()
    storage.values.set(SEASON_SAVE_KEY, '{broken-json')
    const store = createSeasonStore(storage)
    expect(loadSeasonState(store)).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
    })
    expect(storage.values.get(SEASON_SAVE_KEY)).toBe('{broken-json')

    const raw = JSON.stringify({
      version: 2,
      savedAt: '2026-07-21T12:00:00.000Z',
      seed: null,
      data: encodedSave(),
    })
    storage.values.set(SEASON_SAVE_KEY, raw)
    expect(loadSeasonState(store)).toMatchObject({
      status: 'recovery-required',
      reason: 'incompatible',
    })
    expect(storage.values.get(SEASON_SAVE_KEY)).toBe(raw)
  })

  it('returns explicit read, write, and clear failures from hostile storage', () => {
    const storage = new MemoryStorage()
    const store = createSeasonStore(storage)
    storage.failRead = true
    expect(loadSeasonState(store)).toMatchObject({
      status: 'recovery-required',
      reason: 'storage-unavailable',
    })
    storage.failRead = false
    storage.values.set(SEASON_SAVE_KEY, 'preserve-me')
    storage.failWrite = true
    expect(store.save(createSeasonSave(receiptState()))).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    })
    expect(storage.values.get(SEASON_SAVE_KEY)).toBe('preserve-me')
    storage.failWrite = false
    storage.failClear = true
    expect(resetSeasonProgress(store)).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    })
    expect(storage.values.get(SEASON_SAVE_KEY)).toBe('preserve-me')
  })
})
