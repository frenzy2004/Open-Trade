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

### Touch Runner test missed the third deterministic coin under load

- Failure: the combined Chromium desktop/touch run passed 49 of 50 checks, but the touch route remained on two coins after changing from the right lane to the center lane.
- Evidence: the retained screenshot showed the run had already reached the 307 m market gate. The seeded schedule places the prior right-lane coin at 211 m and the center coin at 243 m.
- Cause: the test waited until at least 225 m before beginning a real CDP touch gesture. Bounding-box reads, scrolling checks, CDP setup, five touch events, and the intentional 100 ms gesture settle left only an 18 m window and could finish after the coin on a loaded browser.
- Recovery: change lanes immediately after the 211 m coin is observed, retaining the same gameplay assertion with a realistic 32 m response window. The isolated real-touch scenario then passed in 67.1 seconds.

### Hub progress cards stayed stale after game saves

- Failure: FanStocks and Wallstreet Surfers persisted their own saves, but returning to the hub still showed `No active league` and a best score of `0`.
- Cause: both routes wrote only their game-specific stores; the hub intentionally reads a separate compact progress store.
- Recovery: added pure progress-badge projections and synchronized the hub store only after each canonical game save succeeds. FanStocks suppresses duplicate badge writes while retrying a failed hub write; Runner distinguishes a game-save failure from a hub-card failure.
- Regression proof: focused controller/route tests first reproduced both stale badges, then passed after the fix. A live Vercel playthrough returned from a Tuesday FanStocks market and a 130-point Runner game to hub badges of `Tuesday market` and `130`.

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

### Production E2E lazy-route replacement race

- Failure: GitHub Actions run 29795756164 passed install and `npm run check`, then the production 44px audit failed after clicking Play FanStocks. Desktop failed every retry and touch was flaky.
- Evidence: CI collected controls from the outgoing hub and measured them at 0 by 0 while React replaced the hub with the lazy FanStocks route. The unchanged focused test passed locally under `CI=1`, confirming a scheduling-sensitive boundary rather than a target-size regression.
- Recovery: after every route action, wait for both the destination hash URL and its unique visible level-one heading before reading layout; after returning, wait for the hub URL and heading before using hub controls. Wait for dialogs to become visible before auditing them and hidden before continuing.
- Rule: an action promise confirms input delivery, not application readiness. Gate production geometry and follow-up interactions on observable destination state; never add sleep time or weaken the layout assertion to hide a transition race.

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

### Windows PowerShell multiline CLI output

- Failure: Windows PowerShell 5 surfaces multi-line Higgsfield stdout as `System.Object[]`, one line per element. The previous strongly typed `[string]` parser parameters failed during binding before JSON parsing.
- Evidence: resumed `fm-boardroom` and `market-success` create responses were multi-line job-ID arrays and were safely written as request artifacts.
- Recovery: accept either a scalar JSON string or an output-line array, joining array lines with deterministic newlines before `ConvertFrom-Json`.
- Rule: every job-ID and result-URL parser entrypoint accepts both transport forms; on-disk `Get-Content -Raw` remains the scalar form.

### Partial-alpha magenta key spill

- Failure: Alpha QA found a thin visible magenta fringe around each of the six background-removed static assets.
- Evidence: the fringe pixels were partial-alpha and matched `r > 120`, `b > 100`, and `min(r, b) - g > 50`; opaque magenta artwork and nonmagenta translucent pixels did not match the defect.
- Recovery: `process-images.py` clears matching pixels to transparent black before LANCZOS scaling and again on the final canvas, preventing resampling from retaining or reintroducing the fringe without changing raw originals.
- Rule: shipped transparent PNG validation rejects any remaining partial-alpha pixel that matches the key-spill signature.

### Final audio normalization and container sniffing

