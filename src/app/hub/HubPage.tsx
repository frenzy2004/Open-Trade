import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Dialog, useToasts } from '../../shared/ui'
import { APP_DISCLAIMER } from '../appMeta'
import {
  readGameProgress,
  subscribeToGameProgress,
} from '../routes/progressStore'
import { GAME_ROUTES } from '../routes/registry'
import type { GameRouteRegistration } from '../routes/types'
import { GameCard } from './GameCard'

const SEASON_STEPS = [
  {
    day: 'Monday',
    phase: 'Draft',
    detail: 'Commit three calls with direction, confidence, and a reason.',
  },
  {
    day: 'Tuesday–Thursday',
    phase: 'Updates',
    detail: 'Respond to new evidence while every original call stays visible.',
  },
  {
    day: 'Friday',
    phase: 'Settlement',
    detail: 'Score the judgment, calibration, and response—not luck alone.',
  },
  {
    day: 'Weekend',
    phase: 'Receipt & rematch',
    detail: 'Share what your decisions reveal, then run it back next week.',
  },
] as const

export function HubPage() {
  const [howRoute, setHowRoute] = useState<GameRouteRegistration | null>(null)
  const [resetRoute, setResetRoute] =
    useState<GameRouteRegistration | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const resetInFlightRef = useRef(false)
  const resetAttemptRef = useRef(0)
  const [, refreshProgress] = useState(0)
  const { addToast } = useToasts()

  useEffect(() => {
    const unsubscribe = subscribeToGameProgress(() => {
        refreshProgress((value) => value + 1)
    })
    return () => {
      unsubscribe()
      resetAttemptRef.current += 1
      resetInFlightRef.current = false
    }
  }, [])

  const cancelReset = () => {
    resetAttemptRef.current += 1
    resetInFlightRef.current = false
    setIsResetting(false)
    setResetRoute(null)
  }

  const confirmReset = async () => {
    if (resetRoute === null || resetInFlightRef.current) {
      return
    }
    const route = resetRoute
    const attempt = resetAttemptRef.current + 1
    resetAttemptRef.current = attempt
    resetInFlightRef.current = true
    setIsResetting(true)
    try {
      const module = await route.load()
      if (resetAttemptRef.current !== attempt) {
        return
      }
      module.gameRoute.reset()
      if (resetAttemptRef.current !== attempt) {
        return
      }
      addToast(route.metadata.title + ' progress reset', 'success')
      setResetRoute(null)
    } catch {
      if (resetAttemptRef.current === attempt) {
        addToast(route.metadata.title + ' progress reset failed', 'warning')
      }
    } finally {
      if (resetAttemptRef.current === attempt) {
        resetInFlightRef.current = false
        setIsResetting(false)
      }
    }
  }

  return (
    <section className="hub" aria-labelledby="hub-title">
      <section className="hub__season" aria-labelledby="season-title">
        <div className="hub__hero">
          <p className="hub__eyebrow">One weekly ritual</p>
          <h1 id="hub-title">One market week. One complete loop.</h1>
          <p className="hub__lede">
            Make a call, live with the evidence, and learn what happened to
            your judgment—not only your return.
          </p>
          <Link
            className="hub__season-cta ui-button ui-button--primary"
            to="/season"
          >
            Start OpenTrade Season
            <span aria-hidden="true"> →</span>
          </Link>
          <p className="hub__season-note">
            Draft → invite → update → settle → share → rematch
          </p>
          <p className="hub__disclaimer">{APP_DISCLAIMER}</p>
        </div>

        <div className="hub__season-board">
          <div className="hub__season-heading">
            <div>
              <p className="hub__season-kicker">The complete loop</p>
              <h2 id="season-title">OpenTrade Season</h2>
            </div>
            <span className="hub__season-status">Weekly</span>
          </div>
          <ol
            className="hub__timeline"
            aria-label="OpenTrade Season weekly timeline"
          >
            {SEASON_STEPS.map((step, index) => (
              <li className="hub__timeline-step" key={step.day}>
                <span className="hub__timeline-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="hub__timeline-day">{step.day}</p>
                <p className="hub__timeline-phase">{step.phase}</p>
                <p className="hub__timeline-detail">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="hub__market-lab" aria-labelledby="market-lab-title">
        <div className="hub__market-lab-heading">
          <div>
            <p className="hub__eyebrow">Practice modes</p>
            <h2 id="market-lab-title">Market Lab</h2>
          </div>
          <p>
            Sharpen one skill at a time, then bring it into your next Season.
          </p>
        </div>

        <div className="hub__grid" aria-label="OpenTrade games">
          {GAME_ROUTES.map((route) => (
            <GameCard
              key={route.metadata.id}
              metadata={route.metadata}
              badge={readGameProgress(route.metadata.id)}
              onHowItWorks={() => setHowRoute(route)}
              onReset={() => setResetRoute(route)}
            />
          ))}
        </div>
      </section>

      <Dialog
        open={howRoute !== null}
        onClose={() => setHowRoute(null)}
        title={
          howRoute === null
            ? 'How the game works'
            : 'How ' + howRoute.metadata.title + ' works'
        }
        {...(howRoute === null
          ? {}
          : { description: howRoute.metadata.description })}
      >
        {howRoute === null ? null : (
          <ol className="hub__rules">
            {howRoute.metadata.howItWorks.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        )}
      </Dialog>

      <Dialog
        open={resetRoute !== null}
        onClose={cancelReset}
        title={
          resetRoute === null
            ? 'Reset progress'
            : 'Reset ' + resetRoute.metadata.title + ' progress'
        }
        description="This removes only this game save from this browser."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={cancelReset}
            >
              Keep progress
            </Button>
            <Button
              variant="danger"
              disabled={isResetting}
              aria-busy={isResetting}
              onClick={() => void confirmReset()}
              aria-label={
                resetRoute === null
                  ? 'Confirm reset'
                  : 'Confirm reset ' + resetRoute.metadata.title
              }
            >
              Reset progress
            </Button>
          </>
        }
      />
    </section>
  )
}
