# Wallstreet Surfers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deterministic, responsive three-lane market runner with keyboard/touch/gamepad controls, obstacles, ticker trains, market-direction gates, coins, streaks, Powell pressure, replay, challenge seeds, and reproducible debug tooling.

**Architecture:** Pure TypeScript owns fixed-timestep state, seeded spawn schedules, collision, scoring, and market gates. A lazy Phaser adapter renders that state and maps input/audio without becoming the source of truth. React renders semantic HUD, tutorial, pause, game-over, share, and accessibility surfaces above the canvas.

**Tech Stack:** TypeScript strict mode, Phaser pinned to an exact patch, React, Vitest, Playwright, local generated sprite/audio assets.

## Global Constraints

- Use a fixed timestep, seeded RNG, and a fixed logical viewport with Phaser FIT scaling.
- Use `event.code` for keyboard controls and support keyboard, touch-only play, and declared gamepad input.
- The exact controls are Left/Right lanes, Up jump/LONG, Down roll/SHORT.
- A correct market gate increases streak and pushes Powell back; an incorrect answer resets streak and reduces the gap.
- Never generate an unsolvable obstacle sequence; every spawn window has at least one valid response path.
- Pause on hidden tabs and resume without advancing simulation time.
- Reduced-motion mode lowers shake, flashes, and parallax but does not change mechanics.
- Production has no network or CDN dependency.

---

### Task 1: Define runner state, commands, and fixed-timestep progression

**Files:**
- Create: `src/games/wallstreet-surfers/engine/types.ts`
- Create: `src/games/wallstreet-surfers/engine/createRunnerState.ts`
- Create: `src/games/wallstreet-surfers/engine/stepRunner.ts`
- Test: `src/games/wallstreet-surfers/engine/stepRunner.test.ts`

**Interfaces:**
- Consumes: foundation `createSeededRng(seed)` and `SeededRng` contracts.
- Produces: `RunnerState`, `RunnerCommand`, `RunnerConfig`, `createRunnerState`, and `stepRunner(state, commands, fixedDeltaMs)`.

- [ ] **Step 1: Write fixed-timestep tests**

```ts
const a = createRunnerState({ seed: 'demo', reducedMotion: false });
const b = createRunnerState({ seed: 'demo', reducedMotion: false });
for (let i = 0; i < 600; i += 1) {
  stepRunner(a, [], 1000 / 60);
  stepRunner(b, [], 1000 / 60);
}
expect(a).toEqual(b);
expect(a.distanceM).toBeGreaterThan(0);
expect(a.elapsedMs).toBeCloseTo(10_000, 5);
```

Add tests that a non-running/paused state does not advance, large frame gaps are clamped by the adapter rather than the engine, and restart recreates the initial seeded state while preserving `bestScore`.

- [ ] **Step 2: Verify the red state**

Run: `npm test -- src/games/wallstreet-surfers/engine/stepRunner.test.ts`
Expected: FAIL because engine modules do not exist.

- [ ] **Step 3: Implement base state and progression**

```ts
export type Lane = -1 | 0 | 1;
export type RunnerPhase = 'tutorial' | 'running' | 'paused' | 'gameOver';
export type RunnerCommand = 'MOVE_LEFT' | 'MOVE_RIGHT' | 'JUMP' | 'ROLL' | 'PAUSE' | 'RESTART';
export interface RunnerState {
  seed: string; phase: RunnerPhase; elapsedMs: number; distanceM: number; speedMps: number;
  lane: Lane; vertical: 'grounded' | 'jumping' | 'rolling'; verticalUntilMs: number;
  score: number; bestScore: number; coins: number; streak: number; powellGap: number;
  entities: RunnerEntity[]; nextSpawnIndex: number; lastFailure: RunnerFailure | null;
}
```

Start speed at `8.5 m/s`, increase by `0.12 m/s` every 100m up to `22 m/s`, and keep `powellGap` in `[0, 100]`.

- [ ] **Step 4: Verify engine tests**