- Failure: final QA measured silent/near-silent SFX, shortened padded clips, and encoded true peaks above the -3 dBFS release gate. Sonilo downloads can carry AAC/M4A data under a `.wav` filename, while Seed Audio downloads are stereo RIFF.
- Evidence: `coin-pickup` measured -104.8 dBFS true peak; `ui-confirm` and `coin-pickup` integrated near -70 LUFS; `market-failure`, `market-success`, and `collision` reached -0.4/-0.4/-0.0 dBFS; `atrim` alone ended `ui-confirm` and failure clips early.
- Recovery: let ffmpeg probe the actual input bytes, trim then `apad` to the plan duration, normalize to the plan target, and use a conservative final limiter. Validate the encoded Ogg with ffprobe plus ffmpeg `volumedetect` and EBU R128 output for format, duration, non-silence, true peak, and integrated loudness.
- Rule: do not reject integrated LUFS for clips shorter than 400 ms; it is not stable over EBU R128's analysis window. For longer high-crest transients, retain non-silence and true-peak gates rather than force -11 LUFS when that would exceed the -3 dBFS cap; production SFX remain 500 ms or longer and are normalized toward the target within that headroom.

### FanStocks cross-boundary portfolio validation

- Failure: the first trade implementation validated only the player and active opponent. Unknown cards on an uninvolved AI roster, incomplete registries, and later same-ticker records with altered scoring fields could still reach AI offer/decision code.
- Recovery: one shared canonical portfolio predicate now requires the four exact participants to partition the 12 canonical tickers exactly once. Both incoming and outgoing trade paths also require complete card records that structurally match every canonical field and ordered evidence tuple while allowing honest deep clones.
- Follow-on failure: Friday ranking initially repeated a weaker local-only check, so cross-player duplicates and invented finite-priced tickers could produce authoritative results.
- Recovery: trades and ranking now consume the same shared predicate; hostile duplicate and substitution probes fail at both boundaries.
- Rule: a domain invariant belongs in one shared boundary. Validating only the objects a calculation happens to touch creates impossible global states that later look legitimate.

### Reducer seed and routing contract mismatch

- Failure: the written reducer plan used colon-delimited rematch seeds such as `base:rematch:1`, but the established challenge URL contract accepts only 1-64 ASCII letters, digits, `_`, and `-`. Padded input seeds were also stored unchanged even though the planned save decoder rejects non-trimmed seeds.
- Evidence: `formatChallenge` rejected every colon-delimited rematch with `Challenge descriptor is invalid`; malformed `MOVE_DETAIL` directions also slipped through the typed boundary at runtime.
- Recovery: initial/new-league seeds are challenge-safe by construction, rematches derive a compact deterministic `rematch-<index>-<hash>` seed, invalid directions and nullish actions preserve exact reducer identity, and repeated rematches remain URL-format compatible.
- Rule: test typed reducers with runtime-hostile payloads and test generated identifiers against every downstream formatter/codec before treating a local state transition as valid.

### Remote CI milestone proof

- GitHub Actions run `29797533803` verified the lazy-route readiness repair.
- Run `29799333019` verified the FanStocks market-engine milestone at `67694ae`.
- Run `29801969052` verified the reviewed trade milestone at `3d77949`.
- Run `29803179165` verified the shared ranking/portfolio-validation milestone at `28d1409`.
- Run `29804742652` verified the deterministic reducer milestone at `e1532d6`.
- Run `29807415385` verified the reviewed FanStocks save milestone.
- Run `29810723247` verified controller reinitialization and timer recovery.
- Run `29815076232` verified the hardened FanStocks draft topology.

### Browser-test argument forwarding

- Failure: passing focused browser files through the ordinary npm separator selected no files because npm and Vitest parsed the arguments at different layers.
- Recovery: use `npm exec -- vitest ...` for direct focused Vitest calls, or `npm run test:browser -- <files>` when invoking the project script.
- Rule: confirm the runner reports the intended file and test count; a fast command with zero selected tests is not verification.

### Vercel CLI discovery

- Failure: `npx --yes vercel@latest whoami` waited for more than a minute and returned no useful output.
- Recovery: install the pinned Vercel CLI directly, then `vercel whoami` returned authenticated account `moonlantern24-1017` and project listing worked.
- Rule: when a one-shot package runner is silent, verify the direct CLI path before treating authentication or network access as blocked.

### Service-worker partial audio responses

