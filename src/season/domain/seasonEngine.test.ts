import { describe, expect, it } from 'vitest'
import {
  SEASON_SCORE_WEIGHTS,
  createSeasonState,
  currentSeasonUpdate,
  scoreSeasonCall,
  seasonReducer,
  settleSeason,
  type SeasonDraftCallInput,
  type SeasonState,
} from './seasonEngine'

const THESIS_IDS = [
  'nvda-ai-capex',
  'meta-ad-efficiency',
  'tsla-margin-reset',
] as const

function draftCall(
  thesisId: string,
  overrides: Partial<SeasonDraftCallInput> = {},
): SeasonDraftCallInput {
  return {
    thesisId,
    direction: 'long',
    confidence: 70,
    reason: 'Demand and margins should beat the market consensus.',
    evidenceThatChangesMind: 'I would change if demand falls and margins compress.',
    ...overrides,
  }
}

function committedState(calls = THESIS_IDS.map((id) => draftCall(id))): SeasonState {
  let state = createSeasonState()
  for (const call of calls) {
    state = seasonReducer(state, { type: 'ADD_DRAFT_CALL', call })
  }
  return seasonReducer(state, { type: 'COMMIT_DRAFT' })
}

function updatingState(calls = THESIS_IDS.map((id) => draftCall(id))): SeasonState {
  return seasonReducer(committedState(calls), { type: 'CONTINUE_SOLO' })
}