Run: `npm test -- src/games/wallstreet-surfers/engine && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit base engine**

```bash
git add src/games/wallstreet-surfers/engine
git commit -m "feat: add deterministic runner core"
```

### Task 2: Implement movement, jump/roll windows, and typed collisions

**Files:**
- Create: `src/games/wallstreet-surfers/engine/applyCommands.ts`
- Create: `src/games/wallstreet-surfers/engine/collisions.ts`
- Test: `src/games/wallstreet-surfers/engine/collisions.test.ts`

**Interfaces:**
- Consumes: runner state/types.
- Produces: `applyCommands`, `detectCollision`, `RunnerObstacle`, and actionable `RunnerFailure` messages.

- [ ] **Step 1: Write collision behavior tests**

Test: lane clamps at -1/1; jump lasts 650ms; roll lasts 500ms; ground barrier is avoided by jump or another lane; overhead sign is avoided by roll; ticker train requires another lane; coin increments count without ending the run; repeated jump/roll commands while active do not extend the window.

- [ ] **Step 2: Run the collision test and verify failure**

Run: `npm test -- src/games/wallstreet-surfers/engine/collisions.test.ts`
Expected: FAIL because collision functions are absent.

- [ ] **Step 3: Implement obstacle contracts and failures**

```ts
export type ObstacleKind = 'barrier' | 'overhead' | 'train' | 'coin';
export interface RunnerObstacle extends RunnerEntity { kind: ObstacleKind; lane: Lane; ticker?: string }
export interface RunnerFailure { kind: Exclude<ObstacleKind, 'coin'> | 'powell'; message: string; tip: string; ticker?: string }
```

Messages are deterministic: barrier `You ate the barrier`; overhead `The sign clipped you`; train `${ticker} train flattened you`; Powell `Powell closed the gap`. Tips name the valid action.

- [ ] **Step 4: Run movement/collision tests**

Run: `npm test -- src/games/wallstreet-surfers/engine && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit movement and collisions**

```bash
git add src/games/wallstreet-surfers/engine
git commit -m "feat: add runner movement and collisions"
```

### Task 3: Build solvable seeded spawn schedules and market gates

**Files:**
- Create: `src/games/wallstreet-surfers/content/marketGates.ts`
- Create: `src/games/wallstreet-surfers/engine/buildSpawnSchedule.ts`
- Create: `src/games/wallstreet-surfers/engine/resolveMarketGate.ts`
- Test: `src/games/wallstreet-surfers/engine/spawnSchedule.test.ts`

**Interfaces:**
- Consumes: seeded RNG and runner types.
- Produces: `MarketGate`, `SpawnEvent`, `buildSpawnSchedule(seed, lengthM)`, `assertSolvableSchedule`, and `resolveMarketGate`.

- [ ] **Step 1: Write schedule and gate tests**

