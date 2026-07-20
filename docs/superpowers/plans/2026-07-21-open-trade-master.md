# Open Trade Three-Game Rebuild Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute task groups with specification and quality review after each group. Use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before any completion claim.

**Goal:** Deliver one original, production-ready Open Trade arcade containing faithful, improved recreations of FanStocks, Founder Mode, and Wallstreet Surfers, backed by Higgsfield media, committed throughout to `frenzy2004/Open-Trade`, and verified on both Higgsfield and GitHub Pages.

**Architecture:** The foundation owns routing, shared UI, settings, persistence, deterministic RNG, strings, and the hub. Each game owns a pure deterministic engine and lazy route. React renders semantic game UI; only Wallstreet Surfers loads Phaser. The checked-in asset manifest owns every generated file. One tested Vite build feeds both deployments.

**Detailed plans:**

- `docs/superpowers/plans/2026-07-21-foundation-hub.md`
- `docs/superpowers/plans/2026-07-21-fanstocks.md`
- `docs/superpowers/plans/2026-07-21-founder-mode.md`
- `docs/superpowers/plans/2026-07-21-wallstreet-surfers.md`
- `docs/superpowers/plans/2026-07-21-higgsfield-assets-release.md`

## Frozen cross-plan contracts

- RNG: `src/shared/rng/seededRng.ts` exports `SeededRng` and `createSeededRng(number | string)`.
- Persistence: `src/shared/persistence/gameStore.ts` exports `GameSaveDecodeResult`, `GameStoreLoadResult`, `GameSaveCodec`, `GameStore`, and `createGameStore`.
- Challenge URLs: `src/shared/routing/challenge.ts` exports string seed plus numeric `rulesetVersion` parsing/formatting and string guest seeds.
- Settings: `useSettings()` returns `{ settings: { muted, reducedMotion }, updateSettings }`.
- Shared UI: `Button` variants are `primary | secondary | ghost | danger`; `Dialog` uses `open` plus `onClose`; `ProgressBar` is labeled; `useToasts()` exposes `addToast(message, tone?)`.
- Route modules use the single registry contract in `src/app/routes/types.ts`; games never import one another.
- Asset IDs and roles come only from `design/assets.csv`. Generated images never contain required labels, tickers, logos, or chart text.

### Task 1: Lock and publish the planning milestone

- [ ] Confirm the exact 73-word STYLE FORMULA matches byte-for-byte across the design spec, `design/plan.md`, `design/style-formula.txt`, and the Higgsfield release plan.
- [ ] Parse `design/assets.csv`; require 16 unique rows: 9 static images, 1 derived sheet, 5 SFX, and 1 music loop.
- [ ] Search all plans for stale contract names, forbidden placeholders, live-market scope, unsupported asset references, and `gh` dependencies.
- [ ] Run `git diff --check`, commit as `docs: add implementation and asset plans`, and push `main`.
- [ ] Create and push `agent/rebuild-three-games` for implementation.

### Task 2: Start all Higgsfield jobs before game code

Execute Tasks 1–5 of the Higgsfield assets/release plan through job submission and local acceptance tooling.

- [ ] Re-query every live model contract and cost immediately before submission.
- [ ] Submit all nine independent static image jobs and six independent audio jobs without changing the frozen formula or manifest.
- [ ] Save returned job IDs and raw outputs under the planned paths; never rely on terminal history as the job record.
- [ ] Start the runner animation only after the avatar source passes crop, key-color, perspective, and style inspection.
- [ ] Commit production scripts and accepted media in coherent milestones; push after each milestone.

### Task 3: Build and verify the foundation

Execute the foundation/hub plan in order.

- [ ] Bootstrap exact dependencies, strict checks, Vitest, Playwright, and relative/hash builds.
- [ ] Implement tokens, shared UI, RNG, challenge URLs, persistence, settings, strings, route registry, asset catalog, and the three-card hub.
- [ ] Register placeholder lazy route modules only long enough to make foundation tests compile; replace them in the game tasks.
- [ ] Run every foundation unit/component/E2E gate, commit each task boundary, and push.

### Task 4: Build FanStocks and Founder Mode independently

After Task 3, these plans have no shared mutable implementation surface beyond frozen foundation imports and may be delegated separately.

- [ ] Execute all 17 FanStocks tasks in order, preserving the three-round draft, four $50 portfolios, 60-tick week, one-for-one trades, and Friday-close ranking.
- [ ] Execute all 7 Founder Mode tasks in order, preserving four episodes, five decisions, three choices, Classic/Brainrot parity, valuation, style mix, recap, and streak.
- [ ] Run specification review and quality review after each completed plan.
- [ ] Rebase or merge task commits without rewriting the other game's history; push all passing milestones.

### Task 5: Build Wallstreet Surfers

Execute all 8 Wallstreet Surfers tasks after the foundation contracts are stable.

- [ ] Keep the pure 60 Hz engine authoritative; Phaser is a lazy renderer/adapter only.
- [ ] Prove 100 seeded schedules remain solvable through 5,000 m.
- [ ] Complete keyboard, touch, and gamepad tutorial paths plus pause/visibility behavior.
- [ ] Integrate static fallback first, then the accepted Higgsfield run sheet without altering collision geometry.
- [ ] Run runner unit, deterministic, asset, performance, responsive, and E2E gates; commit and push each boundary.

### Task 6: Integrate media and harden the full product

Execute Tasks 6–8 of the Higgsfield assets/release plan.

- [ ] Wire every manifest row through the typed asset/audio catalogs; require zero 404s and no placeholder boxes.
- [ ] Normalize/mix audio, unlock from a user gesture, pause on hidden tabs, and verify fully muted play.
- [ ] Add code-rendered image fallbacks, reduced motion, PWA/offline-after-first-load support, responsive styling, and budgets.
- [ ] Verify all three hub cards use generated route art while semantic labels remain HTML.
- [ ] Run `npm run lint`, `npm run typecheck`, all unit/component tests, all E2E projects, asset validation, release budgets, and both production builds.
- [ ] Commit `feat: integrate Higgsfield arcade media` and `test: harden Open Trade release`; push both.

### Task 7: Package, deploy, and smoke-test both targets

Execute Tasks 9–10 of the Higgsfield assets/release plan.

- [ ] Package the tested relative-base build so `index.html`, solo `logic.js`, and `assets/` are at the ZIP root with no wrapper or repository files.
- [ ] Deploy with `higgsfield game deploy`, save the returned `game_id`, and use `--game-id` for every retry/update. Do not publish to the marketplace.
- [ ] Open the returned Higgsfield URL in a fresh session; play each game through its critical path and confirm assets, audio controls, challenge links, restart, and saves.
- [ ] Merge the verified implementation branch to `main`, push, observe the Pages workflow to success, and open `https://frenzy2004.github.io/Open-Trade/` in a fresh session.
- [ ] Run the deployed Playwright smoke suite against both URLs and record exact command output plus URLs in the research/failure log.

### Task 8: Final evidence audit and handoff

- [ ] Run the full release command sequence from a clean checkout of the pushed `main` commit.
- [ ] Confirm local `HEAD`, `origin/main`, the deployed Pages build, and the saved Higgsfield deployment identity all refer to the intended release.
- [ ] Review the original screenshot set and reverse-engineering table against the shipped mechanics; record intentional improvements and any remaining perceptual limits.
- [ ] Report the GitHub commit/branch, GitHub Pages URL, Higgsfield playable URL, verification totals, screenshots, and the honest limitation that human delight and art feel still require human eyes/hands.