describe('Season draft and league', () => {
  it('commits exactly three unique, validated calls into immutable originals', () => {
    const first = draftCall(THESIS_IDS[0])
    let state = createSeasonState()

    expect(state).toMatchObject({
      phase: 'draft',
      weekIndex: 1,
      draft: [],
      calls: [],
      league: null,
      updateIndex: 0,
      settlement: null,
      receipt: null,
    })
    expect(seasonReducer(state, { type: 'COMMIT_DRAFT' })).toBe(state)

    state = seasonReducer(state, { type: 'ADD_DRAFT_CALL', call: first })
    ;(first as { reason: string }).reason = 'mutated outside the reducer'
    expect(state.draft[0]?.reason).not.toBe(first.reason)

    const replaced = draftCall(THESIS_IDS[0], { confidence: 61 })
    state = seasonReducer(state, { type: 'ADD_DRAFT_CALL', call: replaced })
    expect(state.draft).toHaveLength(1)
    expect(state.draft[0]?.confidence).toBe(61)

    state = seasonReducer(state, { type: 'ADD_DRAFT_CALL', call: draftCall(THESIS_IDS[1]) })
    state = seasonReducer(state, { type: 'ADD_DRAFT_CALL', call: draftCall(THESIS_IDS[2]) })
    const fullDraft = state
    state = seasonReducer(state, { type: 'ADD_DRAFT_CALL', call: draftCall('amzn-cloud-acceleration') })
    expect(state).toBe(fullDraft)

    const committed = seasonReducer(state, { type: 'COMMIT_DRAFT' })
    expect(committed.phase).toBe('invite')
    expect(committed.calls).toHaveLength(3)
    expect(committed.calls[0]?.original).toEqual(committed.draft[0])
    expect(committed.calls[0]?.current).toEqual(committed.draft[0])
    expect(Object.isFrozen(committed)).toBe(true)
    expect(Object.isFrozen(committed.calls[0]?.original)).toBe(true)
    expect(Object.isFrozen(committed.calls[0]?.revisions)).toBe(true)
  })

  it('rejects malformed calls and invalid phase transitions without corrupting state', () => {
    const state = createSeasonState()
    const invalidInputs = [
      draftCall('unknown-thesis'),
      draftCall(THESIS_IDS[0], { confidence: 101 }),
      draftCall(THESIS_IDS[0], { confidence: 70.5 }),
      draftCall(THESIS_IDS[0], { reason: 'x'.repeat(321) }),
    ]

    for (const call of invalidInputs) {
      expect(seasonReducer(state, { type: 'ADD_DRAFT_CALL', call })).toBe(state)
    }
    expect(seasonReducer(state, { type: 'ADVANCE_UPDATE' })).toBe(state)
    expect(() => createSeasonState(-1)).toThrow(RangeError)
  })

  it('allows provisional notes during selection but requires complete notes to commit', () => {
    let state = createSeasonState()
    state = seasonReducer(state, {
      type: 'ADD_DRAFT_CALL',
      call: draftCall(THESIS_IDS[0], {
        reason: '  AI  demand survives  ',
        evidenceThatChangesMind: '  margin pressure changes this  ',
      }),
    })
    state = seasonReducer(state, {
      type: 'ADD_DRAFT_CALL',
      call: draftCall(THESIS_IDS[1]),
    })
    state = seasonReducer(state, {
      type: 'ADD_DRAFT_CALL',
      call: draftCall(THESIS_IDS[2]),
    })

    expect(state.draft).toHaveLength(3)
    expect(state.draft[0]).toMatchObject({
      reason: '  AI  demand survives  ',
      evidenceThatChangesMind: '  margin pressure changes this  ',
    })

    const committed = seasonReducer(state, { type: 'COMMIT_DRAFT' })
    expect(committed.draft[0]).toMatchObject({
      reason: 'AI  demand survives',
      evidenceThatChangesMind: 'margin pressure changes this',
    })
    expect(committed.calls[0]?.original).toBe(committed.draft[0])

    state = createSeasonState()
    state = seasonReducer(state, {
      type: 'ADD_DRAFT_CALL',
      call: draftCall(THESIS_IDS[0], { reason: '', evidenceThatChangesMind: '' }),
    })
    state = seasonReducer(state, { type: 'ADD_DRAFT_CALL', call: draftCall(THESIS_IDS[1]) })
    state = seasonReducer(state, { type: 'ADD_DRAFT_CALL', call: draftCall(THESIS_IDS[2]) })
    expect(seasonReducer(state, { type: 'COMMIT_DRAFT' })).toBe(state)

    state = seasonReducer(state, {
      type: 'ADD_DRAFT_CALL',
      call: draftCall(THESIS_IDS[0]),
    })
    expect(seasonReducer(state, { type: 'COMMIT_DRAFT' }).phase).toBe('invite')
  })

  it('creates a stable six-character league, joins normalized valid codes, or starts solo', () => {
    const invite = committedState()
    const hostedA = seasonReducer(invite, { type: 'CREATE_LEAGUE' })
    const hostedB = seasonReducer(committedState(), { type: 'CREATE_LEAGUE' })

    expect(hostedA).toMatchObject({
      phase: 'invite',
      league: { role: 'host' },
    })
    expect(hostedA.league?.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect(hostedA.league?.code).toBe(hostedB.league?.code)

    const joined = seasonReducer(invite, { type: 'JOIN_LEAGUE', code: 'ab2cd3' })
    expect(joined).toMatchObject({
      phase: 'invite',
      league: { code: 'AB2CD3', role: 'member' },
    })
    expect(seasonReducer(invite, { type: 'JOIN_LEAGUE', code: 'O0I1XX' })).toBe(invite)
    expect(seasonReducer(joined, { type: 'CONTINUE_SOLO' })).toMatchObject({
      phase: 'updates',
      league: { code: 'AB2CD3', role: 'member' },
    })

    expect(createSeasonState(4, 'xy7za8')).toMatchObject({
      weekIndex: 4,
      league: { code: 'XY7ZA8', role: 'member' },
    })
  })
})

describe('Season updates, settlement, and weekend receipt', () => {
  it('keeps originals immutable while one current revision per day evolves', () => {
    let state = updatingState()
    const original = state.calls[0]?.original
    const tuesday = currentSeasonUpdate(state)
    expect(tuesday?.map(({ update }) => update.day)).toEqual([
      'Tuesday',
      'Tuesday',
      'Tuesday',
    ])

    state = seasonReducer(state, {
      type: 'REVISE_CALL',
      thesisId: THESIS_IDS[0],
      revision: {
        direction: 'short',
        confidence: 55,
        reason: 'The new order may only pull demand forward.',
        evidenceThatChangesMind: 'A broad backlog increase would restore the long case.',
        responseToEvidence: 'I am reducing risk because the timing is less certain.',
      },
    })
    state = seasonReducer(state, {
      type: 'REVISE_CALL',
      thesisId: THESIS_IDS[0],
      revision: {
        direction: 'long',
        confidence: 76,
        reason: 'The accelerator backlog now looks broad and durable.',
        evidenceThatChangesMind: 'A material order cancellation would break the case.',
        responseToEvidence: 'The verified order expansion raises my confidence.',
      },
    })

    expect(state.calls[0]?.original).toBe(original)
    expect(state.calls[0]?.original.direction).toBe('long')
    expect(state.calls[0]?.current.confidence).toBe(76)
    expect(state.calls[0]?.revisions).toHaveLength(1)
    expect(state.calls[0]?.revisions[0]?.updateIndex).toBe(0)

    const prior = state
    state = seasonReducer(state, { type: 'ADVANCE_UPDATE' })
    expect(prior.updateIndex).toBe(0)
    expect(state.updateIndex).toBe(1)
    expect(currentSeasonUpdate(state)?.[0]?.update.day).toBe('Wednesday')
    state = seasonReducer(state, { type: 'ADVANCE_UPDATE' })
    expect(state.updateIndex).toBe(2)
    state = seasonReducer(state, { type: 'ADVANCE_UPDATE' })
    expect(state.phase).toBe('settlement')
    expect(state.settlement?.calls).toHaveLength(3)
    expect(currentSeasonUpdate(state)).toBeNull()
  })

  it('applies the transparent 35/25/15/15/10 score weights at both boundaries', () => {
    expect(SEASON_SCORE_WEIGHTS).toEqual({
      direction: 35,
      calibration: 25,
      reasoning: 15,
      evidenceResponse: 15,
      benchmark: 10,
    })

    const perfectInput = draftCall('tsla-margin-reset', {
      direction: 'short',
      confidence: 60,
      reason: 'Inventory discount pressure will reset automotive margin.',
    })
    let perfect = updatingState([
      perfectInput,
      draftCall(THESIS_IDS[0]),
      draftCall(THESIS_IDS[1]),
    ])
    const confidenceByDay = [70, 60, 100]
    for (const confidence of confidenceByDay) {
      perfect = seasonReducer(perfect, {
        type: 'REVISE_CALL',
        thesisId: 'tsla-margin-reset',
        revision: {
          ...perfectInput,
          confidence,
          responseToEvidence: 'I changed confidence in the direction warranted by this evidence.',
        },
      })
      if (confidence !== 100) perfect = seasonReducer(perfect, { type: 'ADVANCE_UPDATE' })
    }
    const perfectCall = perfect.calls[0]
    if (perfectCall === undefined) throw new Error('Perfect call was not committed')
    expect(scoreSeasonCall(perfectCall).score).toEqual({
      direction: 35,
      calibration: 25,
      reasoning: 15,
      evidenceResponse: 15,
      benchmark: 10,
      total: 100,
    })

    const worstInput = draftCall('dkng-promo-normalization', {
      direction: 'long',
      confidence: 60,
      reason: 'A completely unrelated narrative without matching evidence.',
    })
    let worst = updatingState([
      worstInput,
      draftCall(THESIS_IDS[0]),
      draftCall(THESIS_IDS[1]),
    ])
    for (const confidence of [70, 60, 100]) {
      worst = seasonReducer(worst, {
        type: 'REVISE_CALL',
        thesisId: 'dkng-promo-normalization',
        revision: {
          ...worstInput,
          confidence,
          responseToEvidence: 'I moved opposite to the evidence.',
        },
      })
      if (confidence !== 100) {
        worst = seasonReducer(worst, { type: 'ADVANCE_UPDATE' })
      }
    }
    const worstCall = worst.calls[0]
    if (worstCall === undefined) throw new Error('Worst call was not committed')
    expect(scoreSeasonCall(worstCall).score).toEqual({
      direction: 0,
      calibration: 0,
      reasoning: 0,
      evidenceResponse: 0,
      benchmark: 0,
      total: 0,
    })
  })

  it('settles Friday, creates weekend receipts, and rematches into the next week', () => {
    let state = updatingState()
    state = seasonReducer(state, { type: 'ADVANCE_UPDATE' })
    state = seasonReducer(state, { type: 'ADVANCE_UPDATE' })
    const expectedSettlement = settleSeason(state)
    state = seasonReducer(state, { type: 'ADVANCE_UPDATE' })

    expect(state.settlement).toEqual(expectedSettlement)
    expect(state.settlement?.score.total).toBeGreaterThanOrEqual(0)
    expect(state.settlement?.score.total).toBeLessThanOrEqual(100)

    state = seasonReducer(state, { type: 'VIEW_RECEIPT' })
    expect(state).toMatchObject({
      phase: 'receipt',
      receipt: {
        weekIndex: 1,
        leagueCode: null,
        score: state.settlement?.score.total,
      },
    })
    expect(state.receipt?.insights.length).toBeGreaterThanOrEqual(3)
    expect(state.receipt?.shareText).toContain('OpenTrade Season · Week 1')

    const receipt = state.receipt
    state = seasonReducer(state, { type: 'REMATCH' })
    expect(state).toMatchObject({
      phase: 'draft',
      weekIndex: 2,
      draft: [],
      calls: [],
      updateIndex: 0,
      settlement: null,
      receipt: null,
    })
    expect(receipt?.weekIndex).toBe(1)
  })
})
