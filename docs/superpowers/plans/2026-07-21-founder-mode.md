# Founder Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four complete, deterministic five-decision Founder Mode episodes with classic/brainrot writing, Reality-versus-You feedback, explainable scoring, replay, streaks, and an accessible responsive UI.

**Architecture:** A pure TypeScript episode graph and reducer own all mechanics. Versioned content modules provide immutable episodes; React renders landing, intro, decision, outcome, archive, and ending states. Persistence and seeded utilities come from the foundation plan, while all charts and status summaries retain semantic text equivalents.

**Tech Stack:** React, TypeScript strict mode, Vitest, Testing Library, Playwright, CSS modules/global tokens from the foundation plan.

## Global Constraints

- Every episode contains exactly five decisions and every decision contains exactly three choices.
- Version one contains Netflix 2011, Kodak 1975, Apple 1997, and Blockbuster 2000.
- Classic and brainrot modes share facts, scoring, citations, and mechanics; only prose tone changes.
- All results are deterministic and work without a network connection.
- Decision choices are visible within a 720px-high desktop viewport and have 44px minimum touch targets.
- Charts, status chips, and result pips have complete text equivalents; color never carries meaning alone.
- Store only the episode ID, state, streak, style, ruleset version, and timestamp.
- Use original copy grounded in source metadata; do not copy OpenTrade text verbatim.

---

### Task 1: Define and validate the episode content contract

**Files:**
- Create: `src/games/founder-mode/content/types.ts`
- Create: `src/games/founder-mode/content/validateEpisode.ts`
- Test: `src/games/founder-mode/content/validateEpisode.test.ts`

**Interfaces:**
- Consumes: no game-specific interfaces.
- Produces: `FounderEpisode`, `FounderDecision`, `FounderChoice`, `FounderSource`, and `validateEpisode(episode): string[]`.

- [ ] **Step 1: Write the failing content-contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { validateEpisode } from './validateEpisode';
import type { FounderEpisode } from './types';

const valid: FounderEpisode = {
  id: 'sample', episodeNumber: 1, company: 'Sample Co', founder: 'Ada Founder',
  startYear: 2000, rulesetVersion: 1, initialValueBn: 10, historicalEndValueBn: 12,
  intro: { classic: 'A documented setup.', brainrot: 'A documented setup, but loud.' },
  sources: [{ id: 's1', title: 'Primary filing', url: 'https://example.com', publisher: 'Example', accessed: '2026-07-21' }],
  decisions: Array.from({ length: 5 }, (_, i) => ({
    id: `d${i + 1}`, year: 2000 + i, prompt: { classic: `Decision ${i + 1}`, brainrot: `Decision ${i + 1}, no cap` },
    sourceIds: ['s1'],
    choices: [0, 1, 2].map((choice) => ({
      id: `c${choice + 1}`, label: `Choice ${choice + 1}`, matchedHistory: choice === 0,
      worked: choice !== 2, valueMultiplier: choice === 0 ? 1.1 : choice === 1 ? 1.05 : 0.9,
      styleWeights: { visionary: choice === 0 ? 2 : 0, operator: choice === 1 ? 2 : 0, consensus: choice === 2 ? 2 : 0 },
      outcome: { classic: 'Outcome.', brainrot: 'Outcome, somehow.' },
    })),
  })),
};

