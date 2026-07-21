import type { FounderHistoryItem } from '../engine/founderState'

interface ValuationChartProps {
  readonly realityBn: number
  readonly playerBn: number
  readonly history: readonly FounderHistoryItem[]
}

function formatBillions(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function safeChartValue(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function ValuationChart({
  realityBn,
  playerBn,
  history,
}: ValuationChartProps) {
  const safeReality = safeChartValue(realityBn)
  const safePlayer = safeChartValue(playerBn)
  const ceiling = Math.max(safeReality, safePlayer, 1)
  const realityHeight = (safeReality / ceiling) * 76
  const playerHeight = (safePlayer / ceiling) * 76
  const decisionWord = history.length === 1 ? 'decision' : 'decisions'
  const summary = `Reality is $${formatBillions(safeReality)} billion; your company is $${formatBillions(safePlayer)} billion after ${history.length} ${decisionWord}.`

  return (
    <figure className="founder-valuation-chart">
      <svg
        viewBox="0 0 320 140"
        role="img"
        aria-label="Reality and player company valuation comparison"
      >
        <line className="founder-chart-axis" x1="24" y1="112" x2="296" y2="112" />
        <rect
          className="founder-chart-bar founder-chart-bar--reality"
          x="72"
          y={112 - realityHeight}
          width="64"
          height={realityHeight}
          rx="5"
        />
        <rect
          className="founder-chart-bar founder-chart-bar--player"
          x="184"
          y={112 - playerHeight}
          width="64"
          height={playerHeight}
          rx="5"
        />
        <text x="104" y="132" textAnchor="middle">
          Reality
        </text>
        <text x="216" y="132" textAnchor="middle">
          Your call
        </text>
      </svg>
      <figcaption className="visually-hidden">{summary}</figcaption>
    </figure>
  )
}