- Failure risk: CacheStorage rejects HTTP 206 responses. Caching every successful audio response would turn a valid range request into a rejected fetch promise and break playback.
- Recovery: return partial responses live and cache only complete status-200 media responses; full cached audio can satisfy later offline requests.
- Rule: `response.ok` is too broad for CacheStorage because it includes 206. Gate cache writes on a complete response status.

### FanStocks vertical-slice integration drift

- Failure: GitHub Actions run `29818212834` reached the full-suite boundary and found that the new FanStocks reset cleared its game save but no longer reported a failed hub-progress reset.
- Recovery: route reset now clears the validated FanStocks store first, then resets derived hub progress and throws a stage-specific error when that second write fails.
- Follow-on failure: run `29818381614` then exposed shell/browser tests that still expected the placeholder `FanStocks` heading, the removed placeholder challenge copy/back link, and legacy save key `open-trade:game:fanstocks`.
- Recovery: integration tests now wait for the real `Fantasy Stock Leagues` heading, navigate through the persistent OpenTrade brand link, and use the codec key `opentrade.fanstocks`; the complete local browser suite passed 19/19.
- Rule: replacing a placeholder route changes cross-boundary UI and storage contracts. Search the whole repository for old headings, links, and keys, and run the complete shared browser suite—not only the game-focused tests—before pushing.

### Local CLI availability

- Failure: the GitHub CLI executable was not available on the current PowerShell `PATH`, even though authenticated `git push` worked.
- Recovery: public GitHub Actions pages supplied run status and annotations without exposing credentials.
- Rule: distinguish missing local tooling from missing repository authority; use a read-only public/API surface for diagnostics and keep credential material out of command output.

### Production media URL transform gap

- Failure: the typed asset catalog passed unit tests while production emitted none of the 16 Higgsfield image/audio files. `new URL(relativeUrl, import.meta.url)` was hidden behind a helper parameter, so Vite could not statically transform the variable URL; the preview server returned its HTML fallback for those media paths and `SafeImage` quietly rendered fallback art.
- Recovery: every catalog item now uses an explicit `?url` import. A production build emits all ten visual files and six Ogg files with content hashes, while the catalog remains the single typed lookup surface.
- Rule: a source-local URL is not proof of a bundled asset. Verify the production `dist` inventory and request MIME/status; helper-indirected `new URL` expressions are not statically analyzable by Vite.

### Offline-after-first-load race

- Failure: the first offline E2E failed on the Wallstreet Surfers cover even after every route had been visited online. The image had loaded before the newly installed worker controlled the page, so it existed only in the browser HTTP cache and not the app cache.
- Recovery: every build now injects its emitted runtime asset list and a content-derived cache version into `sw.js`. Install precaches the application chunks, styles, ten visuals, six audio files, manifest, icons, and shell before claiming clients. Desktop and touch offline route replays then passed with zero console errors or 404s.
- Rule: runtime caching alone cannot guarantee offline support on the first controlled reload. Precache the exact emitted graph at build time and version it from content.

### Combined verification timeout under parallel reviews

- Failure: one chained Founder verification exceeded a three-minute shell cap while two independent reviewers and another game worker were simultaneously running Vitest/Playwright. Process inspection showed the remaining workers belonged to those active worktrees rather than the terminated root command.
- Recovery: leave agent-owned processes intact, use unique `PLAYWRIGHT_PORT` values, and run root gates separately after parallel reviews finish.
- Rule: a harness timeout during CPU-saturated parallel verification is neither a product pass nor failure. Attribute processes by command line, then rerun bounded gates in isolation.

### Independent-review gaps behind green suites

- FanStocks review found clipped live holdings at 320/768 that intro-only responsive tests missed, dialog completion paths that returned focus to `body`, absent Firefox/WebKit smoke projects, mismatched artwork selectors, and an undefined `sr-only` class.
- Founder review exhaustively enumerated all 243 paths per episode and found Blockbuster locked to Legend while Apple was effectively locked to Cautionary. It also found missing signed valuation deltas/numeric chart labels, absent ruleset compatibility in saves, a 42px source-link target, and missing 768/1440/200% coverage.
- Rule: green mechanics tests do not replace exhaustive outcome-distribution analysis or screenshots of deep gameplay states. Independent review must probe the real late-state UI at every frozen breakpoint and enumerate small deterministic state spaces completely.

