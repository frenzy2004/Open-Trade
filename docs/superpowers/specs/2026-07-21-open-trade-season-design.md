# OpenTrade Season — canonical weekly ritual

Date: 2026-07-21

## Product decision

OpenTrade Season becomes the primary product experience. FanStocks, Founder Mode, and Wallstreet Surfers remain complete games, but the hub presents them as Market Lab practice modes underneath one connected weekly loop.

The hackathon build must let a judge complete an entire week in one sitting without pretending that a real multiplayer backend exists. League codes create deterministic, shareable local challenge rooms with bot standings; every rule and score remains inspectable and offline-safe.

## Complete loop

1. **Monday — Draft:** choose exactly three theses from an AI deck. Each call records LONG/SHORT direction, 50–95% confidence, one reason, and the evidence that would change the user's mind.
2. **Invite:** create a deterministic six-character league code or join one from a shared URL. The first commitment remains playable solo.
3. **Tuesday–Thursday — Updates:** reveal one short evidence packet per day. The original commitment is immutable. A user may keep the call or save a revision with a new direction, confidence, and response note.
4. **Friday — Settlement:** reveal the fixed outcome and a transparent 100-point decision-quality score for each call.
5. **Weekend — Receipt:** generate a ranked league result and specific identity insights, support native share/clipboard, and offer a one-tap Monday rematch.

## Scoring

| Dimension | Points | Purpose |
| --- | ---: | --- |
| Direction | 35 | Reward getting the outcome direction right. |
| Calibration | 25 | Reward confidence that matches correctness; punish confident misses. |
| Reasoning | 15 | Reward a specific, falsifiable original reason that the result supports. |
| Evidence response | 15 | Reward revising when evidence invalidates the thesis or holding when it does not. |
| Benchmark | 10 | Reward performance relative to the thesis's relevant benchmark. |

Returns alone cannot dominate the league. The receipt must explain every component and can state that a user was right about the result but wrong about the reason.

## UX and safety

- The root hub leads with Season and a Monday→Weekend timeline; games appear under **Market Lab**.
- `/season` owns the stateful flow and always exposes current week, phase, and progress.
- Required fields use native labels, fieldsets, and inline errors; all controls remain at least 44 px.
- Original and current calls appear together after a revision.
- The loop is deterministic, versioned, locally persisted, recoverable, and fully playable offline.
- Every screen repeats that the experience is simulated and not investment advice.
- Shared links contain only a league code/seed, never free-text reasons.

## Visual direction

The existing cream paper, charcoal ink, editorial serif, market yellow, gain green, and signal red system remains canonical. A new Higgsfield-generated overhead weekly strategy desk anchors Season without readable generated text, brands, logos, or real people.

