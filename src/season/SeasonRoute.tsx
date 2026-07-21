import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { asset } from '../assets/catalog'
import { SafeImage } from '../shared/assets/SafeImage'
import { Button } from '../shared/ui'
import {
  findSeasonThesis,
  SEASON_THESIS_DECK,
  type SeasonDirection,
} from './domain/content'
import {
  createSeasonState,
  currentSeasonUpdate,
  seasonReducer,
  type SeasonAction,
  type SeasonDraftCallInput,
  type SeasonState,
} from './domain/seasonEngine'
import {
  createSeasonSave,
  loadSeasonState,
  resetSeasonProgress,
  seasonStore,
} from './domain/seasonStore'
import './season.css'

type ControllerAction = SeasonAction | {
  readonly type: 'REPLACE_STATE'
  readonly state: SeasonState
}

function controllerReducer(
  state: SeasonState,
  action: ControllerAction,
): SeasonState {
  return action.type === 'REPLACE_STATE'
    ? action.state
    : seasonReducer(state, action)
}

function invitedLeagueCode(): string | undefined {
  const query = window.location.hash.split('?')[1]
  if (query === undefined) return undefined
  const code = new URLSearchParams(query).get('league')?.trim().toUpperCase()
  return code !== undefined && /^[A-HJ-NP-Z2-9]{6}$/.test(code)
    ? code
    : undefined
}

function freshSeasonState(): SeasonState {
  return createSeasonState(1, invitedLeagueCode())
}

interface LeagueStanding {
  readonly name: string
  readonly score: number
  readonly isPlayer: boolean
}

function stableHash(value: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619) >>> 0
  }
  return hash
}

function leagueStandings(code: string, playerScore: number): readonly LeagueStanding[] {
  const rivals = ['Mosaic Capital', 'Longview Club', 'Counterweight'].map((name) => ({
    name,
    score: Math.round((48 + (stableHash(`${code}:${name}`) % 3_800) / 100) * 100) / 100,
    isPlayer: false,
  }))
  return Object.freeze([
    ...rivals,
    { name: 'You', score: playerScore, isPlayer: true },
  ].sort((left, right) => right.score - left.score || left.name.localeCompare(right.name)))
}

function readInitialSeason(): {
  readonly state: SeasonState
  readonly recovery: string | null
} {
  const loaded = loadSeasonState()
  if (loaded.status === 'ready') {
    return { state: loaded.value.state, recovery: null }
  }
  if (loaded.status === 'recovery-required') {
    if (loaded.reason === 'storage-unavailable') {
      return { state: freshSeasonState(), recovery: null }
    }
    return {
      state: freshSeasonState(),
      recovery: loaded.reason === 'incompatible'
        ? 'This Season save uses an unsupported version.'
        : 'This Season save could not be read safely.',
    }
  }
  return { state: freshSeasonState(), recovery: null }
}

const PHASE_STEPS = [
  { key: 'draft', day: 'Monday', label: 'Draft' },
  { key: 'invite', day: 'Monday', label: 'Invite' },
  { key: 'updates', day: 'Tue–Thu', label: 'Updates' },
  { key: 'settlement', day: 'Friday', label: 'Settlement' },
  { key: 'receipt', day: 'Weekend', label: 'Receipt' },
] as const

function phaseIndex(phase: SeasonState['phase']): number {
  return PHASE_STEPS.findIndex(({ key }) => key === phase)
}

function callIsComplete(call: SeasonDraftCallInput): boolean {
  return call.reason.trim().length >= 12
    && call.evidenceThatChangesMind.trim().length >= 12
}

function DirectionControls({
  direction,
  name,
  onChange,
}: {
  readonly direction: SeasonDirection
  readonly name: string
  readonly onChange: (direction: SeasonDirection) => void
}) {
  return (
    <div className="season-direction">
      {(['long', 'short'] as const).map((value) => (
        <label key={value}>
          <input
            checked={direction === value}
            name={name}
            onChange={() => onChange(value)}
            type="radio"
          />
          {value.toUpperCase()}
        </label>
      ))}
    </div>
  )
}

