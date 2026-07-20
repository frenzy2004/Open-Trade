export interface ProgressBarProps {
  label: string
  value: number
  max: number
}

export function ProgressBar({ label, value, max }: ProgressBarProps) {
  const boundedMax = Math.max(1, max)
  const boundedValue = Math.min(Math.max(0, value), boundedMax)
  const width = String((boundedValue / boundedMax) * 100) + '%'

  return (
    <div className="ui-progress">
      <div className="ui-progress__labels">
        <span>{label}</span>
        <span>
          {boundedValue} / {boundedMax}
        </span>
      </div>
      <div
        className="ui-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={boundedMax}
        aria-valuenow={boundedValue}
      >
        <span className="ui-progress__value" style={{ width }} />
      </div>
    </div>
  )
}
