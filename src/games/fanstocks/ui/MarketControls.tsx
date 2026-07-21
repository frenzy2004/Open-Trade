import { Button } from '../../../shared/ui/Button'
import type { MarketSpeed } from '../engine/fanStocksReducer'

const SPEEDS: readonly MarketSpeed[] = Object.freeze([1, 2, 4])

export function MarketControls({
  paused,
  speed,
  disabled = false,
  onSetPaused,
  onSetSpeed,
}: {
  readonly paused: boolean
  readonly speed: MarketSpeed
  readonly disabled?: boolean
  readonly onSetPaused: (value: boolean) => void
  readonly onSetSpeed: (value: MarketSpeed) => void
}) {
  return (
    <div className="market-controls" role="group" aria-label="Market playback controls">
      <Button
        variant="secondary"
        aria-pressed={paused}
        aria-label={paused ? 'Resume market' : 'Pause market'}
        disabled={disabled}
        onClick={() => onSetPaused(!paused)}
      >
        {paused ? 'Resume' : 'Pause'}
      </Button>
      {SPEEDS.map((value) => (
        <Button
          key={value}
          variant="ghost"
          aria-label={`Set market speed to ${value}x`}
          aria-pressed={speed === value}
          disabled={disabled}
          onClick={() => onSetSpeed(value)}
        >
          {value}x
        </Button>
      ))}
    </div>
  )
}
