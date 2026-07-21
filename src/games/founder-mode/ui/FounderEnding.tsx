import { Button } from '../../../shared/ui/Button'
import type { FounderEpisode, FounderStyle } from '../content/types'
import { scoreFounderRun } from '../engine/scoreFounderRun'
import type { FounderRunState } from '../engine/founderState'
import { DecisionRecap } from './DecisionRecap'
import { ValuationChart } from './ValuationChart'

interface FounderEndingProps {
  readonly episode: FounderEpisode
  readonly run: FounderRunState
  readonly streakDays: number
  readonly onReplay: () => void
  readonly onOpenArchive: () => void
}

const STYLE_LABELS: Readonly<Record<FounderStyle, string>> = Object.freeze({
  visionary: 'Visionary',
  operator: 'Operator',
  consensus: 'Consensus',
})

const TIER_LABELS = Object.freeze({
  legend: 'Legend',
  builder: 'Builder',
  survivor: 'Survivor',
  cautionary: 'Cautionary tale',
})

export function FounderEnding({
  episode,
  run,
  streakDays,
  onReplay,
  onOpenArchive,
}: FounderEndingProps) {
  const score = scoreFounderRun(run, episode)
  const styles = Object.entries(score.stylePercentages) as [
    FounderStyle,
    number,
  ][]

  return (
    <section className="founder-screen founder-ending" aria-labelledby="ending-title">
      <div className="founder-kicker">Episode complete</div>
      <h1 id="ending-title">You built your {episode.company}</h1>
      <p className="founder-tier">
        Founder tier: <strong>{TIER_LABELS[score.tier]}</strong>
      </p>
      <p className="founder-streak">
        Founder streak: {streakDays} {streakDays === 1 ? 'day' : 'days'}
      </p>

      <div className="founder-ending-grid">
        <div
          className="founder-final-values"
          role="group"
          aria-label="Final valuations"
        >
          <div>
            <span>Your company</span>
            <strong>${run.currentValueBn.toFixed(1)}B</strong>
          </div>
          <div>
            <span>Historical reality</span>
            <strong>${episode.historicalEndValueBn.toFixed(1)}B</strong>
          </div>
        </div>
        <ValuationChart
          realityBn={episode.historicalEndValueBn}
          playerBn={run.currentValueBn}
          history={run.history}
        />
      </div>

      <section className="founder-style-mix" aria-labelledby="style-mix-title">
        <h2 id="style-mix-title">Your founder style</h2>
        <p>Your mix is based on the style weights of all five choices</p>
        <dl>
          {styles.map(([style, percentage]) => (
            <div key={style} className="founder-style-stat">
              <dt>{STYLE_LABELS[style]}</dt>
              <dd>{percentage}%</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="founder-recaps" aria-labelledby="recaps-title">
        <h2 id="recaps-title">Your five calls</h2>
        <div className="founder-recap-list">
          {run.history.map((historyItem, index) => (
            <DecisionRecap
              key={historyItem.decisionId}
              episode={episode}
              run={run}
              index={index}
            />
          ))}
        </div>
      </section>

      <div className="founder-actions">
        <Button onClick={onReplay}>Replay episode</Button>
        <Button variant="secondary" onClick={onOpenArchive}>
          Browse episodes
        </Button>
      </div>
    </section>
  )
}