Generate 100 seeds to 5,000m and assert every hazard window has a safe lane/action, consecutive trains never block all lanes, prompts appear at least 45m before their response line, identical seeds produce identical schedules, and different seeds differ. Test correct answers: `streak += 1`, `score += 100 * streak`, `powellGap += 8`; incorrect: `streak = 1`, `powellGap -= 12`.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- src/games/wallstreet-surfers/engine/spawnSchedule.test.ts`
Expected: FAIL because schedule/gate functions are missing.

- [ ] **Step 3: Author a complete gate bank and schedule builder**

```ts
export interface MarketGate {
  id: string; setup: string; ticker: string; answer: 'long' | 'short'; explanation: string;
  difficulty: 1 | 2 | 3;
}
```

Ship at least 18 authored, unambiguous, fictional/synthetic scenarios spanning earnings beat/miss, guidance raise/cut, dilution, buyback, rate shock, regulatory approval/rejection, commodity input rise/fall, and demand acceleration/slowdown. Keep interface text code-rendered. `buildSpawnSchedule` must reserve a response window with no physical hazard overlap.

- [ ] **Step 4: Run schedule stress tests**

Run: `npm test -- src/games/wallstreet-surfers/engine/spawnSchedule.test.ts --run`
Expected: PASS for all 100 seeds and 5,000m schedules.

- [ ] **Step 5: Commit gates and schedule**

```bash
git add src/games/wallstreet-surfers/content src/games/wallstreet-surfers/engine
git commit -m "feat: add solvable market runner schedules"
```

### Task 4: Add the lazy Phaser renderer and lifecycle-safe route

**Files:**
- Create: `src/games/wallstreet-surfers/WallstreetSurfersRoute.tsx`
- Modify: `src/games/wallstreet-surfers/route.tsx`
- Create: `src/games/wallstreet-surfers/persistence/runnerSave.ts`
- Create: `src/games/wallstreet-surfers/phaser/createRunnerGame.ts`
- Create: `src/games/wallstreet-surfers/phaser/RunnerScene.ts`
- Create: `src/games/wallstreet-surfers/phaser/RunnerRenderer.ts`
- Test: `src/games/wallstreet-surfers/phaser/createRunnerGame.test.tsx`
- Test: `src/games/wallstreet-surfers/persistence/runnerSave.test.ts`

**Interfaces:**
- Consumes: foundation `GameRouteModule`, `GameSaveCodec`, `createGameStore`, `WALLSTREET_SURFERS_METADATA`, shared `parseChallenge`, engine state/step, and settings.
- Produces: lazy route, versioned best-score persistence, the named foundation-compatible `gameRoute` export, and `createRunnerGame(parent, options): { destroy(): void; dispatch(command): void; snapshot(): RunnerState }`.

- [ ] **Step 1: Write lifecycle tests with a mocked Phaser factory**

Assert mount creates exactly one game instance, rerender does not duplicate it, unmount calls `destroy(true)`, visibility change pauses/resumes without advancing elapsed time, and route remount restores the saved seed/best score. Add store tests for empty, valid, corrupt, and incompatible saves plus the `{ label, value, tone }` best-score badge.

- [ ] **Step 2: Verify the lifecycle test fails**

Run: `npm test -- src/games/wallstreet-surfers/phaser/createRunnerGame.test.tsx`
Expected: FAIL because the adapter is absent.

- [ ] **Step 3: Implement the fixed-loop adapter**

Phaser owns sprites/camera only. The adapter accumulates real delta, caps one frame at 250ms, advances the pure engine in `1000 / 60` steps, and interpolates render positions. Configure a `1280x720` logical world, `Phaser.Scale.FIT`, centered auto-round scaling, transparent DOM HUD overlay, and DPR cap from the shared settings. Implement `runnerSaveCodec` through `createGameStore`, then replace the temporary foundation `route.tsx` entry with `gameRoute` using the shared metadata, entry, save key, reset/progress helpers, and challenge parser.

- [ ] **Step 4: Verify lifecycle and production build**

Run: `npm test -- src/games/wallstreet-surfers/phaser src/games/wallstreet-surfers/persistence && npm run build`
Expected: PASS; Phaser appears only in the lazy runner chunk.

- [ ] **Step 5: Commit renderer integration**

```bash
git add src/games/wallstreet-surfers
git commit -m "feat: render runner with lazy Phaser scene"
```

### Task 5: Implement keyboard, touch, gamepad, and interactive tutorial

**Files:**
- Create: `src/games/wallstreet-surfers/input/RunnerInput.ts`
- Create: `src/games/wallstreet-surfers/input/swipe.ts`
- Create: `src/games/wallstreet-surfers/ui/RunnerTutorial.tsx`
- Create: `src/games/wallstreet-surfers/ui/TouchControls.tsx`
- Test: `src/games/wallstreet-surfers/input/RunnerInput.test.ts`
- Test: `src/games/wallstreet-surfers/ui/RunnerTutorial.test.tsx`

**Interfaces:**
- Consumes: dispatch callback and shared reduced-motion/settings state.
- Produces: `RunnerInput.attach(target)`, `detach()`, `pollGamepad()`, and accessible touch buttons.

- [ ] **Step 1: Write input mapping tests**

Test `event.code`: ArrowLeft/KeyA, ArrowRight/KeyD, ArrowUp/KeyW/Space, ArrowDown/KeyS, Escape/KeyP. Test a 40px swipe threshold with dominant-axis detection. Test standard gamepad D-pad/left stick, A jump, B roll, Start pause. Prevent default only while the runner route is active.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- src/games/wallstreet-surfers/input`
Expected: FAIL because input modules are missing.

- [ ] **Step 3: Implement input and tutorial state machine**

The tutorial pauses world progression and requires, in order: lane change, jump, roll, then a sample LONG/SHORT gate. Each step accepts keyboard, touch, or gamepad and stores `tutorialComplete: true` only after all four.

- [ ] **Step 4: Run input/tutorial tests**

Run: `npm test -- src/games/wallstreet-surfers/input src/games/wallstreet-surfers/ui/RunnerTutorial.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit multi-input controls**

```bash
git add src/games/wallstreet-surfers/input src/games/wallstreet-surfers/ui
git commit -m "feat: add runner controls and tutorial"
```

### Task 6: Add HUD, gate prompt, debug overlay, pause, game-over, and challenge links

**Files:**
- Create: `src/games/wallstreet-surfers/ui/RunnerHud.tsx`
- Create: `src/games/wallstreet-surfers/ui/MarketGatePrompt.tsx`
- Create: `src/games/wallstreet-surfers/ui/RunnerDebugOverlay.tsx`
- Create: `src/games/wallstreet-surfers/ui/RunnerGameOver.tsx`
- Create: `src/games/wallstreet-surfers/challenge.ts`
- Test: `src/games/wallstreet-surfers/ui/RunnerHud.test.tsx`

**Interfaces:**
- Consumes: immutable runner snapshots, reset/pause commands, foundation route helpers.
- Produces: semantic UI, `createChallengeHash(seed, rulesetVersion)`, and `parseChallengeHash`.

- [ ] **Step 1: Write UI/challenge tests**

Assert score/distance/coins/streak/Powell gap labels, prompt and answer availability, pause/resume, specific failure message/tip, best-score persistence, Run again, Back to games, and challenge hash round-trip. Assert live regions do not announce per-frame values.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- src/games/wallstreet-surfers/ui`
Expected: FAIL because UI modules are absent.