function CommitmentCard({
  call,
  title = 'Original commitment',
}: {
  readonly call: SeasonDraftCallInput
  readonly title?: string
}) {
  return (
    <section className="season-commitment">
      <h3>{title}</h3>
      <dl>
        <dt>Direction</dt><dd>{call.direction.toUpperCase()}</dd>
        <dt>Confidence</dt><dd>{call.confidence}%</dd>
        <dt>Reason</dt><dd>{call.reason}</dd>
        <dt>Mind changer</dt><dd>{call.evidenceThatChangesMind}</dd>
      </dl>
    </section>
  )
}

export function SeasonRoute() {
  const [initial] = useState(readInitialSeason)
  const [state, dispatch] = useReducer(controllerReducer, initial.state)
  const [recovery, setRecovery] = useState(initial.recovery)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [leagueCode, setLeagueCode] = useState('')
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const persistenceBlocked = useRef(initial.recovery !== null)
  const hero = asset('season-week')
  const updates = useMemo(() => currentSeasonUpdate(state), [state])
  const standings = useMemo(() => (
    state.league === null || state.settlement === null
      ? null
      : leagueStandings(state.league.code, state.settlement.score.total)
  ), [state.league, state.settlement])
  const currentStep = phaseIndex(state.phase)

  useEffect(() => {
    if (persistenceBlocked.current) return
    const result = seasonStore.save(
      createSeasonSave(state),
      { seed: `season-week-${state.weekIndex}` },
    )
    setSaveError(result.ok
      ? null
      : 'This Season is playable, but progress could not be saved.')
  }, [state])

  const updateDraftCall = (
    thesisId: string,
    patch: Partial<SeasonDraftCallInput>,
  ) => {
    const existing = state.draft.find((call) => call.thesisId === thesisId)
    if (existing === undefined) return
    dispatch({
      type: 'ADD_DRAFT_CALL',
      call: { ...existing, ...patch, thesisId },
    })
  }

  const toggleThesis = (thesisId: string) => {
    const existing = state.draft.find((call) => call.thesisId === thesisId)
    if (existing !== undefined) {
      dispatch({ type: 'REMOVE_DRAFT_CALL', thesisId })
      return
    }
    const thesis = findSeasonThesis(thesisId)
    if (thesis === null || state.draft.length >= 3) return
    dispatch({
      type: 'ADD_DRAFT_CALL',
      call: {
        thesisId,
        direction: 'long',
        confidence: thesis.startingAiConfidence,
        reason: '',
        evidenceThatChangesMind: '',
      },
    })
  }

  const useSuggestedNotes = () => {
    for (const call of state.draft) {
      const thesis = findSeasonThesis(call.thesisId)
      if (thesis === null) continue
      dispatch({
        type: 'ADD_DRAFT_CALL',
        call: {
          ...call,
          reason: call.reason.trim().length === 0
            ? thesis.prompt
            : call.reason,
          evidenceThatChangesMind: call.evidenceThatChangesMind.trim().length === 0
            ? `I would reconsider if this counterargument holds: ${thesis.updates[0].counterargument}`
            : call.evidenceThatChangesMind,
        },
      })
    }
  }

  const resetRecovery = () => {
    try {
      const cleared = resetSeasonProgress()
      if (!cleared.ok) {
        setSaveError('Season progress could not be reset in this browser.')
        return
      }
      persistenceBlocked.current = false
      setRecovery(null)
      setSaveError(null)
      dispatch({ type: 'REPLACE_STATE', state: freshSeasonState() })
    } catch {
      setSaveError('Season progress could not be reset in this browser.')
    }
  }

  const copyText = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setShareStatus(success)
    } catch {
      setShareStatus('Copy is unavailable in this browser.')
    }
  }

  const shareReceipt = async () => {
    if (state.receipt === null) return
    const rank = standings?.findIndex(({ isPlayer }) => isPlayer)
    const text = rank === undefined || rank < 0 || state.league === null
      ? state.receipt.shareText
      : `${state.receipt.shareText}\nLeague ${state.league.code} · #${rank + 1} of ${standings?.length ?? 4}`
    try {
      if (navigator.share !== undefined) {
        await navigator.share({ title: 'My OpenTrade Season receipt', text })
        setShareStatus('Receipt shared.')
        return
      }
      await copyText(text, 'Receipt copied.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareStatus('Sharing is unavailable in this browser.')
    }
  }

  if (recovery !== null) {
    return (
      <section className="season-page" aria-labelledby="season-recovery-title">
        <div className="season-panel">
          <p className="season-eyebrow">OpenTrade Season</p>
          <h1 id="season-recovery-title">Season progress needs a reset</h1>
          <p role="alert" className="season-error">{recovery}</p>
          <p>The damaged value is preserved until you explicitly replace it.</p>
          <div className="season-actions">
            <Button onClick={resetRecovery}>Reset Season progress</Button>
            <a className="ui-button ui-button--secondary" href="#/">Back to Market Lab</a>
          </div>
          {saveError === null ? null : <p role="alert">{saveError}</p>}
        </div>
      </section>
    )
  }

  return (
    <section className="season-page" aria-label="OpenTrade Season">
      <header className="season-hero">
        <SafeImage
          alt={hero.alt}
          className="season-hero__image"
          fallbackLabel="Season artwork unavailable"
          src={hero.url}
        />
        <div className="season-hero__content">
          <p className="season-eyebrow">OpenTrade Season · Week {state.weekIndex}</p>
          <h1 aria-hidden="true">Make a call. Live with it.</h1>
          <p>Draft three theses, respond to the week, and score the decision—not only the result.</p>
          <div className="season-meta">
            <span className="season-pill">Deterministic</span>
            <span className="season-pill">Offline-ready</span>
            <span className="season-pill">No real money</span>
          </div>
        </div>
      </header>

      <nav className="season-stepper" aria-label="Season progress">
        <ol>
          {PHASE_STEPS.map((step, index) => (
            <li key={step.key} data-active={index <= currentStep} aria-current={index === currentStep ? 'step' : undefined}>
              <strong>{step.day}</strong><span>{step.label}</span>
            </li>
          ))}
        </ol>
      </nav>

      {saveError === null ? null : <p className="season-error" role="alert">{saveError}</p>}

      {state.phase === 'draft' ? (
        <section className="season-panel" aria-labelledby="season-draft-title">
          <div className="season-panel__intro">
            <p className="season-eyebrow">Monday · Week {state.weekIndex}</p>
            <h1 id="season-draft-title">Draft your three calls</h1>
            <p>Pick exactly three AI theses. Your original reason and mind-changer become the receipt against which the week is judged.</p>
          </div>
          <div className="season-deck" aria-label="AI thesis deck">
            {SEASON_THESIS_DECK.map((thesis) => {
              const selected = state.draft.some(({ thesisId }) => thesisId === thesis.id)
              return (
                <article className="season-thesis" data-selected={selected} key={thesis.id}>
                  <p className="season-thesis__ticker">{thesis.ticker}</p>
                  <h2>{thesis.title}</h2>
                  <p>{thesis.prompt}</p>
                  <p><strong>AI confidence:</strong> {thesis.startingAiConfidence}% · vs {thesis.benchmark}</p>
                  <Button
                    aria-pressed={selected}
                    disabled={!selected && state.draft.length >= 3}
                    onClick={() => toggleThesis(thesis.id)}
                    variant={selected ? 'secondary' : 'primary'}
                    aria-label={`${selected ? 'Remove' : 'Add'} ${thesis.ticker} ${selected ? 'from' : 'to'} your draft`}
                  >
                    {selected ? 'Remove call' : 'Add call'}
                  </Button>
                </article>
              )
            })}
          </div>
          {state.draft.length === 0 ? null : (
            <>
              <aside className="season-speedrun" aria-label="Speedrun option">
                <div>
                  <strong>Want the fast path?</strong>
                  <p>Keep your picks and confidence. We’ll add editable suggested notes so you can commit without typing.</p>
                </div>
                <Button
                  disabled={state.draft.every(callIsComplete)}
                  onClick={useSuggestedNotes}
                  variant="secondary"
                >
                  Skip writing — use suggested notes
                </Button>
              </aside>
              <div className="season-call-editors">
                {state.draft.map((call) => {
                  const thesis = findSeasonThesis(call.thesisId)
                  if (thesis === null) return null
                  return (
                    <fieldset className="season-call-editor" key={call.thesisId} aria-label={`${thesis.ticker} call`}>
                      <legend>{thesis.ticker} call</legend>
                      <DirectionControls
                        direction={call.direction}
                        name={`${call.thesisId}-direction`}
                        onChange={(direction) => updateDraftCall(call.thesisId, { direction })}
                      />
                      <label className="season-field">
                        <span>{thesis.ticker} confidence: {call.confidence}%</span>
                        <input aria-label={`${thesis.ticker} confidence`} min="50" max="95" step="1" type="range" value={call.confidence} onChange={(event) => updateDraftCall(call.thesisId, { confidence: Number(event.currentTarget.value) })} />
                      </label>
                      <label className="season-field">
                        <span>{thesis.ticker} reason</span>
                        <textarea aria-label={`${thesis.ticker} reason`} maxLength={320} value={call.reason} onChange={(event) => updateDraftCall(call.thesisId, { reason: event.currentTarget.value })} placeholder="One specific, falsifiable reason" />
                      </label>
                      <label className="season-field">
                        <span>Evidence that changes your {thesis.ticker} call</span>
                        <textarea aria-label={`Evidence that changes your ${thesis.ticker} call`} maxLength={320} value={call.evidenceThatChangesMind} onChange={(event) => updateDraftCall(call.thesisId, { evidenceThatChangesMind: event.currentTarget.value })} placeholder="What would make you update?" />
                      </label>
                    </fieldset>
                  )
                })}
              </div>
            </>
          )}
          <div className="season-actions">
            <Button
              disabled={state.draft.length !== 3 || !state.draft.every(callIsComplete)}
              onClick={() => dispatch({ type: 'COMMIT_DRAFT' })}
            >
              Commit three calls
            </Button>
            <span aria-live="polite">{state.draft.length} of 3 calls ready</span>
          </div>
        </section>
      ) : null}

      {state.phase === 'invite' ? (
        <section className="season-panel" aria-labelledby="season-invite-title">
          <div className="season-panel__intro">
            <p className="season-eyebrow">Monday · Calls locked</p>
            <h1 id="season-invite-title">Invite your league</h1>
            <p>Your week is already playable solo. Create a deterministic challenge code, join a friend's code, or continue without a league.</p>
          </div>
          <div className="season-call-editors">
            {state.calls.map((call) => {
              const thesis = findSeasonThesis(call.thesisId)
              return thesis === null ? null : <CommitmentCard key={call.thesisId} call={call.original} title={`${thesis.ticker} original commitment`} />
            })}
          </div>
          {state.league === null ? (
            <div className="season-actions">
              <Button onClick={() => dispatch({ type: 'CREATE_LEAGUE' })}>Create league</Button>
              <Button variant="secondary" onClick={() => dispatch({ type: 'CONTINUE_SOLO' })}>Continue solo</Button>
            </div>
          ) : (
            <>
              <p className="season-league-code">League code {state.league.code}</p>
              <div className="season-actions">
                <Button onClick={() => void copyText(`${window.location.origin}${window.location.pathname}#/season?league=${state.league?.code ?? ''}`, 'League invite copied.')}>Copy league invite</Button>
                <Button variant="secondary" onClick={() => dispatch({ type: 'CONTINUE_SOLO' })}>Open Tuesday update</Button>
              </div>
            </>
          )}
          <form className="season-join" onSubmit={(event) => { event.preventDefault(); dispatch({ type: 'JOIN_LEAGUE', code: leagueCode }) }}>
            <label className="season-field"><span>League code</span><input aria-label="League code" maxLength={6} pattern="[A-HJ-NP-Za-hj-np-z2-9]{6}" value={leagueCode} onChange={(event) => setLeagueCode(event.currentTarget.value.toUpperCase())} /></label>
            <Button type="submit" variant="secondary" disabled={!/^[A-HJ-NP-Z2-9]{6}$/.test(leagueCode)}>Join league</Button>
          </form>
          {shareStatus === null ? null : <p role="status">{shareStatus}</p>}
        </section>
      ) : null}

      {state.phase === 'updates' && updates !== null ? (
        <section className="season-panel" aria-labelledby="season-update-title">
          <div className="season-panel__intro">
            <p className="season-eyebrow">{updates[0]?.update.day} · Evidence packet {state.updateIndex + 1} of 3</p>
            <h1 id="season-update-title">{updates[0]?.update.day} evidence</h1>
            <p>The original stays on the record. Revise only if the new evidence genuinely changes your thesis.</p>
          </div>
          <div className="season-update-grid">
            {updates.map(({ thesisId, ticker, update }) => {
              const call = state.calls.find((candidate) => candidate.thesisId === thesisId)
              if (call === undefined) return null
              return (
                <article className="season-update-card" key={thesisId}>
                  <p className="season-thesis__ticker">{ticker}</p>
                  <h2>{update.title}</h2>
                  <p className="season-update-card__evidence">{update.summary}</p>
                  <p><strong>AI confidence:</strong> {update.aiConfidence}%</p>
                  <p><strong>Counterargument:</strong> {update.counterargument}</p>
                  <p><strong>Next catalyst:</strong> {update.catalyst}</p>
                  <CommitmentCard call={call.original} />
                  {call.revisions.length === 0 ? null : <CommitmentCard call={call.current} title="Current revised call" />}
                  <details>
                    <summary>Revise this call</summary>
                    <RevisionEditor
                      key={`${thesisId}-${state.updateIndex}`}
                      call={call.current}
                      ticker={ticker}
                      onSave={({ direction, confidence, reason, evidenceThatChangesMind, responseToEvidence }) => dispatch({
                        type: 'REVISE_CALL',
                        thesisId,
                        revision: { direction, confidence, reason, evidenceThatChangesMind, responseToEvidence },
                      })}
                    />
                  </details>
                </article>
              )
            })}
          </div>
          <Button onClick={() => dispatch({ type: 'ADVANCE_UPDATE' })}>Lock {updates[0]?.update.day} response</Button>
        </section>
      ) : null}

      {state.phase === 'settlement' && state.settlement !== null ? (
        <section className="season-panel" aria-labelledby="season-settlement-title">
          <div className="season-panel__intro">
            <p className="season-eyebrow">Friday · The result is in</p>
            <h1 id="season-settlement-title">Friday settlement</h1>
            <p>Return is only one input. Each call is scored on direction, calibration, reasoning, evidence response, and its relevant benchmark.</p>
          </div>
          <p className="season-receipt__score">{state.settlement.score.total}</p>
          <p><strong>Decision quality score</strong> out of 100</p>
          <div className="season-score-grid">
            {state.settlement.calls.map((result) => {
              const thesis = findSeasonThesis(result.thesisId)
              return (
                <article className="season-score-card" key={result.thesisId}>
                  <p className="season-thesis__ticker">{result.ticker}</p>
                  <h2>{result.outcomeDirection.toUpperCase()} outcome</h2>
                  <p>{thesis?.result.outcomeSummary}</p>
                  <p className="season-score-card__total">{result.score.total}/100</p>
                  <ScoreBreakdown score={result.score} />
                </article>
              )
            })}
          </div>
          {standings === null || state.league === null ? null : (
            <LeagueTable code={state.league.code} standings={standings} />
          )}
          <Button onClick={() => dispatch({ type: 'VIEW_RECEIPT' })}>Score my week</Button>
        </section>
      ) : null}

      {state.phase === 'receipt' && state.receipt !== null ? (
        <section className="season-receipt" aria-labelledby="season-receipt-title">
          <div>
            <p className="season-eyebrow">Weekend · Week {state.weekIndex}</p>
            <h1 id="season-receipt-title">Your weekly receipt</h1>
          </div>
          <p className="season-receipt__score">{state.receipt.score}</p>
          <p><strong>Decision quality score</strong> · {state.receipt.headline}</p>
          {state.settlement === null ? null : <ScoreBreakdown score={state.settlement.score} />}
          <ul className="season-receipt__insights">
            {state.receipt.insights.map((insight) => <li key={insight}>{insight}</li>)}
          </ul>
          {standings === null || state.league === null ? null : (
            <LeagueTable code={state.league.code} standings={standings} />
          )}
          <p>Direction · 35 max · Calibration · 25 max · Reasoning · 15 max · Evidence response · 15 max · Benchmark · 10 max</p>
          <div className="season-share-actions">
            <Button onClick={() => void shareReceipt()}>Share my receipt</Button>
            <Button variant="secondary" onClick={() => dispatch({ type: 'REMATCH' })}>Rematch next Monday</Button>
            <a className="ui-button ui-button--ghost" href="#/">Back to Market Lab</a>
          </div>
          {shareStatus === null ? null : <p role="status">{shareStatus}</p>}
        </section>
      ) : null}
    </section>
  )
}