### Additional remote CI proof

- Run `29818777482` verified the repaired FanStocks/shared-shell integration.
- Run `29819398138` verified complete FanStocks league and responsive coverage plus release-budget tooling.
- Run `29820272913` verified integrated Founder Mode, emitted/offline-cached Higgsfield media, and the root-safe Vercel build configuration at `9880b9c`.

### Fresh-document offline verification

- Failure: the first offline test warmed every game route online and then changed only the hash. That proved client routing, but a missing document shell or route chunk could still pass from the already-open page.
- Recovery: install the worker from the hub only, reload once to establish control, remove the network, then perform a distinct document navigation with a unique query for every never-visited hash route. The service worker now also synthesizes exact 206 byte ranges from cached audio.
- Follow-on failure: Vite's preview response varied on `Origin`, so exact CacheStorage matching missed otherwise valid module responses offline.
- Recovery: asset lookup uses `ignoreVary` while remaining same-origin and content-addressed; the test asserts cached route CSS, JavaScript, manifest, and an exact 100-byte Ogg range.
- Rule: an offline hash transition is not an offline page load. Change the document URL and assert the emitted runtime graph, response status, byte range, and absence of request failures.

### Parallel-branch asset-catalog integration

- Failure: cherry-picking the Runner media commit over the shared catalog produced two identical blocks of static asset imports. TypeScript correctly rejected the duplicate bindings even though Git reported an automatic merge.
- Recovery: remove only the duplicate block, retain the 16 explicit `?url` imports, and rerun type checking plus emitted-asset validation before continuing the remaining cherry-picks.
- Rule: a conflict-free cherry-pick is not necessarily a semantic merge. Run the cheapest compiler boundary after every cross-cutting catalog or manifest integration.

### Wallstreet Surfers independent review

- Failure: the renderer cached sprites and roll labels by event ID but never reconciled IDs that disappeared from authoritative state. Collected/pruned objects could remain visible, and a restart could preserve stale render artifacts.
- Recovery: reconcile renderer maps on every snapshot and destroy absent objects; regression tests cover pruning and restart. The follow-up also tightened stage-owned touch gestures, modal/gamepad input guards, five-metric mobile HUD visibility, three-second gate feedback, and deterministic death/restart/coin/gate E2E.
- Evidence: the independent reviewer approved the final delta with 163 focused tests and both real desktop/touch scenarios passing.
- Rule: a retained-mode renderer must remove objects as deliberately as it creates them; simulation correctness alone cannot prevent stale visuals.

### Deployment-matrix and CSP audit

- Failure: the portable relative build was originally served at `/`, where both root-absolute and relative asset URLs work. The test therefore could not prove portability. CI also omitted the matrix, and the offline test collected request failures without asserting them.
- Recovery: serve the portable build at `/portable/Open-Trade/`, explicitly fail on every unexpected request error, and enforce Pages, Vercel-root, and nested-portable smoke runs in CI. Pages verification and privileged deployment now use separate jobs.
- Follow-on failure: the first nested run revealed that the restrictive CSP blocked Phaser's same-origin texture decoder because it creates `blob:` image URLs. The route stayed playable via fallback primitives, hiding the missing Higgsfield textures.
- Recovery: allow `blob:` only in `img-src` in both the HTML and Vercel policies. Keep scripts, workers, frames, objects, and network connections restricted. The full three-shape deployment matrix then passed with every game route freshly loaded offline.
- Rule: security policy checks need a production runtime exercise. A fallback UI can conceal blocked media, so assert console errors, 404 responses, and all non-intentional request failures.

### Clean-runner dependency and concurrency proof

