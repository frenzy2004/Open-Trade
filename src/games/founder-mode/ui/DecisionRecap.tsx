import { useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import type { FounderEpisode } from '../content/types'
import type { FounderRunState } from '../engine/founderState'

interface DecisionRecapProps {
  readonly episode: FounderEpisode
  readonly run: FounderRunState
  readonly index: number
}

export function DecisionRecap({
  episode,
  run,
  index,
}: DecisionRecapProps) {
  const [open, setOpen] = useState(false)
  const historyItem = run.history[index]
  const decision = episode.decisions[index]
  const choice = decision?.choices.find(({ id }) => id === historyItem?.choiceId)
  if (!historyItem || !decision || !choice) {
    return <p className="founder-recap-unavailable">Decision {index + 1} unavailable</p>
  }

  const sources = decision.sourceIds.flatMap((sourceId) => {
    const source = episode.sources.find(({ id }) => id === sourceId)
    return source ? [source] : []
  })
  const title = `Decision ${index + 1} recap`

  return (
    <>
      <Button
        className="founder-recap-button"
        variant="secondary"
        aria-label={`Review decision ${index + 1}: ${choice.label}`}
        onClick={() => setOpen(true)}
      >
        <span>Decision {index + 1}</span>
        <strong>{choice.label}</strong>
        <small>${historyItem.valueAfterBn.toFixed(1)}B</small>
      </Button>
      <Dialog
        open={open}
        title={title}
        description={`${decision.year} board decision`}
        onClose={() => setOpen(false)}
      >
        <div className="founder-recap-dialog">
          <section aria-labelledby={`recap-dilemma-${index}`}>
            <h3 id={`recap-dilemma-${index}`}>The dilemma</h3>
            <p>{decision.prompt[run.style]}</p>
          </section>
          <dl>
            <div>
              <dt>Your choice</dt>
              <dd>{choice.label}</dd>
            </div>
            <div>
              <dt>Historical match</dt>
              <dd>{choice.matchedHistory ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Outcome</dt>
              <dd>{choice.worked ? 'Worked' : 'Did not work'}</dd>
            </div>
            <div>
              <dt>Company value</dt>
              <dd>
                ${historyItem.valueBeforeBn.toFixed(1)}B → $
                {historyItem.valueAfterBn.toFixed(1)}B
              </dd>
            </div>
          </dl>
          <section aria-labelledby={`recap-result-${index}`}>
            <h3 id={`recap-result-${index}`}>What happened</h3>
            <p>{choice.outcome[run.style]}</p>
          </section>
          <section aria-labelledby={`recap-sources-${index}`}>
            <h3 id={`recap-sources-${index}`}>Sources</h3>
            <ul>
              {sources.map((source) => (
                <li key={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                  <span> — {source.publisher}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Dialog>
    </>
  )
}
