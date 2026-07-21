import { useEffect, useId, useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import type { AiId, Ticker } from '../content/types'
import type { PortfolioMap } from '../engine/types'
import { PARTICIPANT_META } from './participantMeta'
import { portfolioForDisplay } from './portfolioPresentation'

interface Selection {
  readonly gives: Ticker | null
  readonly receives: Ticker | null
}

const EMPTY_SELECTION: Selection = Object.freeze({ gives: null, receives: null })

function knownOpponent(value: unknown): value is AiId {
  return value === 'momentum' || value === 'contrarian' || value === 'balanced'
}

export function OutgoingTradeDialog({
  open,
  opponentId,
  portfolios,
  onClose,
  onSubmit,
}: {
  readonly open: boolean
  readonly opponentId: AiId | null
  readonly portfolios: PortfolioMap
  readonly onClose: () => void
  readonly onSubmit: (opponentId: AiId, playerGives: Ticker, playerReceives: Ticker) => void
}) {
  const radioId = useId()
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION)
  useEffect(() => {
    if (!open) {
      // Closing is a complete transaction boundary; stale radio choices must not return.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelection(EMPTY_SELECTION)
    }
  }, [open, opponentId])

  const validOpponent = knownOpponent(opponentId) ? opponentId : null
  const player = portfolioForDisplay(portfolios, 'player')
  const opponent = validOpponent === null ? null : portfolioForDisplay(portfolios, validOpponent)
  const overlaps = player !== null && opponent !== null && player.tickers.some((ticker) => opponent.tickers.includes(ticker))
  const legal = validOpponent !== null && player !== null && opponent !== null && !overlaps
  const gives = legal && selection.gives !== null && player.tickers.includes(selection.gives) ? selection.gives : null
  const receives = legal && selection.receives !== null && opponent.tickers.includes(selection.receives) ? selection.receives : null
  const title = `Offer ${validOpponent === null ? 'an opponent' : PARTICIPANT_META[validOpponent].name} a trade`
  const close = () => {
    setSelection(EMPTY_SELECTION)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description="Choose exactly one card to give and one card to receive."
    >
      <form onSubmit={(event) => {
        event.preventDefault()
        if (!legal || gives === null || receives === null) return
        onSubmit(validOpponent, gives, receives)
        setSelection(EMPTY_SELECTION)
      }}>
        {legal ? (
          <>
            <fieldset>
              <legend>You give</legend>
              {player.tickers.map((ticker) => (
                <label key={ticker}>
                  <input
                    type="radio"
                    name={`gives-${radioId}`}
                    value={ticker}
                    checked={gives === ticker}
                    onChange={() => setSelection((current) => ({ ...current, gives: ticker }))}
                  />
                  Give {ticker}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>You receive</legend>
              {opponent.tickers.map((ticker) => (
                <label key={ticker}>
                  <input
                    type="radio"
                    name={`receives-${radioId}`}
                    value={ticker}
                    checked={receives === ticker}
                    onChange={() => setSelection((current) => ({ ...current, receives: ticker }))}
                  />
                  Receive {ticker}
                </label>
              ))}
            </fieldset>
          </>
        ) : <p>No legal one-for-one trade is available.</p>}
        <div className="outgoing-trade__actions">
          <Button type="submit" variant="primary" disabled={!legal || gives === null || receives === null}>
            Send trade offer
          </Button>
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}