- Failure: GitHub Actions run `29826438647` selected a clean Python 3.13 runtime but installed only Node packages and FFmpeg. The image validator failed immediately with `ModuleNotFoundError: No module named 'PIL'`, so later E2E and deployment-matrix steps were correctly skipped.
- Recovery: both CI and Pages verification install the pinned `requirements-assets.txt` after selecting Python; a release contract test requires that step in both workflows.
- Follow-on failure: in the 54-case local E2E run, the touch offline scenario exceeded Playwright's generic 30-second limit while the CPU-heavy deterministic Runner case executed concurrently. The same desktop/touch offline pair passed together in 14.4 seconds when isolated.
- Recovery: give the comprehensive offline scenario a 90-second test-specific ceiling while keeping all ordinary tests at 30 seconds. Do not weaken its assertions or retries.
- Rule: test dependencies must be recreated on a clean runner, and a timeout should reflect the verified worst concurrent workload. Raising a bound is acceptable only after the exact scenario passes in isolation and the product assertions remain unchanged.

### Vercel clean-build parity

- Failure: the first Vercel production attempt created the isolated `open-trade` project but stopped during `npm run build:vercel`; its framework install phase ran `npm install` only, so the Python image gate again had no Pillow. The failed deployment was never promoted.
- Recovery: `vercel.json` now installs npm packages and the same pinned Python requirements before the build. A `.vercelignore` excludes local generation frames, raw media, reports, and prior build output so deployment uploads contain only reproducible source inputs.
- Follow-on failure: Vercel's Python is PEP 668 externally managed by `uv`, so ordinary `python -m pip install` was correctly refused even though the command works in GitHub's setup-python environment.
- Recovery: the Vercel-specific install command uses its provided `uv pip install --system` interface while retaining the exact same pinned requirements file.
- Follow-on failure: `--system` then revealed that the Node builder exposes Python 3.9.25, which cannot resolve current Pillow 12.3.0 or NumPy 2.5.1.
- Recovery: `uv` creates an isolated managed Python 3.13 environment, installs the unchanged pins into it, and the Vercel build prepends only that environment's `bin` directory to `PATH` before running the ordinary asset/build/budget commands.
- Rule: CI setup does not configure a hosting provider's independent builder. Every clean deployment environment needs an explicit dependency contract, and a failed build must never be treated as a usable URL.

### Manual pointer-target audit after deployment

- Failure: on the live 1265×720 browser viewport, the decorative `OT` deck overlapped Momentum's trade button. Balanced remained clickable, so the existing full-league E2E passed; the desktop extremes at 1024 and 1440 also missed this intermediate geometry.
- Recovery: add a 1265×720 regression that proves the deck rectangle intersects none of the three trade controls and that a center click opens each opponent's outgoing ticket. Move the decorative deck into the table's empty lower-center space and make it non-interactive by definition.
- Rule: responsive extremes do not cover every absolute-position geometry transition. Manual deployed playthroughs should click every repeated control, and collision tests should include the viewport that exposed the issue.

### OpenTrade Season integration and independent review

- Failure: the first Season E2E reused the already-running port-4173 preview, whose bundle predated the `/season` route, and correctly reported `Market not found` for both the route and new hub copy.
- Recovery: run the new acceptance flow on an isolated `PLAYWRIGHT_PORT`, force a fresh production build, and keep the existing user preview alive until the final verified bundle is ready to replace it.
- Follow-on failure: the Tuesday revision editor read `event.currentTarget.value` inside a deferred React functional state updater. React had already cleared `currentTarget`, so the route boundary caught `Cannot read properties of null (reading 'value')`.
- Recovery: capture every DOM value synchronously before entering the state updater. The desktop and touch acceptance now perform a real revision and assert zero page or console errors through receipt and rematch.
- Independent review found that hostile proxy/accessor save inputs could throw, hidden/symbol fields and exotic arrays were not fully rejected, league codes collapsed to at most 32 sequences, and all fixtures coupled direction with benchmark points.
- Recovery: the save decoder is now total and descriptor-exact, reconstructs engine reference invariants, and rejects accessors, symbols, hidden keys, sparse/decorated arrays, forged settlement, and future rules. League generation produces 120 unique codes across all ordered three-of-six week-one drafts. META now supplies a realistic positive absolute return that trails QQQ, proving benchmark points are independent from direction points. Rematch also guards the largest persistable week index.
- Rule: a transparent score needs fixtures that independently exercise every component, and a share code needs measured entropy—not only a six-character appearance. Persistence review must include hostile JavaScript objects even when normal JSON storage cannot create them.
