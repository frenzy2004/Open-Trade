import { COLLISION_HALF_WINDOW_M } from '../engine/collisions'
import type { RunnerState } from '../engine/types'
import type { RunnerDiagnostics } from '../phaser/createRunnerGame'

export interface RunnerDebugOverlayProps {
  readonly state: RunnerState
  readonly enabled: boolean
  readonly diagnostics: RunnerDiagnostics | null
}

function findNextEntity(state: RunnerState): string {
  let nextId = 'none'
  let nextDistance = Number.POSITIVE_INFINITY
  for (const entity of state.entities) {
    if (!entity.resolved && entity.distanceM >= state.distanceM && entity.distanceM < nextDistance) {
      nextId = `${entity.kind}:${entity.id}@${entity.distanceM.toFixed(1)}m`
      nextDistance = entity.distanceM
    }
  }
  return nextId
}

export function RunnerDebugOverlay({
  state,
  enabled,
  diagnostics,
}: RunnerDebugOverlayProps) {
  if (!enabled) return null
  const answer = state.currentGate !== null
    ? 'pending'
    : state.lastGateFeedback?.answer ?? 'none'
  return (
    <aside className="runner-debug" aria-label="Runner debug overlay">
      <dl>
        <div><dt>Seed</dt><dd data-runner-debug="seed">{state.seed}</dd></div>
        <div><dt>Time</dt><dd>{state.elapsedMs.toFixed(1)} ms</dd></div>
        <div><dt>Distance</dt><dd data-runner-debug="distance">{state.distanceM.toFixed(2)} m</dd></div>
        <div><dt>Speed</dt><dd>{state.speedMps.toFixed(2)} m/s</dd></div>
        <div><dt>Lane</dt><dd>{state.lane}</dd></div>
        <div><dt>Vertical</dt><dd>{state.vertical}</dd></div>
        <div><dt>Next entity</dt><dd data-runner-debug="next-entity">{findNextEntity(state)}</dd></div>
        <div>
          <dt>Collision bounds</dt>
          <dd>±{COLLISION_HALF_WINDOW_M.toFixed(2)} m</dd>
        </div>
        <div><dt>Current answer</dt><dd>{answer}</dd></div>
        <div><dt>Powell gap</dt><dd>{state.powellGap.toFixed(2)}</dd></div>
        <div><dt>Dropped frame time</dt><dd>{diagnostics?.droppedFrameMs.toFixed(2) ?? '0.00'} ms</dd></div>
        <div><dt>Pending commands</dt><dd>{diagnostics?.pendingCommands ?? 0}</dd></div>
      </dl>
    </aside>
  )
}
