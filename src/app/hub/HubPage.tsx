import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, useToasts } from '../../shared/ui'
import { APP_DISCLAIMER } from '../appMeta'
import {
  readGameProgress,
  subscribeToGameProgress,
} from '../routes/progressStore'
import { GAME_ROUTES } from '../routes/registry'
import type { GameRouteRegistration } from '../routes/types'
import { GameCard } from './GameCard'

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
      <div className="hub__hero">
        <p className="hub__eyebrow">Three original simulated markets</p>
        <h1 id="hub-title">Choose your market</h1>
        <p className="hub__lede">
          Draft a portfolio, rewrite a founder decision, or run the market.
          Every result is deterministic, replayable, and entirely fictional.
        </p>
        <p className="hub__disclaimer">{APP_DISCLAIMER}</p>
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