- [ ] **Step 3: Implement overlays**

The debug overlay renders only when URLSearchParams contains `debug=1` and shows seed, time, distance, speed, lane, vertical state, next entity, collision bounds, current gate answer, and Powell gap. The share action copies the full URL only after an explicit click and shows a local toast.

- [ ] **Step 4: Verify UI and type tests**

Run: `npm test -- src/games/wallstreet-surfers && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit overlays and challenge flow**

```bash
git add src/games/wallstreet-surfers
git commit -m "feat: add runner HUD results and challenges"
```

### Task 7: Integrate assets, reduced motion, audio events, and fallbacks

**Files:**
- Create: `src/games/wallstreet-surfers/assets/runnerAssets.ts`
- Create: `src/games/wallstreet-surfers/audio/runnerAudio.ts`
- Modify: `src/games/wallstreet-surfers/phaser/RunnerScene.ts`
- Modify: `src/games/wallstreet-surfers/WallstreetSurfersRoute.tsx`
- Test: `src/games/wallstreet-surfers/assets/runnerAssets.test.ts`

**Interfaces:**
- Consumes: generated manifest paths from the Higgsfield assets plan and shared audio/settings.
- Produces: typed asset map, load fallbacks, and semantic audio events.

- [ ] **Step 1: Write manifest/fallback tests**

Assert every required key resolves to a local file, missing optional art uses procedural fallback, missing audio leaves the game playable/muted, and reduced motion disables camera shake/flash while preserving spawn/scoring state.

- [ ] **Step 2: Verify failure before assets integration**

Run: `npm test -- src/games/wallstreet-surfers/assets`
Expected: FAIL on missing typed asset map.

- [ ] **Step 3: Implement the asset/audio adapters**

Use only the frozen manifest keys `ws-runner-street`, `ws-runner-avatar`, `ws-run-loop`, `ws-train`, `ws-barrier`, `ws-long-arrow`, `ws-short-arrow`, and `ws-coin`, plus the shared `arcade-loop`, `ui-confirm`, `market-success`, `market-failure`, `coin-pickup`, and `collision` audio IDs. Derive bull/bear train variants, lanes, Powell chaser, sign frames, jump/roll poses, parallax, and track markings in Phaser/CSS; keep all train/sign labels as semantic or canvas text. Do not request unlisted generated files.

- [ ] **Step 4: Run asset, engine, and build checks**

Run: `npm test -- src/games/wallstreet-surfers && npm run build`
Expected: PASS with no missing-asset console errors in preview.

- [ ] **Step 5: Commit integrated runner media**

```bash
git add src/games/wallstreet-surfers src/assets/catalog.ts
git commit -m "feat: integrate Wallstreet Surfers media"
```

### Task 8: Add deterministic E2E, responsive, and performance verification

**Files:**
- Create: `e2e/wallstreet-surfers.spec.ts`
- Create: `e2e/fixtures/runnerChallenge.ts`
- Create: `scripts/check-runner-assets.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `#/wallstreet-surfers?seed=e2e-runner&debug=1` and public debug overlay.
- Produces: repeatable end-to-end and asset-budget release evidence.

- [ ] **Step 1: Write the failing deterministic E2E scenario**

Use the debug seed to complete tutorial, change lanes, collect a coin, answer one known gate correctly, hit a known train, verify the exact failure/tip, restart, and confirm the same first obstacle sequence. Repeat core controls at desktop and 375x812 touch emulation.

- [ ] **Step 2: Run E2E and capture the first real failure**

Run: `npm run e2e -- e2e/wallstreet-surfers.spec.ts`
Expected: FAIL on the first incomplete integration behavior.

- [ ] **Step 3: Add asset and frame-budget checks**

`check-runner-assets.mjs` fails when any single raster exceeds 2 MiB, any sprite sheet exceeds 4096px on either side, or required audio is not local. E2E samples 600 debug frames and asserts no simulation step exceeds the configured 16.7ms CPU budget in the deterministic desktop profile; mobile smoke asserts interaction responsiveness rather than a flaky exact FPS.

- [ ] **Step 4: Run the full runner gate**

Run: `npm test -- src/games/wallstreet-surfers && npm run runner:assets && npm run lint && npm run typecheck && npm run build && npm run e2e -- e2e/wallstreet-surfers.spec.ts`
Expected: every command exits 0.

- [ ] **Step 5: Commit verified runner**

```bash
git add e2e/wallstreet-surfers.spec.ts e2e/fixtures/runnerChallenge.ts scripts/check-runner-assets.mjs package.json src/games/wallstreet-surfers
git commit -m "test: verify Wallstreet Surfers loop"
```
