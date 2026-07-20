# OpenTrade reverse-engineering and failure log

Date: 2026-07-21

## Verified behavior

### FanStocks

- Starting as a guest creates a unique league URL.
- Three draft rounds each offer three cards.
- A card detail sheet contains company/ticker, thesis, bullets, previous/next, Back, and Draft.
- Four portfolios begin at $50: the player, ChatGPT, Claude, and Gemini.
- Values move during a simulated/live market clock and rank in a portfolio race.
- Incoming one-for-one trades support Pass and Accept.
- Acceptance was verified: the player gave SBUX and received ODFL; both hands updated.
- Highest portfolio value at Friday close is the stated win condition.

### Founder Mode

- Landing includes Episode 4, a day streak, classic/brainrot writing style, Play episode, and Past episodes.
- Archive includes Netflix 2011, Kodak 1975, Apple 1997, and Blockbuster 2000.
- Each episode contains five decisions with three choices.
- Outcomes show whether the choice matched history, whether it worked, explanatory prose, and a new valuation.
- The tested Netflix route ended at $68.5B versus $25.0B reality and displayed a founder-style mix plus five result markers.
- Brainrot changes the prose while preserving the scenario.

### Wallstreet Surfers

- Three-lane endless runner with left/right, jump, roll, and touch swipes.
- HUD shows score, distance, coins, streak, Powell gap, sound, and best score.
- Obstacles include barriers and ticker trains with specific death messages.
- Market gates map LONG to Up and SHORT to Down and advertise a streak boost for correct picks.
- Game over provides Run again, challenge a friend, and Back to games.

## Failures and recoveries

### Full-page screenshot timeout

- Failure: a 5,650px animated homepage timed out during full-page capture.
- Evidence: viewport was 508x624 and page height was 5,650px.
- Recovery: viewport screenshots completed immediately.
- Rule: capture stable viewport sections on long/animated pages; separate navigation, loading, and capture.

### Founder Mode landing capture

- Failure: two landing screenshots timed out.
- Evidence: dimensions were normal, while browser logs contained React hydration error #418.
- Recovery: DOM inspection remained available; screenshots worked after entering the stable episode-intro state.
- Rule: inspect logs and capture stable post-transition states instead of blindly retrying hydration-heavy screens.

### FanStocks transition condition

- Failure: waiting for the shared `Pick one` heading to disappear timed out.
- Root cause: the heading remains across all three draft rounds.
- Recovery: use the round-specific progressbar or region label as the state signal.
- Rule: wait on a changing, state-specific signal rather than reused copy.

### Stale browser tab binding

- Failure: one FanStocks capture reported a closed target although the tab still appeared in the browser tab list.
- Recovery: reacquiring the same listed tab ID restored capture.
- Rule: distinguish a stale binding from a closed tab before creating duplicates.

### Real-time runner timing

- Failures: uncontrolled or poorly timed runs hit barriers at 75m/94m and later obstacles around 172m; a lane change after screenshot capture was too late to avoid a train at 124m.
- Success: timing Up near the positive GME decision gate survived beyond the first earlier failure point to 122m; keyboard inputs collected coins and advanced score/distance.
- Constraint: screenshots and browser round-trips consume real time, making frame-perfect post-capture reactions unreliable.
- Rule: use deterministic seeds, a developer overlay, pauseable inspection, and scheduled controls in the rebuild.

## Implementation lessons

- Keep every state transition explicit and independently testable.
- Use seeded randomness and URL seeds for reproducible bug reports.
- Add a runner debug overlay for current lane, obstacle, collision bounds, gate answer, and seed.
- Build readable labels and accessible equivalents for every color/gesture-only signal.
- Use original Higgsfield assets and original source code rather than copying public-site assets or bundles.

### Higgsfield CLI JSON contract and resumability

- Failure: initial media tooling assumed an object-shaped create response and generic download URL fields. The actual create response is a top-level one-item JSON array containing the job ID; completed jobs expose `status: "completed"`, `result_url`, and `min_result_url`.
- Evidence: completed static job `ba919da5-687d-46c6-962c-472511ffa018` (`fs-draft-room`) and audio job `27d8d267-62a9-4e03-a61f-d45ff5a0c095` (`ui-confirm`) were returned as one-item request arrays.
- Recovery: use the shared parser for both exact array and legacy object shapes, prefer the full `result_url` exclusively over `min_result_url`, and preserve attempt-specific request/completion files.
- Rule: before creating, waiting, or downloading any job, reuse an existing attempt-specific request, completion, and raw file when present. Submit only missing requests before the wait phase; never overwrite or re-submit a resumable attempt.