describe('validateEpisode', () => {
  it('accepts a complete five-by-three episode', () => expect(validateEpisode(valid)).toEqual([]));
  it('rejects the wrong decision count', () => expect(validateEpisode({ ...valid, decisions: valid.decisions.slice(0, 4) })).toContain('sample must contain exactly 5 decisions'));
  it('rejects missing sources and non-positive multipliers', () => {
    const broken = structuredClone(valid);
    broken.decisions[0].sourceIds = ['missing'];
    broken.decisions[0].choices[0].valueMultiplier = 0;
    expect(validateEpisode(broken)).toEqual(expect.arrayContaining([
      'sample/d1 references unknown source missing',
      'sample/d1/c1 valueMultiplier must be greater than 0',
    ]));
  });
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run: `npm test -- src/games/founder-mode/content/validateEpisode.test.ts`
Expected: FAIL because `types.ts` and `validateEpisode.ts` do not exist.

- [ ] **Step 3: Implement the exact content types and validator**

```ts
export type WritingStyle = 'classic' | 'brainrot';
export type StyledCopy = Record<WritingStyle, string>;
export type FounderStyle = 'visionary' | 'operator' | 'consensus';

export interface FounderSource { id: string; title: string; url: string; publisher: string; accessed: string }
export interface FounderChoice {
  id: string; label: string; matchedHistory: boolean; worked: boolean; valueMultiplier: number;
  styleWeights: Record<FounderStyle, number>; outcome: StyledCopy;
}
export interface FounderDecision { id: string; year: number; prompt: StyledCopy; sourceIds: string[]; choices: FounderChoice[] }
export interface FounderEpisode {
  id: string; episodeNumber: number; company: string; founder: string; startYear: number;
  rulesetVersion: number; initialValueBn: number; historicalEndValueBn: number;
  intro: StyledCopy; sources: FounderSource[]; decisions: FounderDecision[];
}
```

`validateEpisode` must return deterministic, path-prefixed messages and check: five decisions, three unique choices per decision, unique decision/source IDs, every source reference resolves, positive finite valuation inputs/multipliers, non-empty copy variants, and at least one historical choice per decision.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- src/games/founder-mode/content/validateEpisode.test.ts && npm run typecheck`
Expected: PASS, 3 tests; typecheck exits 0.

- [ ] **Step 5: Commit the contract**

```bash
git add src/games/founder-mode/content
git commit -m "feat: define Founder Mode episode contract"
```

### Task 2: Implement the deterministic five-decision reducer and scoring

**Files:**
- Create: `src/games/founder-mode/engine/founderState.ts`
- Create: `src/games/founder-mode/engine/founderReducer.ts`
- Create: `src/games/founder-mode/engine/scoreFounderRun.ts`
- Test: `src/games/founder-mode/engine/founderReducer.test.ts`

**Interfaces:**
- Consumes: `FounderEpisode`, `FounderChoice`, `WritingStyle`.
- Produces: `createFounderRun`, `founderReducer`, `scoreFounderRun`, `FounderRunState`, and `FounderAction`.

- [ ] **Step 1: Write reducer tests for start, choice, outcome, advance, and ending**

```ts
const start = createFounderRun(episode, 'classic');
expect(start).toMatchObject({ phase: 'intro', decisionIndex: 0, currentValueBn: 10, history: [] });
const deciding = founderReducer(start, { type: 'TAKE_CHAIR' }, episode);
const outcome = founderReducer(deciding, { type: 'CHOOSE', choiceId: 'c1' }, episode);
expect(outcome).toMatchObject({ phase: 'outcome', currentValueBn: 11 });
expect(outcome.history).toEqual([{ decisionId: 'd1', choiceId: 'c1', valueBeforeBn: 10, valueAfterBn: 11 }]);
```

Add tests proving invalid phase transitions and duplicate choices return the identical state object, decision five advances to `ending`, replay resets history, and style changes do not change numeric results.

- [ ] **Step 2: Run the reducer test and verify failure**

Run: `npm test -- src/games/founder-mode/engine/founderReducer.test.ts`
Expected: FAIL because reducer exports do not exist.

- [ ] **Step 3: Implement state and reducer**

```ts
export type FounderPhase = 'landing' | 'intro' | 'decision' | 'outcome' | 'ending';
export interface FounderHistoryItem { decisionId: string; choiceId: string; valueBeforeBn: number; valueAfterBn: number }
export interface FounderRunState {
  episodeId: string; style: WritingStyle; phase: FounderPhase; decisionIndex: number;
  currentValueBn: number; history: FounderHistoryItem[];
}
export type FounderAction =
  | { type: 'PLAY' }
  | { type: 'TAKE_CHAIR' }
  | { type: 'CHOOSE'; choiceId: string }
  | { type: 'NEXT' }
  | { type: 'SET_STYLE'; style: WritingStyle }
  | { type: 'REPLAY' };
```

Round displayed values to one decimal after every choice using `Math.round(value * 10) / 10`. `scoreFounderRun` must return `valueRatio`, `matchedHistoryCount`, `workedCount`, normalized style percentages summing to 100, and tier: `legend` for ratio >= 1.5, `builder` for ratio >= 1, `survivor` for ratio >= 0.7, otherwise `cautionary`.

- [ ] **Step 4: Verify reducer and score tests**

Run: `npm test -- src/games/founder-mode/engine && npm run typecheck`
Expected: PASS; no nondeterministic output.

- [ ] **Step 5: Commit the engine**

```bash
git add src/games/founder-mode/engine
git commit -m "feat: add deterministic Founder Mode engine"
```

### Task 3: Author and validate four complete episode modules

**Files:**
- Create: `src/games/founder-mode/content/netflix2011.ts`
- Create: `src/games/founder-mode/content/kodak1975.ts`
- Create: `src/games/founder-mode/content/apple1997.ts`
- Create: `src/games/founder-mode/content/blockbuster2000.ts`
- Create: `src/games/founder-mode/content/episodes.ts`
- Test: `src/games/founder-mode/content/episodes.test.ts`

**Interfaces:**
- Consumes: `FounderEpisode` and `validateEpisode`.
- Produces: `founderEpisodes`, `founderEpisodeById(id)`, and four immutable episode exports.

- [ ] **Step 1: Write the registry/content tests**

```ts
expect(founderEpisodes.map((e) => e.id)).toEqual(['netflix-2011', 'kodak-1975', 'apple-1997', 'blockbuster-2000']);
for (const episode of founderEpisodes) expect(validateEpisode(episode)).toEqual([]);
for (const episode of founderEpisodes) {
  expect(episode.decisions).toHaveLength(5);
  expect(episode.decisions.every((d) => d.choices.length === 3)).toBe(true);
  expect(JSON.stringify(episode)).not.toMatch(/TBD|TODO|lorem ipsum/i);
}
```

- [ ] **Step 2: Run tests and verify the missing-module failure**

Run: `npm test -- src/games/founder-mode/content/episodes.test.ts`
Expected: FAIL because the four episode modules are absent.

- [ ] **Step 3: Author the complete decision sets**

Use these exact five decision topics in chronological order and provide three original choices, two prose variants, source IDs, outcome variants, scoring, and style weights for each:

| Episode | Decision topics |
|---|---|
| Netflix 2011 | split DVD/streaming pricing; Qwikster announcement; reverse Qwikster; continue international expansion; commit to House of Cards |
| Kodak 1975 | fund or bury the first digital camera; protect film economics or build a digital unit; respond to Japanese competition; commercialize photo CD/digital workflows; restructure around digital imaging |
| Apple 1997 | accept Microsoft investment; reduce the product matrix; open Apple retail; build the iPod/iTunes ecosystem; switch Macs to Intel processors |
| Blockbuster 2000 | acquire Netflix; remove late fees with a sustainable model; prioritize online subscriptions over new stores; integrate stores with mail delivery; recapitalize/close stores before the debt crisis |

Every module must contain its own primary/reputable source metadata. Numeric multipliers must remain between `0.65` and `1.45`; no single choice may decide the entire run. Freeze all exports with `Object.freeze` at module boundaries.

- [ ] **Step 4: Run content and full engine tests**

Run: `npm test -- src/games/founder-mode/content src/games/founder-mode/engine`
Expected: PASS; 4 valid episodes, 20 decisions, 60 choices.

- [ ] **Step 5: Commit the episode content**

```bash
git add src/games/founder-mode/content
git commit -m "feat: add four Founder Mode episodes"
```

### Task 4: Build the Founder Mode route and landing/archive screens

**Files:**
- Create: `src/games/founder-mode/FounderModeRoute.tsx`
- Modify: `src/games/founder-mode/route.tsx`
- Create: `src/games/founder-mode/persistence/founderSave.ts`
- Create: `src/games/founder-mode/ui/FounderLanding.tsx`
- Create: `src/games/founder-mode/ui/EpisodeArchive.tsx`
- Create: `src/games/founder-mode/founder-mode.css`
- Test: `src/games/founder-mode/ui/FounderLanding.test.tsx`
- Test: `src/games/founder-mode/persistence/founderSave.test.ts`

**Interfaces:**
- Consumes: foundation `GameRouteModule`, `GameSaveCodec`, `createGameStore`, shared `Button`, route registry, and `founderEpisodes`.
- Produces: default route component, `founderSaveCodec`, `founderStore`, progress/reset helpers, and the foundation-compatible named `gameRoute: GameRouteModule` from `route.tsx`.

- [ ] **Step 1: Write accessible landing/archive tests**

Test exact accessible controls: heading `Founder Mode`, style buttons `Classic` and `Brainrot`, `Play episode`, `Past episodes`, four archive episode buttons, and a streak label. Assert style selection persists and the archive returns to the selected episode. Add persistence tests for empty, valid, corrupt, and incompatible saves plus the `{ label, value, tone }` progress badge.

- [ ] **Step 2: Run the component test and verify failure**

Run: `npm test -- src/games/founder-mode/ui/FounderLanding.test.tsx`
Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement route state and screens**

```ts
export interface FounderSaveV1 {
  schemaVersion: 1; selectedEpisodeId: string; style: WritingStyle;
  streakDays: number; lastCompletedDate: string | null; activeRun: FounderRunState | null;
}
```

Implement `GameSaveCodec<FounderSaveV1>` through `createGameStore`; surface `recovery-required` without throwing. Replace the temporary foundation `route.tsx` entry with `gameRoute` using `FOUNDER_MODE_METADATA`, `Entry: FounderModeRoute`, the codec save key, reset/progress helpers, and shared `parseChallenge`. Use a warm-black full viewport, ivory text, tracked uppercase metadata, an accessible `radiogroup` composed from the shared `Button`, episode cards ordered newest-first, and route-level recovery when a persisted episode ID no longer exists.

- [ ] **Step 4: Verify component tests and responsive render**

Run: `npm test -- src/games/founder-mode/ui/FounderLanding.test.tsx src/games/founder-mode/persistence/founderSave.test.ts && npm run typecheck`
Expected: PASS; no axe violations in the component harness.

- [ ] **Step 5: Commit landing and archive**

```bash
git add src/games/founder-mode
git commit -m "feat: add Founder Mode episode landing"
```

### Task 5: Implement intro, decision, outcome, and semantic chart screens

**Files:**
- Create: `src/games/founder-mode/ui/FounderIntro.tsx`
- Create: `src/games/founder-mode/ui/FounderDecision.tsx`
- Create: `src/games/founder-mode/ui/FounderOutcome.tsx`
- Create: `src/games/founder-mode/ui/ValuationChart.tsx`
- Test: `src/games/founder-mode/ui/FounderRun.test.tsx`

**Interfaces:**
- Consumes: reducer state/actions and episode content.
- Produces: keyboard-operable run UI; `ValuationChart({ realityBn, playerBn, history })`.

- [ ] **Step 1: Write a component test covering one complete decision**

Render a known episode, click `Take the chair`, assert `Decision 1 of 5`, choose a labeled option, assert `Matched history: yes/no`, `Outcome: worked/did not work`, the updated `$x.xB` text, and `Continue to decision 2`.

- [ ] **Step 2: Verify the test fails before UI implementation**

Run: `npm test -- src/games/founder-mode/ui/FounderRun.test.tsx`
Expected: FAIL because run screens are missing.

- [ ] **Step 3: Implement the screens**

Render choices as a fieldset/radio-card group with one submit action or as three direct buttons with complete accessible names. The chart uses SVG for visuals plus a visually hidden sentence: `Reality is $X billion; your company is $Y billion after N decisions.` Keep the dilemma and all three options visible at 1280x720 without scrolling.

- [ ] **Step 4: Run component, engine, and type tests**

Run: `npm test -- src/games/founder-mode && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit the playable loop**

```bash
git add src/games/founder-mode
git commit -m "feat: add Founder Mode decision loop"
```

### Task 6: Implement ending, explainable style mix, replay, and streak persistence

**Files:**
- Create: `src/games/founder-mode/ui/FounderEnding.tsx`
- Create: `src/games/founder-mode/ui/DecisionRecap.tsx`
- Modify: `src/games/founder-mode/FounderModeRoute.tsx`
- Test: `src/games/founder-mode/ui/FounderEnding.test.tsx`

**Interfaces:**
- Consumes: `scoreFounderRun`, save adapter, episode registry.
- Produces: final tier screen, five recap buttons, replay, archive navigation, and updated daily streak.

- [ ] **Step 1: Write ending and streak tests**

Assert final player/reality values, tier, percentages summing to 100, five recap controls, the explanation `Your mix is based on the style weights of all five choices`, replay resetting only the active run, and same-day completion not incrementing the streak twice.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- src/games/founder-mode/ui/FounderEnding.test.tsx`
Expected: FAIL because ending components are absent.

- [ ] **Step 3: Implement ending and UTC-date streak logic**

```ts
export function nextStreak(previousDate: string | null, previous: number, today: string): number {
  if (previousDate === today) return previous;
  if (!previousDate) return 1;
  const days = (Date.parse(today) - Date.parse(previousDate)) / 86_400_000;
  return days === 1 ? previous + 1 : 1;
}
```

Decision recap buttons open a semantic dialog containing dilemma, choice, outcome, value before/after, and cited source links.

- [ ] **Step 4: Verify all Founder Mode tests**

Run: `npm test -- src/games/founder-mode && npm run lint && npm run typecheck`
Expected: PASS with no warnings.

- [ ] **Step 5: Commit ending and persistence**

```bash
git add src/games/founder-mode
git commit -m "feat: finish Founder Mode results and replay"
```

### Task 7: Add complete responsive and end-to-end coverage

**Files:**
- Create: `e2e/founder-mode.spec.ts`
- Create: `e2e/fixtures/founder-mode.ts`
- Modify: `src/games/founder-mode/founder-mode.css`

**Interfaces:**
- Consumes: public route `#/founder-mode` and deterministic content.
- Produces: complete browser proof for classic/brainrot, ending, replay, archive, and mobile layout.

- [ ] **Step 1: Write the failing E2E path**

The spec must navigate to Founder Mode, select Brainrot, play all five decisions by stable button labels, verify each outcome, verify ending and five recaps, replay, open archive, select another episode, reload, and confirm persisted style/streak. Run it at desktop and 375x812 mobile sizes.

- [ ] **Step 2: Run E2E and record the first real failure**

Run: `npm run e2e -- e2e/founder-mode.spec.ts`
Expected: FAIL on the first missing/incorrect integration behavior, not on an unavailable server.

- [ ] **Step 3: Fix only observed integration gaps and responsive overflow**

Do not alter scoring/content to satisfy visual tests. Ensure no horizontal document overflow and all decision controls remain reachable at 200% zoom.

- [ ] **Step 4: Run all checks**

Run: `npm test -- src/games/founder-mode && npm run lint && npm run typecheck && npm run build && npm run e2e -- e2e/founder-mode.spec.ts`
Expected: all commands exit 0.

- [ ] **Step 5: Commit the verified vertical slice**

```bash
git add e2e/founder-mode.spec.ts e2e/fixtures/founder-mode.ts src/games/founder-mode
git commit -m "test: verify Founder Mode across viewports"
```
