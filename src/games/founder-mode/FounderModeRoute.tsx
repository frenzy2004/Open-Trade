import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from 'react'
import { Link } from 'react-router-dom'
import { setGameProgress } from '../../app/routes/progressStore'
import { asset } from '../../assets/catalog'
import { Button } from '../../shared/ui/Button'
import { founderEpisodeById, founderEpisodes } from './content/episodes'
import type { WritingStyle } from './content/types'
import { founderReducer } from './engine/founderReducer'
import {
  createFounderRun,
  type FounderAction,
} from './engine/founderState'
import {
  createDefaultFounderSave,
  founderStore,
  nextStreak,
  progressBadgeForFounderSave,
  type FounderSaveV1,
} from './persistence/founderSave'
import { EpisodeArchive } from './ui/EpisodeArchive'
import { FounderDecision } from './ui/FounderDecision'
import { FounderEnding } from './ui/FounderEnding'
import { FounderIntro } from './ui/FounderIntro'
import { FounderLanding } from './ui/FounderLanding'
import { FounderOutcome } from './ui/FounderOutcome'
import './founder-mode.css'

type RouteView = 'landing' | 'archive'

const founderModeStyle = Object.freeze({
  '--founder-boardroom': `url("${asset('fm-boardroom').url}")`,
}) as CSSProperties

type InitialRouteState =
  | { readonly status: 'ready'; readonly save: FounderSaveV1 }
  | {
      readonly status: 'recovery-required'
      readonly reason: string
      readonly detail: string
    }

function loadInitialState(): InitialRouteState {
  const loaded = founderStore.load()
  if (loaded.status === 'ready') {
    return { status: 'ready', save: loaded.value }
  }
  if (loaded.status === 'empty') {
    return { status: 'ready', save: createDefaultFounderSave() }
  }
  return {
    status: 'recovery-required',
    reason: loaded.reason,
    detail: loaded.detail,
  }
}

export function FounderModeRoute() {
  const [routeState, setRouteState] = useState(loadInitialState)
  const [view, setView] = useState<RouteView>('landing')
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const loaded = founderStore.load()
    const save =
      loaded.status === 'ready'
        ? loaded.value
        : loaded.status === 'empty'
          ? createDefaultFounderSave()
          : null
    if (!save) return
    const progress = setGameProgress(
      'founder-mode',
      progressBadgeForFounderSave(save),
    )
    if (progress.ok) return
    const noticeTimer = window.setTimeout(() => {
      setNotice('Game loaded, but the hub streak could not update.')
    }, 0)
    return () => window.clearTimeout(noticeTimer)
  }, [])

  const persist = useCallback((save: FounderSaveV1) => {
    const result = founderStore.save(save)
    if (!result.ok) {
      setNotice('Your change is active, but browser storage could not save it.')
      setRouteState({ status: 'ready', save })
      return false
    }

    setRouteState({ status: 'ready', save })
    const progress = setGameProgress(
      'founder-mode',
      progressBadgeForFounderSave(save),
    )
    setNotice(
      progress.ok ? null : 'Game saved, but the hub streak could not update.',
    )
    return true
  }, [])

  if (routeState.status === 'recovery-required') {
    const startFresh = () => {
      const fresh = createDefaultFounderSave()
      const result = founderStore.save(fresh)
      if (!result.ok) {
        setNotice('The existing save is still safe because replacement failed.')
        return
      }
      const progress = setGameProgress(
        'founder-mode',
        progressBadgeForFounderSave(fresh),
      )
      setNotice(
        progress.ok
          ? null
          : 'Fresh save created, but the hub streak could not update.',
      )
      setRouteState({ status: 'ready', save: fresh })
    }

    return (
      <div className="founder-mode" style={founderModeStyle}>
        <section className="founder-screen founder-recovery" role="alert">
          <div className="founder-kicker">Recovery</div>
          <h1>Save recovery required</h1>
          <p>
            Founder Mode found a {routeState.reason} save and left it untouched.
          </p>
          <p className="founder-recovery-detail">{routeState.detail}</p>
          {notice ? <p className="founder-notice">{notice}</p> : null}
          <Button onClick={startFresh}>Start fresh and replace save</Button>
          <Link className="founder-back-link" to="/">
            Back to all games
          </Link>
        </section>
      </div>
    )
  }

  const { save } = routeState
  const fallbackEpisode = founderEpisodes.at(0)
  if (!fallbackEpisode) {
    throw new Error('Founder Mode requires at least one episode')
  }
  const episode =
    founderEpisodeById(save.selectedEpisodeId) ?? fallbackEpisode

  const updateStyle = (style: WritingStyle) => {
    persist(Object.freeze({ ...save, style, activeRun: null }))
  }
  const selectEpisode = (episodeId: string) => {
    persist(Object.freeze({ ...save, selectedEpisodeId: episodeId, activeRun: null }))
    setView('landing')
  }
  const play = () => {
    persist(Object.freeze({ ...save, activeRun: createFounderRun(episode, save.style) }))
  }
  const actOnRun = (action: FounderAction) => {
    if (!save.activeRun) return
    const nextRun = founderReducer(save.activeRun, action, episode)
    if (nextRun !== save.activeRun) {
      const completedNow =
        save.activeRun.phase !== 'ending' && nextRun.phase === 'ending'
      if (completedNow) {
        const today = new Date().toISOString().slice(0, 10)
        persist(
          Object.freeze({
            ...save,
            streakDays: nextStreak(
              save.lastCompletedDate,
              save.streakDays,
              today,
            ),
            lastCompletedDate: today,
            activeRun: nextRun,
          }),
        )
        return
      }
      persist(Object.freeze({ ...save, activeRun: nextRun }))
    }
  }

  return (
    <div className="founder-mode" style={founderModeStyle}>
      <div className="founder-route-nav">
        <Link className="founder-back-link" to="/">
          Back to all games
        </Link>
      </div>
      {notice ? (
        <p className="founder-notice" role="status">
          {notice}
        </p>
      ) : null}
      {save.activeRun?.phase === 'intro' ? (
        <FounderIntro
          episode={episode}
          style={save.activeRun.style}
          onTakeChair={() => actOnRun({ type: 'TAKE_CHAIR' })}
          onExit={() => persist(Object.freeze({ ...save, activeRun: null }))}
        />
      ) : save.activeRun?.phase === 'decision' ? (
        <FounderDecision
          episode={episode}
          run={save.activeRun}
          onChoose={(choiceId) => actOnRun({ type: 'CHOOSE', choiceId })}
        />
      ) : save.activeRun?.phase === 'outcome' ? (
        <FounderOutcome
          episode={episode}
          run={save.activeRun}
          onContinue={() => actOnRun({ type: 'NEXT' })}
        />
      ) : save.activeRun?.phase === 'ending' ? (
        <FounderEnding
          episode={episode}
          run={save.activeRun}
          streakDays={save.streakDays}
          onReplay={() => actOnRun({ type: 'REPLAY' })}
          onOpenArchive={() => {
            persist(Object.freeze({ ...save, activeRun: null }))
            setView('archive')
          }}
        />
      ) : view === 'archive' ? (
        <EpisodeArchive
          episodes={founderEpisodes}
          selectedEpisodeId={episode.id}
          onSelect={selectEpisode}
          onBack={() => setView('landing')}
        />
      ) : (
        <FounderLanding
          episode={episode}
          style={save.style}
          streakDays={save.streakDays}
          onStyleChange={updateStyle}
          onPlay={play}
          onOpenArchive={() => setView('archive')}
        />
      )}
    </div>
  )
}
