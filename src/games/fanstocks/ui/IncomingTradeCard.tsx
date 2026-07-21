import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { STOCK_BY_TICKER } from '../content/stocks'
import type { AiId } from '../content/types'
import type { TradeOffer } from '../engine/trades'
import { PARTICIPANT_META } from './participantMeta'

const OFFER_FIELDS: readonly (keyof TradeOffer)[] = Object.freeze([
  'id', 'direction', 'opponentId', 'playerGives', 'playerReceives', 'createdAtTick',
])

function validIncomingOffer(value: TradeOffer): TradeOffer | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const candidate = value as Partial<Record<keyof TradeOffer, unknown>>
  if (
    !OFFER_FIELDS.every((field) => Object.hasOwn(candidate, field)) ||
    typeof candidate.id !== 'string' || candidate.id.trim() === '' ||
    candidate.direction !== 'incoming' ||
    (candidate.opponentId !== 'momentum' && candidate.opponentId !== 'contrarian' && candidate.opponentId !== 'balanced') ||
    typeof candidate.playerGives !== 'string' ||
    !STOCK_BY_TICKER.has(candidate.playerGives) ||
    typeof candidate.playerReceives !== 'string' ||
    !STOCK_BY_TICKER.has(candidate.playerReceives) ||
    candidate.playerGives === candidate.playerReceives ||
    !Number.isSafeInteger(candidate.createdAtTick) ||
    (candidate.createdAtTick as number) < 0
  ) return null
  return value
}

export function IncomingTradeCard({ offer, onAccept, onPass }: {
  readonly offer: TradeOffer
  readonly onAccept: () => void
  readonly onPass: () => void
}) {
  const validOffer = validIncomingOffer(offer)
  if (validOffer === null) return <p role="status">Trade offer unavailable.</p>
  const opponentId = validOffer.opponentId as AiId
  const title = `${PARTICIPANT_META[opponentId].name} offers a trade`
  return (
    <Dialog
      open
      onClose={onPass}
      title={title}
      description="One card for one card"
    >
      <section className="incoming-trade" aria-label="Incoming one-for-one trade">
        <dl className="trade-direction">
          <div><dt>You receive</dt><dd>{validOffer.playerReceives}</dd></div>
          <div><dt>You give</dt><dd>{validOffer.playerGives}</dd></div>
        </dl>
        <div className="incoming-trade__actions">
          <Button
            variant="primary"
            aria-label={`Accept: receive ${validOffer.playerReceives} and give ${validOffer.playerGives}`}
            onClick={onAccept}
          >
            <span aria-hidden="true">✓</span> Accept
          </Button>
          <Button variant="secondary" aria-label="Pass on trade" onClick={onPass}>
            <span aria-hidden="true">×</span> Pass
          </Button>
        </div>
      </section>
    </Dialog>
  )
}