function LeagueTable({
  code,
  standings,
}: {
  readonly code: string
  readonly standings: readonly LeagueStanding[]
}) {
  return (
    <section className="season-league-table" aria-labelledby="season-league-table-title">
      <div>
        <p className="season-eyebrow">Local challenge · {code}</p>
        <h2 id="season-league-table-title">League table</h2>
        <p>Three simulated rivals use the same fixed week and scoring rules. No live account or money is involved.</p>
      </div>
      <ol>
        {standings.map((standing, index) => (
          <li data-player={standing.isPlayer} key={standing.name}>
            <span>#{index + 1}</span>
            <strong>{standing.name}</strong>
            <span>{standing.score.toFixed(2)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function RevisionEditor({
  call,
  ticker,
  onSave,
}: {
  readonly call: SeasonDraftCallInput
  readonly ticker: string
  readonly onSave: (revision: SeasonDraftCallInput & { readonly responseToEvidence: string }) => void
}) {
  const [draft, setDraft] = useState({ ...call, responseToEvidence: '' })
  return (
    <fieldset className="season-call-editor" aria-label={`${ticker} revision`}>
      <legend>Revise {ticker}</legend>
      <DirectionControls direction={draft.direction} name={`${draft.thesisId}-revision-direction`} onChange={(direction) => setDraft((current) => ({ ...current, direction }))} />
      <label className="season-field"><span>{ticker} revised confidence: {draft.confidence}%</span><input min="50" max="95" type="range" value={draft.confidence} onChange={(event) => {
        const confidence = Number(event.currentTarget.value)
        setDraft((current) => ({ ...current, confidence }))
      }} /></label>
      <label className="season-field"><span>Revised reason</span><textarea maxLength={320} value={draft.reason} onChange={(event) => {
        const reason = event.currentTarget.value
        setDraft((current) => ({ ...current, reason }))
      }} /></label>
      <label className="season-field"><span>Evidence that changes your call</span><textarea maxLength={320} value={draft.evidenceThatChangesMind} onChange={(event) => {
        const evidenceThatChangesMind = event.currentTarget.value
        setDraft((current) => ({ ...current, evidenceThatChangesMind }))
      }} /></label>
      <label className="season-field"><span>Response to this evidence</span><textarea maxLength={320} value={draft.responseToEvidence} onChange={(event) => {
        const responseToEvidence = event.currentTarget.value
        setDraft((current) => ({ ...current, responseToEvidence }))
      }} /></label>
      <Button disabled={draft.responseToEvidence.trim().length < 8} onClick={() => onSave(draft)}>Save revision for {ticker}</Button>
    </fieldset>
  )
}

function ScoreBreakdown({
  score,
}: {
  readonly score: {
    readonly direction: number
    readonly calibration: number
    readonly reasoning: number
    readonly evidenceResponse: number
    readonly benchmark: number
    readonly total: number
  }
}) {
  return (
    <dl className="season-score-breakdown">
      <div><dt>Direction</dt><dd>{score.direction}/35</dd></div>
      <div><dt>Calibration</dt><dd>{score.calibration}/25</dd></div>
      <div><dt>Reasoning</dt><dd>{score.reasoning}/15</dd></div>
      <div><dt>Evidence response</dt><dd>{score.evidenceResponse}/15</dd></div>
      <div><dt>Benchmark</dt><dd>{score.benchmark}/10</dd></div>
    </dl>
  )
}
