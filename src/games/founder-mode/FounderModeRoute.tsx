import { useCallback, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { setGameProgress } from '../../app/routes/progressStore'
import { asset } from '../../assets/catalog'
import { Button } from '../../shared/ui/Button'
import { founderEpisodeById, founderEpisodes } from './content/episodes'
import type { WritingStyle } from './content/types'
import { createFounderRun } from './engine/founderState'
import {
  createDefaultFounderSave,
  founderStore,
  progressBadgeForFounderSave,
  type FounderSaveV1,
} from './persistence/founderSave'
import { EpisodeArchive } from './ui/EpisodeArchive'
import { FounderLanding } from './ui/FounderLanding'
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
      setGameProgress('founder-mode', progressBadgeForFounderSave(fresh))
      setNotice(null)
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
      {save.activeRun ? (
        <section className="founder-screen founder-ready" aria-labelledby="ready-title">
          <div className="founder-kicker">Episode {episode.episodeNumber}</div>
          <h1 id="ready-title">The boardroom is ready</h1>
          <p>{episode.company}</p>
          <p>Your seat is waiting. The decision loop arrives next.</p>
          <Button
            variant="secondary"
            onClick={() => persist(Object.freeze({ ...save, activeRun: null }))}
          >
            Return to episode
          </Button>
        </section>
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
