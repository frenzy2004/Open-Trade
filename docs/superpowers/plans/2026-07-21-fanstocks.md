# FanStocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, five-minute FanStocks league in which the player drafts three stock cards, competes against three personality-driven AI portfolios, negotiates one-for-one trades, and reaches a ranked Friday-close result with rematch and new-league flows.

**Architecture:** Pure TypeScript modules own content validation, drafting, AI selection, price paths, trades, ranking, and the top-level state reducer. React consumes that reducer through one persistence-aware controller and renders semantic DOM screens; no game rule lives in a component. The module consumes the foundation RNG, versioned persistence, route, settings, and UI contracts listed below and exports one lazy-loadable route module plus a progress reader/reset pair for the hub.

**Tech Stack:** Node 24, npm, Vite, React, TypeScript strict mode, React Router hash routing, Vitest, Testing Library, Playwright, CSS, localStorage through the foundation adapter.

## Global Constraints

- The game has exactly three draft rounds, each with exactly three candidates, and the player drafts exactly one candidate per round.
- The player and three AI opponents each finish with exactly three unique cards; all four portfolios begin at exactly `$50.00`.
- Version one uses synthetic, seeded price paths only; it does not call a market-data, brokerage, authentication, or payment service.
- The default market week is `60` ticks at `5_000ms` per tick: roughly five minutes at `1x`, with `1x`, `2x`, `4x`, and pause controls.
- Challenge URLs persist only `seed` and `rules=1`; saves contain only game state, ruleset version, seed, and timestamp.
- Every state transition is deterministic for the same ruleset, seed, and ordered actions.
- Trades are always one-for-one; no action may duplicate a ticker, remove a ticker, or change a completed portfolio's card count.
- Rank by displayed cents using competition ranks (`1, 1, 3`); every portfolio tied at the highest cent value is a winner.
- Games may import shared services but may not import another game.
- Every DOM action is keyboard accessible with visible focus and at least a `44px` target.
- Dialogs trap focus, close on Escape, restore focus, and expose an accessible title and description.
- Color never carries meaning alone; charts, trade direction, price direction, ranking, and market status have text equivalents.
- Meaningful events use polite live regions/toasts; per-tick prices and per-second time do not announce.
- Reduced motion removes card-flight animation, glow pulses, and chart-path animation without removing state feedback.
- The document must have no horizontal overflow at `320`, `375`, `768`, `1024`, or `1440` CSS pixels.
- All card and interface text is HTML; images are decorative and fall back to a branded, non-broken treatment when unavailable.
- Do not add a production debug shortcut, hidden market bypass, or network dependency to make tests pass.

## Foundation contracts consumed

The foundation milestone must expose these exact signatures before Task 1 starts. FanStocks must import them; it must not create local substitutes.

```ts
// src/shared/rng/seededRng.ts
export interface SeededRng {
  readonly seed: number;
  next(): number; // [0, 1)
  int(minInclusive: number, maxExclusive: number): number;
  pick<T>(values: readonly T[]): T;
  shuffle<T>(values: readonly T[]): T[];
  fork(label: string): SeededRng;
}
export function createSeededRng(seed: number | string): SeededRng;

// src/shared/persistence/gameStore.ts
export type GameSaveDecodeResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };
export type GameStoreLoadResult<T> =
  | { status: 'empty' }
  | { status: 'ready'; value: T; seed: string | null; savedAt: string; migrated: boolean }
  | { status: 'recovery-required'; reason: 'corrupt' | 'incompatible' | 'storage-unavailable'; detail: string };
export interface GameSaveCodec<T> {
  readonly key: string;
  readonly version: number;
  encode(value: T): unknown;
  decode(raw: unknown): GameSaveDecodeResult<T>;
}
export interface GameStore<T> {
  load(): GameStoreLoadResult<T>;
  save(value: T, metadata?: { seed?: string | null; savedAt?: string }): { ok: true } | { ok: false; reason: string };
  clear(): { ok: true } | { ok: false; reason: string };
}
export function createGameStore<T>(codec: GameSaveCodec<T>): GameStore<T>;

// src/shared/routing/challenge.ts
export interface ChallengeDescriptor { seed: string; rulesetVersion: number }
export function parseChallenge(input: string | URLSearchParams): ChallengeDescriptor | null;
export function formatChallenge(challenge: ChallengeDescriptor): string;
export function createGuestSeed(): string;

// src/shared/settings/SettingsContext.tsx
export interface AppSettings { muted: boolean; reducedMotion: boolean }
export function useSettings(): {
  settings: AppSettings;
  updateSettings(patch: Partial<AppSettings>): void;
};

// src/app/routes/types.ts
export type GameId = 'fanstocks' | 'founder-mode' | 'wallstreet-surfers';
export interface GameProgressBadge {
  label: string;
  value: string;
  tone: 'neutral' | 'positive' | 'warning';
}
export interface GameRouteModule {
  metadata: GameRouteMetadata;
  Entry: React.ComponentType;
  saveKey: string;
  reset(): void;
  getProgressBadge(): GameProgressBadge;
  parseChallenge?(input: string | URLSearchParams): ChallengeDescriptor | null;
}

// src/shared/ui public exports
export { Button } from './Button';
export { Dialog } from './Dialog';
export { ProgressBar } from './ProgressBar';
export { useToasts } from './ToastContext';
// Button supports variant="primary" | "secondary" | "ghost" | "danger".
// Dialog props are { open, onClose, title, description?, actions?, children }.
// ProgressBar props are { value, max, label }.
// useToasts().addToast(message, tone?: 'info' | 'success' | 'warning').
```

## FanStocks interfaces produced

```ts
// src/games/fanstocks/route.tsx
export const gameRoute: GameRouteModule;

// src/games/fanstocks/persistence/fanStocksSave.ts
export const fanStocksSaveCodec: GameSaveCodec<FanStocksSaveV1>;
export const fanStocksStore: GameStore<FanStocksSaveV1>;
export function getFanStocksProgressBadge(): GameProgressBadge | null;
export function resetFanStocksProgress(): void;

// src/games/fanstocks/engine/fanStocksReducer.ts
export function createFanStocksState(seed: string): FanStocksState;
export function fanStocksReducer(state: FanStocksState, action: FanStocksAction): FanStocksState;
```

## File map

- `src/games/fanstocks/content/types.ts` — immutable stock/personality data contracts.
- `src/games/fanstocks/content/stocks.ts` — twelve curated synthetic-demo cards.
- `src/games/fanstocks/content/personalities.ts` — Momentum, Contrarian, and Balanced opponents.
- `src/games/fanstocks/content/validateStocks.ts` — deterministic build/test-time content validation.
- `src/games/fanstocks/engine/rules.ts` — ruleset constants and participant order.
- `src/games/fanstocks/engine/draftReducer.ts` — three-round candidate/detail/draft state machine.
- `src/games/fanstocks/engine/aiDraft.ts` — deterministic personality scoring and roster completion.
- `src/games/fanstocks/engine/priceEngine.ts` — bounded factor/correlation/card price frames and portfolio valuation.
- `src/games/fanstocks/engine/trades.ts` — incoming/outgoing proposals, validation, AI decisions, and swaps.
- `src/games/fanstocks/engine/ranking.ts` — cent-rounded competition ranking and result summaries.
- `src/games/fanstocks/engine/fanStocksReducer.ts` — phase orchestration and rematch state.
- `src/games/fanstocks/persistence/fanStocksSave.ts` — save codec, store, hub progress, and reset.
- `src/games/fanstocks/useFanStocksController.ts` — reducer, URL seed, autosave, clock, visibility pause, and UI effects.
- `src/games/fanstocks/FanStocksRoute.tsx` — phase switch and route recovery.
- `src/games/fanstocks/route.tsx` — lazy route module for the shared registry.
- `src/games/fanstocks/ui/*` — intro/tutorial, draft/detail, league/race, trades, and results.
- `src/games/fanstocks/fanstocks.css` — game-scoped responsive and reduced-motion styling.
- `e2e/fanstocks.spec.ts` — complete deterministic pointer/keyboard/touch/rematch path.
- `e2e/fanstocks-responsive.spec.ts` — breakpoint, focus, reduced-motion, and overflow checks.

---

### Task 1: Define, author, and validate stock and AI content

**Files:**
- Create: `src/games/fanstocks/content/types.ts`
- Create: `src/games/fanstocks/content/stocks.ts`
- Create: `src/games/fanstocks/content/personalities.ts`
- Create: `src/games/fanstocks/content/validateStocks.ts`
- Test: `src/games/fanstocks/content/validateStocks.test.ts`

**Interfaces:**
- Consumes: no game-specific interfaces and no random source.
- Produces: `Ticker`, `StockCard`, `AiPersonality`, `STOCKS`, `STOCK_BY_TICKER`, `AI_PERSONALITIES`, and `validateStocks(cards): string[]`.

- [ ] **Step 1: Write the failing content tests**

```ts
import { describe, expect, it } from 'vitest';
import { AI_PERSONALITIES } from './personalities';
import { STOCKS } from './stocks';
import type { StockCard } from './types';
import { validateStocks } from './validateStocks';

describe('FanStocks content', () => {
  it('contains twelve valid and unique synthetic-demo cards', () => {
    expect(STOCKS).toHaveLength(12);
    expect(validateStocks(STOCKS)).toEqual([]);
    expect(new Set(STOCKS.map(({ ticker }) => ticker)).size).toBe(12);
    expect(STOCKS.every(({ syntheticDemo }) => syntheticDemo)).toBe(true);
  });

  it('defines the three required personalities in stable seat order', () => {
    expect(AI_PERSONALITIES.map(({ id }) => id)).toEqual([
      'momentum', 'contrarian', 'balanced',
    ]);
  });

  it('reports every invalid field with a ticker-prefixed message', () => {
    const broken = { ...STOCKS[0], volatility: 2, evidence: ['one'], artworkKey: '../remote' } as unknown as StockCard;
    expect(validateStocks([broken])).toEqual([
      'XLE volatility must be between 0 and 1',
      'XLE evidence must contain 3 non-empty bullets',
      'XLE artworkKey must be a safe CSS artwork token',
    ]);
  });
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run: `npm exec vitest run -- src/games/fanstocks/content/validateStocks.test.ts`
Expected: FAIL with `Failed to resolve import "./personalities"`.

- [ ] **Step 3: Add the exact content contracts**

```ts
// src/games/fanstocks/content/types.ts
export type Sector =
  | 'consumer' | 'energy' | 'healthcare' | 'industrials'
  | 'small-cap' | 'technology';
export type CorrelationGroup = 'consumer-cycle' | 'energy-cycle' | 'growth' | 'defensive' | 'small-cap';
export type Ticker = string;

export interface StockCard {
  readonly ticker: Ticker;
  readonly company: string;
  readonly sector: Sector;
  readonly volatility: number;
  readonly momentumBias: number;
  readonly correlationGroup: CorrelationGroup;
  readonly thesis: string;
  readonly evidence: readonly [string, string, string];
  readonly artworkKey: string;
  readonly syntheticDemo: true;
}

export type AiId = 'momentum' | 'contrarian' | 'balanced';
export interface AiPersonality {
  readonly id: AiId;
  readonly name: string;
  readonly strategy: string;
  readonly accent: 'orange' | 'violet' | 'cyan';
  readonly tradeThreshold: number;
}
```

- [ ] **Step 4: Author the twelve-card registry and personality registry**

Use this complete registry in `stocks.ts`; `artworkKey` selects a deterministic CSS/data card treatment, so the twelve cards do not introduce unlisted media or broken image requests.

```ts
import type { StockCard } from './types';

const card = (
  ticker: string,
  company: string,
  sector: StockCard['sector'],
  volatility: number,
  momentumBias: number,
  correlationGroup: StockCard['correlationGroup'],
  thesis: string,
  evidence: StockCard['evidence'],
): StockCard => Object.freeze({
  ticker, company, sector, volatility, momentumBias, correlationGroup, thesis, evidence,
  artworkKey: ticker.toLowerCase(),
  syntheticDemo: true,
});

export const STOCKS: readonly StockCard[] = Object.freeze([
  card('XLE', 'Energy Select Sector SPDR Fund', 'energy', 0.58, 0.12, 'energy-cycle',
    'A basket of major US energy companies that moves with fuel demand and commodity prices.',
    ['Broad energy exposure in one card', 'Cash flow can rise with oil prices', 'Commodity reversals can be sharp']),
  card('DKNG', 'DraftKings', 'consumer', 0.88, 0.42, 'growth',
    'A high-growth sports platform whose upside depends on expansion and disciplined customer acquisition.',
    ['More legal markets widen reach', 'Revenue growth can outpace mature peers', 'Promotion costs amplify volatility']),
  card('HUBS', 'HubSpot', 'technology', 0.76, 0.34, 'growth',
    'A subscription software compounder tied to small-business spending and customer retention.',
    ['Recurring revenue supports visibility', 'Product expansion raises account value', 'Premium valuation raises drawdown risk']),
  card('AMZN', 'Amazon', 'consumer', 0.66, 0.28, 'growth',
    'Commerce scale and cloud profits create two engines, with margins sensitive to investment cycles.',
    ['Cloud profit can offset retail pressure', 'Logistics scale strengthens convenience', 'Heavy investment can compress margins']),
  card('ODFL', 'Old Dominion Freight Line', 'industrials', 0.48, 0.18, 'consumer-cycle',
    'A disciplined freight network that benefits when shipment demand and pricing stay firm.',
    ['Dense routes improve efficiency', 'Service quality supports pricing', 'Freight volumes follow the economy']),
  card('SBUX', 'Starbucks', 'consumer', 0.54, -0.08, 'consumer-cycle',
    'A global habit brand balancing store traffic, pricing power, labor costs, and overseas growth.',
    ['Loyalty supports repeat visits', 'Global stores add runway', 'Traffic can weaken after price increases']),
  card('LOW', "Lowe's", 'consumer', 0.43, -0.03, 'defensive',
    'A home-improvement retailer with resilient repair demand and housing-cycle sensitivity.',
    ['Repair spending is recurring', 'Professional customers add stability', 'Large projects slow with housing']),
  card('MPC', 'Marathon Petroleum', 'energy', 0.62, 0.16, 'energy-cycle',
    'A refiner whose earnings follow fuel demand, refinery availability, and crack spreads.',
    ['Refining margins can expand quickly', 'Buybacks can magnify per-share gains', 'Outages and spreads create sharp swings']),
  card('IWM', 'Russell 2000 ETF', 'small-cap', 0.61, 0.04, 'small-cap',
    'A diversified small-company basket geared to domestic growth and financing conditions.',
    ['One card spreads company-specific risk', 'Domestic growth lifts many holdings', 'Higher rates pressure smaller borrowers']),
  card('SMCI', 'Super Micro Computer', 'technology', 0.96, 0.55, 'growth',
    'An infrastructure supplier with strong AI demand and unusually wide expectation-driven moves.',
    ['AI servers expand the addressable market', 'Rapid product cycles reward execution', 'Crowded expectations magnify misses']),
  card('CTRI', 'Centuri Holdings', 'industrials', 0.73, -0.22, 'small-cap',
    'A utility-infrastructure contractor whose backlog can recover before market sentiment does.',
    ['Grid investment supports demand', 'Backlog offers future visibility', 'Execution and leverage raise risk']),
  card('BMY', 'Bristol Myers Squibb', 'healthcare', 0.37, -0.15, 'defensive',
    'A cash-generating drug portfolio trading on pipeline execution and patent-cycle concerns.',
    ['Current medicines produce cash', 'Pipeline wins can reset expectations', 'Patent losses pressure future sales']),
]);

export const STOCK_BY_TICKER = new Map(STOCKS.map((stock) => [stock.ticker, stock]));
```

```ts
// src/games/fanstocks/content/personalities.ts
import type { AiPersonality } from './types';

export const AI_PERSONALITIES: readonly AiPersonality[] = Object.freeze([
  Object.freeze({ id: 'momentum', name: 'Momentum', strategy: 'Chases trend and volatile upside', accent: 'orange', tradeThreshold: 0.01 }),
  Object.freeze({ id: 'contrarian', name: 'Contrarian', strategy: 'Buys laggards and mean reversion', accent: 'violet', tradeThreshold: 0.005 }),
  Object.freeze({ id: 'balanced', name: 'Balanced', strategy: 'Values diversification and smoother risk', accent: 'cyan', tradeThreshold: 0.015 }),
]);
```

- [ ] **Step 5: Implement deterministic validation**

```ts
import type { StockCard } from './types';

export function validateStocks(cards: readonly StockCard[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const stock of cards) {
    const prefix = stock.ticker || '<missing ticker>';
    if (!/^[A-Z]{1,5}$/.test(stock.ticker)) errors.push(`${prefix} ticker must contain 1-5 uppercase letters`);
    if (seen.has(stock.ticker)) errors.push(`${prefix} ticker must be unique`);
    seen.add(stock.ticker);
    if (!stock.company.trim()) errors.push(`${prefix} company must be non-empty`);
    if (!Number.isFinite(stock.volatility) || stock.volatility < 0 || stock.volatility > 1) errors.push(`${prefix} volatility must be between 0 and 1`);
    if (!Number.isFinite(stock.momentumBias) || stock.momentumBias < -1 || stock.momentumBias > 1) errors.push(`${prefix} momentumBias must be between -1 and 1`);
    if (!stock.thesis.trim()) errors.push(`${prefix} thesis must be non-empty`);
    if (stock.evidence.length !== 3 || stock.evidence.some((item) => !item.trim())) errors.push(`${prefix} evidence must contain 3 non-empty bullets`);
    if (!/^[a-z0-9-]+$/.test(stock.artworkKey)) errors.push(`${prefix} artworkKey must be a safe CSS artwork token`);
    if (stock.syntheticDemo !== true) errors.push(`${prefix} syntheticDemo must be true`);
  }
  return errors;
}
```

- [ ] **Step 6: Run content tests and strict typecheck**

Run: `npm exec vitest run -- src/games/fanstocks/content/validateStocks.test.ts && npm run typecheck`
Expected: PASS, 3 tests; typecheck exits `0`.

- [ ] **Step 7: Commit the validated content contract**

```bash
git add src/games/fanstocks/content
git commit -m "feat: add validated FanStocks content"
```

### Task 2: Implement the exact three-round draft reducer

**Files:**
- Create: `src/games/fanstocks/engine/rules.ts`
- Create: `src/games/fanstocks/engine/draftReducer.ts`
- Test: `src/games/fanstocks/engine/draftReducer.test.ts`

**Interfaces:**
- Consumes: foundation `SeededRng`; content `Ticker`.
- Produces: `FANSTOCKS_RULES`, `DraftState`, `DraftAction`, `createDraftState(tickers, rng)`, `draftReducer(state, action)`, and `currentDraftLabel(state)`.

- [ ] **Step 1: Write failing reducer tests for packs, inspection, navigation, and legal picks**

```ts
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../../shared/rng/seededRng';
import { STOCKS } from '../content/stocks';
import { createDraftState, currentDraftLabel, draftReducer } from './draftReducer';

describe('draftReducer', () => {
  it('deals three deterministic groups of three without duplicates', () => {
    const a = createDraftState(STOCKS.map((stock) => stock.ticker), createSeededRng('draft-a'));
    const b = createDraftState(STOCKS.map((stock) => stock.ticker), createSeededRng('draft-a'));
    expect(a.groups).toEqual(b.groups);
    expect(a.groups.map((group) => group.length)).toEqual([3, 3, 3]);
    expect(new Set(a.groups.flat()).size).toBe(9);
  });

  it('wraps detail navigation inside the current group', () => {
    const initial = createDraftState(STOCKS.map((stock) => stock.ticker), createSeededRng('detail'));
    const opened = draftReducer(initial, { type: 'OPEN_DETAIL', ticker: initial.groups[0][0] });
    expect(draftReducer(opened, { type: 'MOVE_DETAIL', direction: -1 }).inspectedTicker).toBe(initial.groups[0][2]);
  });

  it('accepts one current-group pick per round and completes after three', () => {
    let state = createDraftState(STOCKS.map((stock) => stock.ticker), createSeededRng('complete'));
    for (let round = 0; round < 3; round += 1) {
      expect(currentDraftLabel(state)).toBe(`Round ${round + 1} of 3 · Pick 1 stock`);
      state = draftReducer(state, { type: 'DRAFT', ticker: state.groups[round][0] });
    }
    expect(state).toMatchObject({ status: 'complete', roundIndex: 3 });
    expect(state.picks).toHaveLength(3);
  });

  it('returns the identical state for an unavailable or previous-round ticker', () => {
    const initial = createDraftState(STOCKS.map((stock) => stock.ticker), createSeededRng('illegal'));
    expect(draftReducer(initial, { type: 'DRAFT', ticker: 'ZZZZ' })).toBe(initial);
  });
});
```

- [ ] **Step 2: Run the draft test and verify the missing-module failure**

Run: `npm exec vitest run -- src/games/fanstocks/engine/draftReducer.test.ts`
Expected: FAIL with `Failed to resolve import "./draftReducer"`.

- [ ] **Step 3: Add immutable rules and draft types**

```ts
// src/games/fanstocks/engine/rules.ts
export const FANSTOCKS_RULES = Object.freeze({
  rulesetVersion: 1,
  draftRounds: 3,
  candidatesPerRound: 3,
  cardsPerPortfolio: 3,
  startingValue: 50,
  ticksPerDay: 12,
  tradingDays: 5,
  baseTickMs: 5_000,
  incomingTradeTicks: Object.freeze([10, 25, 40] as const),
});
export const TOTAL_MARKET_TICKS = FANSTOCKS_RULES.ticksPerDay * FANSTOCKS_RULES.tradingDays;
export const PARTICIPANT_ORDER = Object.freeze(['player', 'momentum', 'contrarian', 'balanced'] as const);
export type ParticipantId = typeof PARTICIPANT_ORDER[number];
```

```ts
// src/games/fanstocks/engine/draftReducer.ts
import type { SeededRng } from '../../../shared/rng/seededRng';
import type { Ticker } from '../content/types';
import { FANSTOCKS_RULES } from './rules';

export interface DraftState {
  readonly groups: readonly (readonly Ticker[])[];
  readonly roundIndex: number;
  readonly picks: readonly Ticker[];
  readonly inspectedTicker: Ticker | null;
  readonly status: 'selecting' | 'complete';
}
export type DraftAction =
  | { type: 'OPEN_DETAIL'; ticker: Ticker }
  | { type: 'MOVE_DETAIL'; direction: -1 | 1 }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'DRAFT'; ticker: Ticker };

export function createDraftState(tickers: readonly Ticker[], rng: SeededRng): DraftState {
  const needed = FANSTOCKS_RULES.draftRounds * FANSTOCKS_RULES.candidatesPerRound;
  if (new Set(tickers).size < needed) throw new Error(`FanStocks needs at least ${needed} unique tickers`);
  const dealt = rng.shuffle([...new Set(tickers)]).slice(0, needed);
  const groups = Array.from({ length: FANSTOCKS_RULES.draftRounds }, (_, index) =>
    Object.freeze(dealt.slice(index * FANSTOCKS_RULES.candidatesPerRound, (index + 1) * FANSTOCKS_RULES.candidatesPerRound)),
  );
  return Object.freeze({ groups: Object.freeze(groups), roundIndex: 0, picks: Object.freeze([]), inspectedTicker: null, status: 'selecting' });
}

export function currentDraftLabel(state: DraftState): string {
  return state.status === 'complete'
    ? 'Draft complete'
    : `Round ${state.roundIndex + 1} of ${FANSTOCKS_RULES.draftRounds} · Pick 1 stock`;
}

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  if (state.status === 'complete') return state;
  const current = state.groups[state.roundIndex];
  if (action.type === 'OPEN_DETAIL') {
    return current.includes(action.ticker) ? Object.freeze({ ...state, inspectedTicker: action.ticker }) : state;
  }
  if (action.type === 'CLOSE_DETAIL') return state.inspectedTicker ? Object.freeze({ ...state, inspectedTicker: null }) : state;
  if (action.type === 'MOVE_DETAIL') {
    if (!state.inspectedTicker) return state;
    const index = current.indexOf(state.inspectedTicker);
    const nextIndex = (index + action.direction + current.length) % current.length;
    return Object.freeze({ ...state, inspectedTicker: current[nextIndex] });
  }
  if (!current.includes(action.ticker) || state.picks.includes(action.ticker)) return state;
  const picks = Object.freeze([...state.picks, action.ticker]);
  const roundIndex = state.roundIndex + 1;
  return Object.freeze({
    ...state,
    picks,
    roundIndex,
    inspectedTicker: null,
    status: roundIndex === FANSTOCKS_RULES.draftRounds ? 'complete' : 'selecting',
  });
}
```

- [ ] **Step 4: Run the focused draft tests and typecheck**

Run: `npm exec vitest run -- src/games/fanstocks/engine/draftReducer.test.ts && npm run typecheck`
Expected: PASS, 4 tests; no mutable-array type errors.

- [ ] **Step 5: Commit the draft state machine**

```bash
git add src/games/fanstocks/engine/rules.ts src/games/fanstocks/engine/draftReducer.ts src/games/fanstocks/engine/draftReducer.test.ts
git commit -m "feat: add three-round FanStocks draft"
```

### Task 3: Complete deterministic AI drafts with three distinct personalities

**Files:**
- Create: `src/games/fanstocks/engine/types.ts`
- Create: `src/games/fanstocks/engine/aiDraft.ts`
- Test: `src/games/fanstocks/engine/aiDraft.test.ts`

**Interfaces:**
- Consumes: foundation `SeededRng`; `StockCard`, `Ticker`, `AiId`, `AI_PERSONALITIES`, `ParticipantId`, and rules.
- Produces: `Portfolio`, `PortfolioMap`, `scoreCardForPersonality(personality, card, currentCards)`, and `completeAiDrafts(playerPicks, cards, rng)`.

- [ ] **Step 1: Write failing tests for deterministic, legal, personality-aware rosters**

```ts
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import { STOCK_BY_TICKER, STOCKS } from '../content/stocks';
import { completeAiDrafts, scoreCardForPersonality } from './aiDraft';

describe('completeAiDrafts', () => {
  it('fills four legal three-card portfolios without creating or losing cards', () => {
    const portfolios = completeAiDrafts(['XLE', 'ODFL', 'IWM'], STOCKS, createSeededRng('roster'));
    const all = Object.values(portfolios).flatMap(({ tickers }) => tickers);
    expect(Object.keys(portfolios)).toEqual(['player', 'momentum', 'contrarian', 'balanced']);
    expect(Object.values(portfolios).every(({ tickers }) => tickers.length === 3)).toBe(true);
    expect(new Set(all).size).toBe(12);
    expect(new Set(all)).toEqual(new Set(STOCKS.map(({ ticker }) => ticker)));
  });

  it('is repeatable for the same seed', () => {
    const run = () => completeAiDrafts(['XLE', 'ODFL', 'IWM'], STOCKS, createSeededRng('same'));
    expect(run()).toEqual(run());
  });

  it('scores SMCI above BMY for Momentum and BMY above SMCI for Contrarian', () => {
    const smci = STOCK_BY_TICKER.get('SMCI')!;
    const bmy = STOCK_BY_TICKER.get('BMY')!;
    expect(scoreCardForPersonality(AI_PERSONALITIES[0], smci, [])).toBeGreaterThan(scoreCardForPersonality(AI_PERSONALITIES[0], bmy, []));
    expect(scoreCardForPersonality(AI_PERSONALITIES[1], bmy, [])).toBeGreaterThan(scoreCardForPersonality(AI_PERSONALITIES[1], smci, []));
  });

  it('rejects an incomplete, duplicate, or unknown player hand', () => {
    expect(() => completeAiDrafts(['XLE', 'XLE', 'IWM'], STOCKS, createSeededRng('bad'))).toThrow('Player draft must contain 3 unique known tickers');
  });
});
```

- [ ] **Step 2: Run the AI draft test and verify failure**

Run: `npm exec vitest run -- src/games/fanstocks/engine/aiDraft.test.ts`
Expected: FAIL because `aiDraft.ts` does not exist.

- [ ] **Step 3: Add portfolio contracts**

```ts
// src/games/fanstocks/engine/types.ts
import type { Ticker } from '../content/types';
import type { ParticipantId } from './rules';

export interface Portfolio {
  readonly participantId: ParticipantId;
  readonly tickers: readonly Ticker[];
}
export type PortfolioMap = Readonly<Record<ParticipantId, Portfolio>>;
```

- [ ] **Step 4: Implement round-robin AI selection and personality scores**

```ts
import type { SeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import type { AiPersonality, StockCard, Ticker } from '../content/types';
import { FANSTOCKS_RULES } from './rules';
import type { PortfolioMap } from './types';

export function scoreCardForPersonality(
  personality: AiPersonality,
  card: StockCard,
  currentCards: readonly StockCard[],
): number {
  const repeatedGroup = currentCards.some(({ correlationGroup }) => correlationGroup === card.correlationGroup);
  const repeatedSector = currentCards.some(({ sector }) => sector === card.sector);
  if (personality.id === 'momentum') return card.momentumBias * 1.8 + card.volatility * 0.8;
  if (personality.id === 'contrarian') return -card.momentumBias * 1.6 + (1 - card.volatility) * 0.4;
  return card.momentumBias * 0.2 - card.volatility * 0.7 + (repeatedGroup ? -0.75 : 0.45) + (repeatedSector ? -0.25 : 0.2);
}

export function completeAiDrafts(
  playerPicks: readonly Ticker[],
  cards: readonly StockCard[],
  rng: SeededRng,
): PortfolioMap {
  const known = new Set(cards.map(({ ticker }) => ticker));
  if (playerPicks.length !== FANSTOCKS_RULES.cardsPerPortfolio || new Set(playerPicks).size !== playerPicks.length || playerPicks.some((ticker) => !known.has(ticker))) {
    throw new Error('Player draft must contain 3 unique known tickers');
  }
  const cardByTicker = new Map(cards.map((card) => [card.ticker, card]));
  const available = new Set(cards.map(({ ticker }) => ticker).filter((ticker) => !playerPicks.includes(ticker)));
  if (available.size !== AI_PERSONALITIES.length * FANSTOCKS_RULES.cardsPerPortfolio) {
    throw new Error('Card registry must leave exactly 9 cards for AI drafts');
  }
  const picks = new Map(AI_PERSONALITIES.map(({ id }) => [id, [] as Ticker[]]));
  const tieOrder = new Map(rng.shuffle([...available]).map((ticker, index) => [ticker, index]));

  for (let slot = 0; slot < FANSTOCKS_RULES.cardsPerPortfolio; slot += 1) {
    for (const personality of AI_PERSONALITIES) {
      const current = picks.get(personality.id)!;
      const chosen = [...available].sort((left, right) => {
        const scoreDelta = scoreCardForPersonality(personality, cardByTicker.get(right)!, current.map((ticker) => cardByTicker.get(ticker)!))
          - scoreCardForPersonality(personality, cardByTicker.get(left)!, current.map((ticker) => cardByTicker.get(ticker)!));
        return scoreDelta || tieOrder.get(left)! - tieOrder.get(right)!;
      })[0];
      current.push(chosen);
      available.delete(chosen);
    }
  }

  return Object.freeze({
    player: Object.freeze({ participantId: 'player', tickers: Object.freeze([...playerPicks]) }),
    momentum: Object.freeze({ participantId: 'momentum', tickers: Object.freeze(picks.get('momentum')!) }),
    contrarian: Object.freeze({ participantId: 'contrarian', tickers: Object.freeze(picks.get('contrarian')!) }),
    balanced: Object.freeze({ participantId: 'balanced', tickers: Object.freeze(picks.get('balanced')!) }),
  });
}
```

- [ ] **Step 5: Run AI/content tests and typecheck**

Run: `npm exec vitest run -- src/games/fanstocks/content src/games/fanstocks/engine/aiDraft.test.ts && npm run typecheck`
Expected: PASS; all twelve cards appear exactly once across the roster.

- [ ] **Step 6: Commit AI roster completion**

```bash
git add src/games/fanstocks/engine/types.ts src/games/fanstocks/engine/aiDraft.ts src/games/fanstocks/engine/aiDraft.test.ts
git commit -m "feat: add personality-driven FanStocks drafts"
```

### Task 4: Build the bounded seeded price engine and compressed week

**Files:**
- Create: `src/games/fanstocks/engine/priceEngine.ts`
- Test: `src/games/fanstocks/engine/priceEngine.test.ts`

**Interfaces:**
- Consumes: foundation `SeededRng`; `StockCard`, `Ticker`, `PortfolioMap`, `FANSTOCKS_RULES`, and `TOTAL_MARKET_TICKS`.
- Produces: `PriceFrame`, `createInitialPriceFrame(cards)`, `advancePriceFrame(previous, cards, sessionRng)`, `portfolioValue(portfolio, frame)`, and `marketLabel(tick)`.

- [ ] **Step 1: Write failing determinism, bounds, and valuation tests**

```ts
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../../shared/rng/seededRng';
import { STOCKS } from '../content/stocks';
import { createInitialPriceFrame, advancePriceFrame, portfolioValue, marketLabel } from './priceEngine';

describe('priceEngine', () => {
  it('starts every three-card portfolio at exactly $50', () => {
    const frame = createInitialPriceFrame(STOCKS);
    expect(portfolioValue({ participantId: 'player', tickers: ['XLE', 'DKNG', 'HUBS'] }, frame)).toBe(50);
  });

  it('generates identical bounded paths for identical seeds', () => {
    const path = () => {
      const rng = createSeededRng('week-1');
      let frame = createInitialPriceFrame(STOCKS);
      const frames = [frame];
      for (let tick = 0; tick < 60; tick += 1) {
        frame = advancePriceFrame(frame, STOCKS, rng);
        frames.push(frame);
      }
      return frames;
    };
    const a = path();
    expect(a).toEqual(path());
    expect(a.flatMap(({ multipliers }) => Object.values(multipliers)).every((value) => value >= 0.65 && value <= 1.45)).toBe(true);
  });

  it('maps ticks to an inspectable five-day label', () => {
    expect(marketLabel(0)).toEqual({ day: 'Monday', tickInDay: 0, closed: false });
    expect(marketLabel(59)).toEqual({ day: 'Friday', tickInDay: 11, closed: false });
    expect(marketLabel(60)).toEqual({ day: 'Friday close', tickInDay: 12, closed: true });
  });
});
```

- [ ] **Step 2: Run the test and verify the missing price engine**

Run: `npm exec vitest run -- src/games/fanstocks/engine/priceEngine.test.ts`
Expected: FAIL with `Failed to resolve import "./priceEngine"`.

- [ ] **Step 3: Implement tick-indexed factor shocks and portfolio valuation**

```ts
import type { SeededRng } from '../../../shared/rng/seededRng';
import type { StockCard, Ticker } from '../content/types';
import { FANSTOCKS_RULES, TOTAL_MARKET_TICKS } from './rules';
import type { Portfolio } from './types';

export interface PriceFrame {
  readonly tick: number;
  readonly multipliers: Readonly<Record<Ticker, number>>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalish = (rng: SeededRng) => (Array.from({ length: 6 }, () => rng.next()).reduce((sum, value) => sum + value, 0) - 3) / 3;
const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function createInitialPriceFrame(cards: readonly StockCard[]): PriceFrame {
  return Object.freeze({ tick: 0, multipliers: Object.freeze(Object.fromEntries(cards.map(({ ticker }) => [ticker, 1]))) });
}

export function advancePriceFrame(previous: PriceFrame, cards: readonly StockCard[], sessionRng: SeededRng): PriceFrame {
  if (previous.tick >= TOTAL_MARKET_TICKS) return previous;
  const tick = previous.tick + 1;
  const tickRng = sessionRng.fork(`market:${tick}`);
  const marketShock = normalish(tickRng.fork('market'));
  const groupShocks = new Map([...new Set(cards.map(({ correlationGroup }) => correlationGroup))]
    .map((group) => [group, normalish(tickRng.fork(`group:${group}`))]));
  const multipliers = Object.fromEntries(cards.map((card) => {
    const stockShock = normalish(tickRng.fork(`stock:${card.ticker}`));
    const rawReturn = card.momentumBias * 0.0006
      + marketShock * 0.006
      + groupShocks.get(card.correlationGroup)! * 0.009
      + stockShock * card.volatility * 0.018;
    const next = clamp(previous.multipliers[card.ticker] * (1 + clamp(rawReturn, -0.035, 0.035)), 0.65, 1.45);
    return [card.ticker, round6(next)];
  }));
  return Object.freeze({ tick, multipliers: Object.freeze(multipliers) });
}

export function portfolioValue(portfolio: Portfolio, frame: PriceFrame): number {
  const average = portfolio.tickers.reduce((sum, ticker) => sum + frame.multipliers[ticker], 0) / portfolio.tickers.length;
  return Math.round(FANSTOCKS_RULES.startingValue * average * 100) / 100;
}

export function marketLabel(tick: number): { day: string; tickInDay: number; closed: boolean } {
  if (tick >= TOTAL_MARKET_TICKS) return { day: 'Friday close', tickInDay: FANSTOCKS_RULES.ticksPerDay, closed: true };
  return { day: DAYS[Math.floor(tick / FANSTOCKS_RULES.ticksPerDay)], tickInDay: tick % FANSTOCKS_RULES.ticksPerDay, closed: false };
}
```

- [ ] **Step 4: Run the engine test twice to verify repeatability**

Run: `npm exec vitest run -- src/games/fanstocks/engine/priceEngine.test.ts && npm exec vitest run -- src/games/fanstocks/engine/priceEngine.test.ts`
Expected: both runs PASS with the same three test names and no snapshots changing.

- [ ] **Step 5: Commit the seeded market week**

```bash
git add src/games/fanstocks/engine/priceEngine.ts src/games/fanstocks/engine/priceEngine.test.ts
git commit -m "feat: add seeded FanStocks market engine"
```

### Task 5: Implement incoming and outgoing one-for-one trades

**Files:**
- Create: `src/games/fanstocks/engine/trades.ts`
- Test: `src/games/fanstocks/engine/trades.test.ts`

**Interfaces:**
- Consumes: `AiId`, `AiPersonality`, `StockCard`, `Ticker`, `PortfolioMap`, `PriceFrame`, `scoreCardForPersonality`, and foundation `SeededRng`.
- Produces: `TradeOffer`, `TradeEvent`, `validateTrade`, `createIncomingTrade`, `createOutgoingTrade`, `decideOutgoingTrade`, and `resolveTrade`.

- [ ] **Step 1: Write failing tests for direction, swaps, pass, invalid cards, and AI response**

```ts
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import { STOCKS } from '../content/stocks';
import { completeAiDrafts } from './aiDraft';
import { createInitialPriceFrame } from './priceEngine';
import { createIncomingTrade, createOutgoingTrade, decideOutgoingTrade, resolveTrade, validateTrade } from './trades';

const portfolios = completeAiDrafts(['XLE', 'ODFL', 'IWM'], STOCKS, createSeededRng('trade-roster'));
const frame = createInitialPriceFrame(STOCKS);

describe('FanStocks trades', () => {
  it('creates a valid incoming offer with explicit player give/receive fields', () => {
    const offer = createIncomingTrade(portfolios, 'momentum', STOCKS, frame, 10, createSeededRng('incoming'));
    expect(offer).not.toBeNull();
    expect(offer).toMatchObject({ direction: 'incoming', opponentId: 'momentum', createdAtTick: 10 });
    expect(validateTrade(portfolios, offer!)).toEqual({ ok: true });
  });

  it('accept swaps exactly two cards and preserves every ticker', () => {
    const offer = createOutgoingTrade(portfolios, 'momentum', portfolios.player.tickers[0], portfolios.momentum.tickers[0], 12);
    const before = Object.values(portfolios).flatMap(({ tickers }) => tickers).sort();
    const resolution = resolveTrade(portfolios, offer, 'accepted');
    const after = Object.values(resolution.portfolios).flatMap(({ tickers }) => tickers).sort();
    expect(resolution.event.status).toBe('accepted');
    expect(resolution.portfolios.player.tickers).toContain(offer.playerReceives);
    expect(resolution.portfolios.momentum.tickers).toContain(offer.playerGives);
    expect(after).toEqual(before);
  });

  it('pass leaves the same portfolio map reference', () => {
    const offer = createOutgoingTrade(portfolios, 'balanced', portfolios.player.tickers[1], portfolios.balanced.tickers[0], 20);
    expect(resolveTrade(portfolios, offer, 'passed').portfolios).toBe(portfolios);
  });

  it('rejects cards not owned by the named sides', () => {
    const invalid = { ...createOutgoingTrade(portfolios, 'balanced', portfolios.player.tickers[0], portfolios.balanced.tickers[0], 4), playerGives: 'ZZZZ' };
    expect(validateTrade(portfolios, invalid)).toEqual({ ok: false, reason: 'Player does not own ZZZZ' });
  });

  it('makes outgoing AI decisions deterministic and personality-sensitive', () => {
    const momentumOffer = { id: 'm', direction: 'outgoing' as const, opponentId: 'momentum' as const, playerGives: 'SMCI', playerReceives: 'BMY', createdAtTick: 8 };
    const contrarianOffer = { ...momentumOffer, id: 'c', opponentId: 'contrarian' as const };
    expect(decideOutgoingTrade(momentumOffer, AI_PERSONALITIES[0], STOCKS, createSeededRng('decision'))).toBe('accepted');
    expect(decideOutgoingTrade(contrarianOffer, AI_PERSONALITIES[1], STOCKS, createSeededRng('decision'))).toBe('rejected');
  });
});
```

- [ ] **Step 2: Run the trade test and verify the missing module**

Run: `npm exec vitest run -- src/games/fanstocks/engine/trades.test.ts`
Expected: FAIL with `Failed to resolve import "./trades"`.

- [ ] **Step 3: Define explicit trade records and validation**

```ts
import type { SeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import type { AiId, AiPersonality, StockCard, Ticker } from '../content/types';
import { scoreCardForPersonality } from './aiDraft';
import type { PriceFrame } from './priceEngine';
import type { PortfolioMap } from './types';

export interface TradeOffer {
  readonly id: string;
  readonly direction: 'incoming' | 'outgoing';
  readonly opponentId: AiId;
  readonly playerGives: Ticker;
  readonly playerReceives: Ticker;
  readonly createdAtTick: number;
}
export interface TradeEvent extends TradeOffer { readonly status: 'accepted' | 'passed' | 'rejected' }
export type TradeValidation = { ok: true } | { ok: false; reason: string };

export function validateTrade(portfolios: PortfolioMap, offer: TradeOffer): TradeValidation {
  if (offer.playerGives === offer.playerReceives) return { ok: false, reason: 'Trade cards must be different' };
  if (!portfolios.player.tickers.includes(offer.playerGives)) return { ok: false, reason: `Player does not own ${offer.playerGives}` };
  if (!portfolios[offer.opponentId].tickers.includes(offer.playerReceives)) return { ok: false, reason: `${offer.opponentId} does not own ${offer.playerReceives}` };
  return { ok: true };
}

export function createOutgoingTrade(
  portfolios: PortfolioMap,
  opponentId: AiId,
  playerGives: Ticker,
  playerReceives: Ticker,
  createdAtTick: number,
): TradeOffer {
  const offer = Object.freeze({ id: `out-${createdAtTick}-${opponentId}-${playerGives}-${playerReceives}`, direction: 'outgoing' as const, opponentId, playerGives, playerReceives, createdAtTick });
  const validation = validateTrade(portfolios, offer);
  if (!validation.ok) throw new Error(validation.reason);
  return offer;
}
```

- [ ] **Step 4: Implement proposal choice, AI evaluation, and immutable swap**

```ts
export function createIncomingTrade(
  portfolios: PortfolioMap,
  opponentId: AiId,
  cards: readonly StockCard[],
  frame: PriceFrame,
  createdAtTick: number,
  rng: SeededRng,
): TradeOffer | null {
  const byTicker = new Map(cards.map((card) => [card.ticker, card]));
  const personality = AI_PERSONALITIES.find(({ id }) => id === opponentId)!;
  const current = portfolios[opponentId].tickers.map((ticker) => byTicker.get(ticker)!);
  const tieOrder = new Map(rng.shuffle([...portfolios.player.tickers, ...portfolios[opponentId].tickers]).map((ticker, index) => [ticker, index]));
  const wanted = [...portfolios.player.tickers].sort((a, b) =>
    scoreCardForPersonality(personality, byTicker.get(b)!, current) - scoreCardForPersonality(personality, byTicker.get(a)!, current)
    || tieOrder.get(a)! - tieOrder.get(b)!,
  )[0];
  const offered = [...portfolios[opponentId].tickers].sort((a, b) =>
    scoreCardForPersonality(personality, byTicker.get(a)!, current) - scoreCardForPersonality(personality, byTicker.get(b)!, current)
    || tieOrder.get(a)! - tieOrder.get(b)!,
  )[0];
  if (!wanted || !offered || frame.multipliers[wanted] === undefined || frame.multipliers[offered] === undefined) return null;
  return Object.freeze({ id: `in-${createdAtTick}-${opponentId}-${wanted}-${offered}`, direction: 'incoming', opponentId, playerGives: wanted, playerReceives: offered, createdAtTick });
}

export function decideOutgoingTrade(
  offer: TradeOffer,
  personality: AiPersonality,
  cards: readonly StockCard[],
  rng: SeededRng,
): 'accepted' | 'rejected' {
  const byTicker = new Map(cards.map((card) => [card.ticker, card]));
  const scoreReceived = scoreCardForPersonality(personality, byTicker.get(offer.playerGives)!, []);
  const scoreGiven = scoreCardForPersonality(personality, byTicker.get(offer.playerReceives)!, []);
  const jitter = rng.fork(offer.id).next() * 0.02 - 0.01;
  return scoreReceived - scoreGiven + jitter >= personality.tradeThreshold ? 'accepted' : 'rejected';
}

export function resolveTrade(
  portfolios: PortfolioMap,
  offer: TradeOffer,
  status: TradeEvent['status'],
): { portfolios: PortfolioMap; event: TradeEvent } {
  const validation = validateTrade(portfolios, offer);
  if (!validation.ok) throw new Error(validation.reason);
  const event = Object.freeze({ ...offer, status });
  if (status !== 'accepted') return { portfolios, event };
  const player = Object.freeze({ ...portfolios.player, tickers: Object.freeze(portfolios.player.tickers.map((ticker) => ticker === offer.playerGives ? offer.playerReceives : ticker)) });
  const opponent = Object.freeze({ ...portfolios[offer.opponentId], tickers: Object.freeze(portfolios[offer.opponentId].tickers.map((ticker) => ticker === offer.playerReceives ? offer.playerGives : ticker)) });
  return { portfolios: Object.freeze({ ...portfolios, player, [offer.opponentId]: opponent }), event };
}
```

- [ ] **Step 5: Run trade, draft, and AI tests**

Run: `npm exec vitest run -- src/games/fanstocks/engine/trades.test.ts src/games/fanstocks/engine/draftReducer.test.ts src/games/fanstocks/engine/aiDraft.test.ts && npm run typecheck`
Expected: PASS, 12 tests; typecheck exits `0`.

- [ ] **Step 6: Commit trading mechanics**

```bash
git add src/games/fanstocks/engine/trades.ts src/games/fanstocks/engine/trades.test.ts
git commit -m "feat: add one-for-one FanStocks trades"
```

### Task 6: Rank portfolios, handle ties, and build explainable Friday-close results

**Files:**
- Create: `src/games/fanstocks/engine/ranking.ts`
- Test: `src/games/fanstocks/engine/ranking.test.ts`

**Interfaces:**
- Consumes: `PortfolioMap`, `PriceFrame`, `TradeEvent`, `portfolioValue`, and stable `PARTICIPANT_ORDER`.
- Produces: `RankedPortfolio`, `FanStocksResult`, `rankPortfolios(portfolios, frame)`, and `buildFanStocksResult(portfolios, frame, tradeLog)`.

- [ ] **Step 1: Write failing tests for exact ranks, ties, decisive picks, and trades**

```ts
import { describe, expect, it } from 'vitest';
import type { PortfolioMap } from './types';
import { buildFanStocksResult, rankPortfolios } from './ranking';

const portfolios: PortfolioMap = {
  player: { participantId: 'player', tickers: ['XLE', 'DKNG', 'HUBS'] },
  momentum: { participantId: 'momentum', tickers: ['AMZN', 'ODFL', 'SBUX'] },
  contrarian: { participantId: 'contrarian', tickers: ['LOW', 'MPC', 'IWM'] },
  balanced: { participantId: 'balanced', tickers: ['SMCI', 'CTRI', 'BMY'] },
};

describe('rankPortfolios', () => {
  it('uses displayed cents and competition ranks for ties', () => {
    const frame = { tick: 60, multipliers: {
      XLE: 1.1, DKNG: 1, HUBS: 1, AMZN: 1.1, ODFL: 1, SBUX: 1,
      LOW: 0.95, MPC: 1, IWM: 1, SMCI: 0.9, CTRI: 1, BMY: 1,
    } };
    const rows = rankPortfolios(portfolios, frame);
    expect(rows.map(({ participantId, rank, value }) => [participantId, rank, value])).toEqual([
      ['player', 1, 51.67], ['momentum', 1, 51.67], ['contrarian', 3, 49.17], ['balanced', 4, 48.33],
    ]);
  });

  it('reports all top winners and each participant’s strongest closing card', () => {
    const frame = { tick: 60, multipliers: Object.fromEntries(Object.values(portfolios).flatMap(({ tickers }) => tickers.map((ticker) => [ticker, ticker === 'SMCI' ? 1.2 : 1]))) };
    const result = buildFanStocksResult(portfolios, frame, []);
    expect(result.winnerIds).toEqual(['balanced']);
    expect(result.isTie).toBe(false);
    expect(result.rows.find(({ participantId }) => participantId === 'balanced')?.decisiveTicker).toBe('SMCI');
  });

  it('includes accepted trades and omits passed/rejected trades from decisive trade recap', () => {
    const frame = { tick: 60, multipliers: Object.fromEntries(Object.values(portfolios).flatMap(({ tickers }) => tickers.map((ticker) => [ticker, 1]))) };
    const accepted = { id: 'a', direction: 'incoming' as const, opponentId: 'momentum' as const, playerGives: 'XLE', playerReceives: 'AMZN', createdAtTick: 10, status: 'accepted' as const };
    const passed = { ...accepted, id: 'p', status: 'passed' as const };
    expect(buildFanStocksResult(portfolios, frame, [accepted, passed]).acceptedTrades).toEqual([accepted]);
  });
});
```

- [ ] **Step 2: Run the ranking test and verify failure**

Run: `npm exec vitest run -- src/games/fanstocks/engine/ranking.test.ts`
Expected: FAIL because `ranking.ts` is absent.

- [ ] **Step 3: Implement stable cent-based competition ranking**

```ts
import type { ParticipantId } from './rules';
import { PARTICIPANT_ORDER } from './rules';
import type { PriceFrame } from './priceEngine';
import { portfolioValue } from './priceEngine';
import type { TradeEvent } from './trades';
import type { PortfolioMap } from './types';

export interface RankedPortfolio {
  readonly participantId: ParticipantId;
  readonly rank: number;
  readonly value: number;
  readonly returnPercent: number;
  readonly decisiveTicker: string;
  readonly tied: boolean;
}
export interface FanStocksResult {
  readonly rows: readonly RankedPortfolio[];
  readonly winnerIds: readonly ParticipantId[];
  readonly isTie: boolean;
  readonly acceptedTrades: readonly TradeEvent[];
}

export function rankPortfolios(portfolios: PortfolioMap, frame: PriceFrame): readonly RankedPortfolio[] {
  const rows = PARTICIPANT_ORDER.map((participantId) => {
    const portfolio = portfolios[participantId];
    const value = portfolioValue(portfolio, frame);
    const decisiveTicker = [...portfolio.tickers].sort((a, b) => frame.multipliers[b] - frame.multipliers[a] || a.localeCompare(b))[0];
    return { participantId, value, returnPercent: Math.round((value / 50 - 1) * 10_000) / 100, decisiveTicker };
  }).sort((a, b) => b.value - a.value || PARTICIPANT_ORDER.indexOf(a.participantId) - PARTICIPANT_ORDER.indexOf(b.participantId));

  return Object.freeze(rows.map((row) => {
    const rank = rows.findIndex((candidate) => candidate.value === row.value) + 1;
    const tied = rows.some((candidate) => candidate.participantId !== row.participantId && candidate.value === row.value);
    return Object.freeze({ ...row, rank, tied });
  }));
}

export function buildFanStocksResult(
  portfolios: PortfolioMap,
  frame: PriceFrame,
  tradeLog: readonly TradeEvent[],
): FanStocksResult {
  const rows = rankPortfolios(portfolios, frame);
  const winnerIds = Object.freeze(rows.filter(({ rank }) => rank === 1).map(({ participantId }) => participantId));
  return Object.freeze({
    rows,
    winnerIds,
    isTie: winnerIds.length > 1,
    acceptedTrades: Object.freeze(tradeLog.filter(({ status }) => status === 'accepted')),
  });
}
```

- [ ] **Step 4: Run ranking and price tests**

Run: `npm exec vitest run -- src/games/fanstocks/engine/ranking.test.ts src/games/fanstocks/engine/priceEngine.test.ts && npm run typecheck`
Expected: PASS, 6 tests; tied leaders both have rank `1` and the next row has rank `3`.

- [ ] **Step 5: Commit result calculation**

```bash
git add src/games/fanstocks/engine/ranking.ts src/games/fanstocks/engine/ranking.test.ts
git commit -m "feat: rank FanStocks Friday results"
```

### Task 7: Compose the complete deterministic FanStocks reducer

**Files:**
- Create: `src/games/fanstocks/engine/fanStocksReducer.ts`
- Test: `src/games/fanstocks/engine/fanStocksReducer.test.ts`

**Interfaces:**
- Consumes: all Tasks 1–6 engine/content exports and foundation `createSeededRng`.
- Produces: `FanStocksPhase`, `MarketSpeed`, `FanStocksState`, `FanStocksAction`, `createFanStocksState(seed)`, and `fanStocksReducer(state, action)`.

- [ ] **Step 1: Write one reducer test per phase boundary and market invariant**

```ts
import { describe, expect, it } from 'vitest';
import { TOTAL_MARKET_TICKS } from './rules';
import { createFanStocksState, fanStocksReducer } from './fanStocksReducer';

function draftFirstCardEachRound(seed = 'flow') {
  let state = fanStocksReducer(createFanStocksState(seed), { type: 'START_LEAGUE' });
  state = fanStocksReducer(state, { type: 'DISMISS_TUTORIAL' });
  for (let round = 0; round < 3; round += 1) {
    state = fanStocksReducer(state, { type: 'DRAFT', ticker: state.draft.groups[round][0] });
  }
  return state;
}

describe('fanStocksReducer', () => {
  it('moves intro → tutorial → three draft rounds → AI drafting → market', () => {
    let state = draftFirstCardEachRound();
    expect(state.phase).toBe('ai-drafting');
    state = fanStocksReducer(state, { type: 'AI_DRAFTS_READY' });
    expect(state.phase).toBe('market');
    expect(Object.values(state.portfolios!).every(({ tickers }) => tickers.length === 3)).toBe(true);
    expect(state.priceHistory).toHaveLength(1);
  });

  it('pauses the engine and blocks ticks while a trade is pending', () => {
    let state = fanStocksReducer(draftFirstCardEachRound('pause'), { type: 'AI_DRAFTS_READY' });
    state = fanStocksReducer(state, { type: 'SET_PAUSED', paused: true });
    expect(fanStocksReducer(state, { type: 'MARKET_TICK' })).toBe(state);
    state = fanStocksReducer(state, { type: 'SET_PAUSED', paused: false });
    for (let tick = 0; tick < 10; tick += 1) state = fanStocksReducer(state, { type: 'MARKET_TICK' });
    expect(state.pendingTrade?.direction).toBe('incoming');
    expect(fanStocksReducer(state, { type: 'MARKET_TICK' })).toBe(state);
  });

  it('accepts incoming trades and records outgoing AI decisions', () => {
    let state = fanStocksReducer(draftFirstCardEachRound('trade-flow'), { type: 'AI_DRAFTS_READY' });
    for (let tick = 0; tick < 10; tick += 1) state = fanStocksReducer(state, { type: 'MARKET_TICK' });
    const received = state.pendingTrade!.playerReceives;
    state = fanStocksReducer(state, { type: 'DECIDE_INCOMING', decision: 'accepted' });
    expect(state.portfolios!.player.tickers).toContain(received);
    const opponentId = 'balanced';
    state = fanStocksReducer(state, { type: 'SUBMIT_OUTGOING', opponentId, playerGives: state.portfolios!.player.tickers[0], playerReceives: state.portfolios![opponentId].tickers[0] });
    expect(state.tradeLog.at(-1)?.direction).toBe('outgoing');
  });

  it('closes on tick 60, produces results, and rematches with a derived seed', () => {
    let state = fanStocksReducer(draftFirstCardEachRound('close'), { type: 'AI_DRAFTS_READY' });
    while (state.phase === 'market') {
      if (state.pendingTrade) state = fanStocksReducer(state, { type: 'DECIDE_INCOMING', decision: 'passed' });
      else state = fanStocksReducer(state, { type: 'MARKET_TICK' });
    }
    expect(state.priceHistory.at(-1)?.tick).toBe(TOTAL_MARKET_TICKS);
    expect(state.phase).toBe('results');
    expect(state.result?.rows).toHaveLength(4);
    const rematch = fanStocksReducer(state, { type: 'REMATCH' });
    expect(rematch).toMatchObject({ phase: 'draft', rematchIndex: 1, tutorialSeen: true });
    expect(rematch.seed).toBe('close:rematch:1');
  });

  it('returns the identical state for actions invalid in the current phase', () => {
    const state = createFanStocksState('invalid');
    expect(fanStocksReducer(state, { type: 'MARKET_TICK' })).toBe(state);
  });
});
```

- [ ] **Step 2: Run the reducer test and verify the red state**

Run: `npm exec vitest run -- src/games/fanstocks/engine/fanStocksReducer.test.ts`
Expected: FAIL because `fanStocksReducer.ts` does not exist.

- [ ] **Step 3: Define the state and action union exactly**

```ts
import type { AiId, Ticker } from '../content/types';
import type { DraftState } from './draftReducer';
import type { PriceFrame } from './priceEngine';
import type { FanStocksResult } from './ranking';
import type { TradeEvent, TradeOffer } from './trades';
import type { PortfolioMap } from './types';

export type FanStocksPhase = 'intro' | 'tutorial' | 'draft' | 'ai-drafting' | 'market' | 'results';
export type MarketSpeed = 1 | 2 | 4;
export interface FanStocksState {
  readonly schemaVersion: 1;
  readonly rulesetVersion: 1;
  readonly seed: string;
  readonly rematchIndex: number;
  readonly phase: FanStocksPhase;
  readonly tutorialSeen: boolean;
  readonly draft: DraftState;
  readonly portfolios: PortfolioMap | null;
  readonly priceHistory: readonly PriceFrame[];
  readonly paused: boolean;
  readonly speed: MarketSpeed;
  readonly pendingTrade: TradeOffer | null;
  readonly tradeLog: readonly TradeEvent[];
  readonly result: FanStocksResult | null;
}
export type FanStocksAction =
  | { type: 'START_LEAGUE' }
  | { type: 'DISMISS_TUTORIAL' }
  | { type: 'OPEN_DETAIL'; ticker: Ticker }
  | { type: 'MOVE_DETAIL'; direction: -1 | 1 }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'DRAFT'; ticker: Ticker }
  | { type: 'AI_DRAFTS_READY' }
  | { type: 'MARKET_TICK' }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_SPEED'; speed: MarketSpeed }
  | { type: 'DECIDE_INCOMING'; decision: 'accepted' | 'passed' }
  | { type: 'SUBMIT_OUTGOING'; opponentId: AiId; playerGives: Ticker; playerReceives: Ticker }
  | { type: 'REMATCH' }
  | { type: 'NEW_LEAGUE'; seed: string };
```

- [ ] **Step 4: Implement initial state, draft delegation, AI completion, and trade actions**

```ts
import { createSeededRng } from '../../../shared/rng/seededRng';
import { AI_PERSONALITIES } from '../content/personalities';
import { STOCKS } from '../content/stocks';
import { completeAiDrafts } from './aiDraft';
import { createDraftState, draftReducer } from './draftReducer';
import { advancePriceFrame, createInitialPriceFrame } from './priceEngine';
import { buildFanStocksResult } from './ranking';
import { FANSTOCKS_RULES, TOTAL_MARKET_TICKS } from './rules';
import { createIncomingTrade, createOutgoingTrade, decideOutgoingTrade, resolveTrade } from './trades';

export function createFanStocksState(seed: string): FanStocksState {
  if (!seed.trim()) throw new Error('FanStocks seed must be non-empty');
  return Object.freeze({
    schemaVersion: 1, rulesetVersion: 1, seed, rematchIndex: 0,
    phase: 'intro', tutorialSeen: false,
    draft: createDraftState(STOCKS.map(({ ticker }) => ticker), createSeededRng(seed).fork('draft')),
    portfolios: null, priceHistory: Object.freeze([]), paused: false, speed: 1,
    pendingTrade: null, tradeLog: Object.freeze([]), result: null,
  });
}

function completeDraft(state: FanStocksState): FanStocksState {
  const portfolios = completeAiDrafts(state.draft.picks, STOCKS, createSeededRng(state.seed).fork('ai-draft'));
  return Object.freeze({ ...state, phase: 'market', portfolios, priceHistory: Object.freeze([createInitialPriceFrame(STOCKS)]) });
}

function handleTradeDecision(state: FanStocksState, decision: 'accepted' | 'passed'): FanStocksState {
  if (state.phase !== 'market' || !state.pendingTrade || !state.portfolios) return state;
  const resolution = resolveTrade(state.portfolios, state.pendingTrade, decision);
  return Object.freeze({ ...state, portfolios: resolution.portfolios, pendingTrade: null, tradeLog: Object.freeze([...state.tradeLog, resolution.event]) });
}
```

- [ ] **Step 5: Implement the reducer switch, scheduled offers, close, and rematch**

```ts
export function fanStocksReducer(state: FanStocksState, action: FanStocksAction): FanStocksState {
  if (action.type === 'NEW_LEAGUE') return createFanStocksState(action.seed);
  if (action.type === 'START_LEAGUE' && state.phase === 'intro') return Object.freeze({ ...state, phase: state.tutorialSeen ? 'draft' : 'tutorial' });
  if (action.type === 'DISMISS_TUTORIAL' && state.phase === 'tutorial') return Object.freeze({ ...state, phase: 'draft', tutorialSeen: true });
  if (['OPEN_DETAIL', 'MOVE_DETAIL', 'CLOSE_DETAIL', 'DRAFT'].includes(action.type) && state.phase === 'draft') {
    const draft = draftReducer(state.draft, action as Parameters<typeof draftReducer>[1]);
    if (draft === state.draft) return state;
    return Object.freeze({ ...state, draft, phase: draft.status === 'complete' ? 'ai-drafting' : 'draft' });
  }
  if (action.type === 'AI_DRAFTS_READY' && state.phase === 'ai-drafting') return completeDraft(state);
  if (action.type === 'SET_PAUSED' && state.phase === 'market') return Object.freeze({ ...state, paused: action.paused });
  if (action.type === 'SET_SPEED' && state.phase === 'market' && ([1, 2, 4] as const).includes(action.speed)) return Object.freeze({ ...state, speed: action.speed });
  if (action.type === 'DECIDE_INCOMING') return handleTradeDecision(state, action.decision);
  if (action.type === 'SUBMIT_OUTGOING' && state.phase === 'market' && state.portfolios && !state.pendingTrade) {
    const offer = createOutgoingTrade(state.portfolios, action.opponentId, action.playerGives, action.playerReceives, state.priceHistory.at(-1)!.tick);
    const personality = AI_PERSONALITIES.find(({ id }) => id === action.opponentId)!;
    const status = decideOutgoingTrade(offer, personality, STOCKS, createSeededRng(state.seed).fork(`trade:${offer.id}`));
    const resolution = resolveTrade(state.portfolios, offer, status);
    return Object.freeze({ ...state, portfolios: resolution.portfolios, tradeLog: Object.freeze([...state.tradeLog, resolution.event]) });
  }
  if (action.type === 'MARKET_TICK' && state.phase === 'market' && !state.paused && !state.pendingTrade && state.portfolios) {
    const previous = state.priceHistory.at(-1)!;
    const frame = advancePriceFrame(previous, STOCKS, createSeededRng(state.seed).fork('prices'));
    const priceHistory = Object.freeze([...state.priceHistory, frame]);
    if (frame.tick >= TOTAL_MARKET_TICKS) {
      return Object.freeze({ ...state, phase: 'results', priceHistory, paused: true, result: buildFanStocksResult(state.portfolios, frame, state.tradeLog) });
    }
    const offerIndex = FANSTOCKS_RULES.incomingTradeTicks.indexOf(frame.tick as 10 | 25 | 40);
    const opponent = offerIndex >= 0 ? AI_PERSONALITIES[offerIndex] : undefined;
    const pendingTrade = opponent
      ? createIncomingTrade(state.portfolios, opponent.id, STOCKS, frame, frame.tick, createSeededRng(state.seed).fork(`incoming:${frame.tick}`))
      : null;
    return Object.freeze({ ...state, priceHistory, pendingTrade });
  }
  if (action.type === 'REMATCH' && state.phase === 'results') {
    const rematchIndex = state.rematchIndex + 1;
    const next = createFanStocksState(`${state.seed}:rematch:${rematchIndex}`);
    return Object.freeze({ ...next, phase: 'draft', tutorialSeen: true, rematchIndex });
  }
  return state;
}
```

- [ ] **Step 6: Run all pure FanStocks engine tests**

Run: `npm exec vitest run -- src/games/fanstocks/content src/games/fanstocks/engine && npm run typecheck`
Expected: PASS; the full-flow test reaches tick `60`, creates four result rows, and never waits on wall-clock time.

- [ ] **Step 7: Commit the composed reducer**

```bash
git add src/games/fanstocks/engine/fanStocksReducer.ts src/games/fanstocks/engine/fanStocksReducer.test.ts
git commit -m "feat: compose deterministic FanStocks league reducer"
```

### Task 8: Add recoverable versioned persistence and hub progress

**Files:**
- Create: `src/games/fanstocks/persistence/fanStocksSave.ts`
- Test: `src/games/fanstocks/persistence/fanStocksSave.test.ts`

**Interfaces:**
- Consumes: foundation `GameSaveCodec`, `createGameStore`, and `GameProgressBadge`; `FanStocksState`, `STOCK_BY_TICKER`, `TOTAL_MARKET_TICKS`, and `marketLabel`.
- Produces: `FanStocksSaveV1`, `fanStocksSaveCodec`, `fanStocksStore`, `createFanStocksSave(state, savedAt)`, `getFanStocksProgressBadge()`, and `resetFanStocksProgress()`.

- [ ] **Step 1: Write failing codec, corruption, compatibility, progress, and reset tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createFanStocksState } from '../engine/fanStocksReducer';
import { createFanStocksSave, fanStocksSaveCodec, fanStocksStore, getFanStocksProgressBadge, resetFanStocksProgress } from './fanStocksSave';

describe('fanStocksSave', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a version-one state without changing it', () => {
    const save = createFanStocksSave(createFanStocksState('save-seed'), '2026-07-21T00:00:00.000Z');
    const decoded = fanStocksSaveCodec.decode(fanStocksSaveCodec.encode(save));
    expect(decoded).toEqual({ ok: true, value: save });
  });

  it('distinguishes incompatible rules from corrupt state', () => {
    const save = fanStocksSaveCodec.encode(createFanStocksSave(createFanStocksState('bad'), '2026-07-21T00:00:00.000Z')) as Record<string, unknown>;
    expect(fanStocksSaveCodec.decode({ ...save, rulesetVersion: 2 })).toEqual({ ok: false, reason: 'incompatible' });
    expect(fanStocksSaveCodec.decode({ ...save, state: { phase: 'market', seed: '' } })).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('returns active and complete hub labels from saved state', () => {
    fanStocksStore.save(createFanStocksSave({ ...createFanStocksState('active'), phase: 'draft' }, '2026-07-21T00:00:00.000Z'));
    expect(getFanStocksProgressBadge()).toEqual({ label: 'FanStocks', value: 'Draft round 1 of 3', tone: 'positive' });
    fanStocksStore.save(createFanStocksSave({ ...createFanStocksState('done'), phase: 'results' }, '2026-07-21T00:00:00.000Z'));
    expect(getFanStocksProgressBadge()).toEqual({ label: 'FanStocks', value: 'League complete', tone: 'positive' });
  });

  it('clears only the FanStocks save key', () => {
    localStorage.setItem('unrelated', 'keep');
    fanStocksStore.save(createFanStocksSave(createFanStocksState('clear'), '2026-07-21T00:00:00.000Z'));
    resetFanStocksProgress();
    expect(fanStocksStore.load()).toEqual({ status: 'empty' });
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
});
```

- [ ] **Step 2: Run the save test and verify failure**

Run: `npm exec vitest run -- src/games/fanstocks/persistence/fanStocksSave.test.ts`
Expected: FAIL because `fanStocksSave.ts` does not exist.

- [ ] **Step 3: Implement the save envelope and structural decoder**

```ts
import { createGameStore, type GameSaveDecodeResult, type GameSaveCodec } from '../../../shared/persistence/gameStore';
import type { GameProgressBadge } from '../../../app/routes/types';
import { STOCK_BY_TICKER } from '../content/stocks';
import type { FanStocksState } from '../engine/fanStocksReducer';
import { marketLabel } from '../engine/priceEngine';
import { TOTAL_MARKET_TICKS } from '../engine/rules';

export interface FanStocksSaveV1 {
  readonly schemaVersion: 1;
  readonly rulesetVersion: 1;
  readonly savedAt: string;
  readonly state: FanStocksState;
}

const phases = new Set(['intro', 'tutorial', 'draft', 'ai-drafting', 'market', 'results']);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function validState(value: unknown): value is FanStocksState {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.rulesetVersion !== 1 || typeof value.seed !== 'string' || !value.seed || !phases.has(String(value.phase))) return false;
  if (!isRecord(value.draft) || !Array.isArray(value.draft.picks) || value.draft.picks.length > 3 || new Set(value.draft.picks).size !== value.draft.picks.length) return false;
  if (value.draft.picks.some((ticker) => typeof ticker !== 'string' || !STOCK_BY_TICKER.has(ticker))) return false;
  if (!Array.isArray(value.priceHistory) || value.priceHistory.length > TOTAL_MARKET_TICKS + 1) return false;
  for (let index = 0; index < value.priceHistory.length; index += 1) {
    const frame = value.priceHistory[index];
    if (!isRecord(frame) || frame.tick !== index || !isRecord(frame.multipliers)) return false;
    if (Object.values(frame.multipliers).some((multiplier) => typeof multiplier !== 'number' || !Number.isFinite(multiplier) || multiplier < 0.65 || multiplier > 1.45)) return false;
  }
  if (value.portfolios !== null) {
    if (!isRecord(value.portfolios)) return false;
    const hands = ['player', 'momentum', 'contrarian', 'balanced'].map((id) => isRecord(value.portfolios) ? value.portfolios[id] : null);
    if (hands.some((hand) => !isRecord(hand) || !Array.isArray(hand.tickers) || hand.tickers.length !== 3)) return false;
    const tickers = hands.flatMap((hand) => isRecord(hand) && Array.isArray(hand.tickers) ? hand.tickers : []);
    if (tickers.some((ticker) => typeof ticker !== 'string' || !STOCK_BY_TICKER.has(ticker)) || new Set(tickers).size !== 12) return false;
  }
  return true;
}

export const fanStocksSaveCodec: GameSaveCodec<FanStocksSaveV1> = {
  key: 'opentrade.fanstocks',
  version: 1,
  encode: (value) => value,
  decode(raw): GameSaveDecodeResult<FanStocksSaveV1> {
    if (!isRecord(raw)) return { ok: false, reason: 'corrupt' };
    if (raw.schemaVersion !== 1 || raw.rulesetVersion !== 1) return { ok: false, reason: 'incompatible' };
    if (typeof raw.savedAt !== 'string' || Number.isNaN(Date.parse(raw.savedAt)) || !validState(raw.state)) return { ok: false, reason: 'corrupt' };
    if (raw.state.seed !== raw.state.seed.trim()) return { ok: false, reason: 'corrupt' };
    return { ok: true, value: raw as unknown as FanStocksSaveV1 };
  },
};

export const fanStocksStore = createGameStore(fanStocksSaveCodec);
export const createFanStocksSave = (state: FanStocksState, savedAt: string): FanStocksSaveV1 => Object.freeze({ schemaVersion: 1, rulesetVersion: 1, savedAt, state });
```

- [ ] **Step 4: Implement hub progress and isolated reset**

```ts
export function getFanStocksProgressBadge(): GameProgressBadge | null {
  const loaded = fanStocksStore.load();
  if (loaded.status === 'empty') return null;
  if (loaded.status === 'recovery-required') return { label: 'FanStocks', value: 'Progress needs reset', tone: 'warning' };
  const state = loaded.value.state;
  if (state.phase === 'results') return { label: 'FanStocks', value: 'League complete', tone: 'positive' };
  if (state.phase === 'draft' || state.phase === 'ai-drafting') {
    return { label: 'FanStocks', value: `Draft round ${Math.min(state.draft.roundIndex + 1, 3)} of 3`, tone: 'positive' };
  }
  if (state.phase === 'market') {
    return { label: 'FanStocks', value: `${marketLabel(state.priceHistory.at(-1)?.tick ?? 0).day} market`, tone: 'positive' };
  }
  return { label: 'FanStocks', value: 'League ready', tone: 'positive' };
}

export function resetFanStocksProgress(): void {
  fanStocksStore.clear();
}
```

- [ ] **Step 5: Run persistence, reducer, and type tests**

Run: `npm exec vitest run -- src/games/fanstocks/persistence src/games/fanstocks/engine/fanStocksReducer.test.ts && npm run typecheck`
Expected: PASS; corrupt data returns a recoverable status instead of throwing.

- [ ] **Step 6: Commit the save boundary**

```bash
git add src/games/fanstocks/persistence
git commit -m "feat: persist and recover FanStocks leagues"
```

### Task 9: Build the URL-, clock-, visibility-, toast-, and save-aware controller

**Files:**
- Create: `src/games/fanstocks/useFanStocksController.ts`
- Test: `src/games/fanstocks/useFanStocksController.test.tsx`

**Interfaces:**
- Consumes: foundation `parseChallenge`, `formatChallenge`, `createGuestSeed`, `useSettings`, `useToasts`; reducer and persistence exports.
- Produces: `FanStocksController`, `useFanStocksController()`, stable action callbacks, `lastAcceptedTrade`, and recoverable `saveProblem`.

- [ ] **Step 1: Write failing hook tests for challenge priority, autosave, timers, visibility, and notifications**

```tsx
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fanStocksStore } from './persistence/fanStocksSave';
import { useFanStocksController } from './useFanStocksController';

const wrapper = ({ children }: React.PropsWithChildren) => <MemoryRouter initialEntries={['/fanstocks?seed=hook-seed&rules=1']}>{children}</MemoryRouter>;

describe('useFanStocksController', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });

  it('uses an explicit compatible challenge instead of a different saved seed', () => {
    const { result } = renderHook(() => useFanStocksController(), { wrapper });
    expect(result.current.state.seed).toBe('hook-seed');
  });

  it('autosaves state with an ISO timestamp after a transition', () => {
    const { result } = renderHook(() => useFanStocksController(), { wrapper });
    act(() => result.current.startLeague());
    expect(fanStocksStore.load()).toMatchObject({ status: 'ready', value: { state: { phase: 'tutorial' } } });
  });

  it('ticks only after the speed-adjusted delay and never catches up after a hidden tab', () => {
    const { result } = renderHook(() => useFanStocksController(), { wrapper });
    act(() => result.current.startLeague());
    act(() => result.current.dismissTutorial());
    for (let round = 0; round < 3; round += 1) act(() => result.current.draft(result.current.state.draft.groups[round][0]));
    act(() => vi.advanceTimersByTime(650));
    act(() => result.current.setSpeed(4));
    act(() => vi.advanceTimersByTime(1_249));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.state.priceHistory.at(-1)?.tick).toBe(1);
  });
});
```

- [ ] **Step 2: Run the hook test and verify failure**

Run: `npm exec vitest run -- src/games/fanstocks/useFanStocksController.test.tsx`
Expected: FAIL because `useFanStocksController.ts` does not exist.

- [ ] **Step 3: Implement deterministic initialization, autosave, challenge URL, and public callbacks**

```tsx
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createGuestSeed, formatChallenge, parseChallenge } from '../../shared/routing/challenge';
import { useSettings } from '../../shared/settings/SettingsContext';
import { useToasts } from '../../shared/ui/ToastContext';
import type { AiId, Ticker } from './content/types';
import { createFanStocksState, fanStocksReducer, type FanStocksState, type MarketSpeed } from './engine/fanStocksReducer';
import { FANSTOCKS_RULES } from './engine/rules';
import type { TradeEvent } from './engine/trades';
import { createFanStocksSave, fanStocksStore } from './persistence/fanStocksSave';

function loadInitialState(search: string): { state: FanStocksState; saveProblem: null | 'corrupt' | 'incompatible' } {
  const challenge = parseChallenge(search);
  if (challenge?.rulesetVersion === 1) return { state: createFanStocksState(challenge.seed), saveProblem: null };
  const loaded = fanStocksStore.load();
  if (loaded.status === 'ready') return { state: loaded.value.state, saveProblem: null };
  if (loaded.status === 'recovery-required') return { state: createFanStocksState(createGuestSeed()), saveProblem: loaded.reason };
  return { state: createFanStocksState(createGuestSeed()), saveProblem: null };
}

export function useFanStocksController() {
  const location = useLocation();
  const navigate = useNavigate();
  const [initial] = useState(() => loadInitialState(location.search));
  const [state, dispatch] = useReducer(fanStocksReducer, initial.state);
  const { settings } = useSettings();
  const { addToast } = useToasts();
  const visibilityPaused = useRef(false);
  const announcedTradeId = useRef<string | null>(null);

  useEffect(() => {
    fanStocksStore.save(createFanStocksSave(state, new Date().toISOString()));
  }, [state]);

  useEffect(() => {
    const expected = formatChallenge({ seed: state.seed, rulesetVersion: 1 });
    if (location.search !== expected) navigate({ pathname: location.pathname, search: expected }, { replace: true });
  }, [location.pathname, location.search, navigate, state.seed]);

  const lastTrade = state.tradeLog.at(-1) ?? null;
  useEffect(() => {
    if (!lastTrade || lastTrade.id === announcedTradeId.current) return;
    announcedTradeId.current = lastTrade.id;
    const title = lastTrade.status === 'accepted' ? 'Trade accepted' : lastTrade.status === 'rejected' ? 'Trade rejected' : 'Trade passed';
    addToast(`${title}: ${lastTrade.playerGives} for ${lastTrade.playerReceives}`, lastTrade.status === 'accepted' ? 'success' : 'info');
  }, [addToast, lastTrade]);

  return {
    state,
    saveProblem: initial.saveProblem,
    reducedMotion: settings.reducedMotion,
    lastAcceptedTrade: lastTrade?.status === 'accepted' ? lastTrade as TradeEvent : null,
    startLeague: useCallback(() => dispatch({ type: 'START_LEAGUE' }), []),
    dismissTutorial: useCallback(() => dispatch({ type: 'DISMISS_TUTORIAL' }), []),
    openDetail: useCallback((ticker: Ticker) => dispatch({ type: 'OPEN_DETAIL', ticker }), []),
    moveDetail: useCallback((direction: -1 | 1) => dispatch({ type: 'MOVE_DETAIL', direction }), []),
    closeDetail: useCallback(() => dispatch({ type: 'CLOSE_DETAIL' }), []),
    draft: useCallback((ticker: Ticker) => dispatch({ type: 'DRAFT', ticker }), []),
    setPaused: useCallback((paused: boolean) => dispatch({ type: 'SET_PAUSED', paused }), []),
    setSpeed: useCallback((speed: MarketSpeed) => dispatch({ type: 'SET_SPEED', speed }), []),
    decideIncoming: useCallback((decision: 'accepted' | 'passed') => dispatch({ type: 'DECIDE_INCOMING', decision }), []),
    submitOutgoing: useCallback((opponentId: AiId, playerGives: Ticker, playerReceives: Ticker) => dispatch({ type: 'SUBMIT_OUTGOING', opponentId, playerGives, playerReceives }), []),
    rematch: useCallback(() => dispatch({ type: 'REMATCH' }), []),
    newLeague: useCallback(() => dispatch({ type: 'NEW_LEAGUE', seed: createGuestSeed() }), []),
    resetBrokenSave: useCallback(() => { fanStocksStore.clear(); dispatch({ type: 'NEW_LEAGUE', seed: createGuestSeed() }); }, []),
  };
}
```

- [ ] **Step 4: Add AI-delay, market-clock, and visibility effects before the return**

```tsx
useEffect(() => {
  if (state.phase !== 'ai-drafting') return;
  const timeout = window.setTimeout(() => dispatch({ type: 'AI_DRAFTS_READY' }), settings.reducedMotion ? 0 : 650);
  return () => window.clearTimeout(timeout);
}, [settings.reducedMotion, state.phase]);

useEffect(() => {
  if (state.phase !== 'market' || state.paused || state.pendingTrade || document.visibilityState === 'hidden') return;
  const timeout = window.setTimeout(() => dispatch({ type: 'MARKET_TICK' }), FANSTOCKS_RULES.baseTickMs / state.speed);
  return () => window.clearTimeout(timeout);
}, [state.phase, state.paused, state.pendingTrade, state.priceHistory.length, state.speed]);

useEffect(() => {
  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && state.phase === 'market' && !state.paused) {
      visibilityPaused.current = true;
      dispatch({ type: 'SET_PAUSED', paused: true });
    } else if (document.visibilityState === 'visible' && visibilityPaused.current) {
      visibilityPaused.current = false;
      dispatch({ type: 'SET_PAUSED', paused: false });
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}, [state.paused, state.phase]);
```

- [ ] **Step 5: Run hook tests, reducer tests, and typecheck**

Run: `npm exec vitest run -- src/games/fanstocks/useFanStocksController.test.tsx src/games/fanstocks/engine/fanStocksReducer.test.ts && npm run typecheck`
Expected: PASS; fake timers advance exactly one tick at `1_250ms` on `4x`, and hidden time advances zero ticks.

- [ ] **Step 6: Commit the controller**

```bash
git add src/games/fanstocks/useFanStocksController.ts src/games/fanstocks/useFanStocksController.test.tsx
git commit -m "feat: orchestrate FanStocks route state"
```

### Task 10: Build the accessible intro, tutorial, draft cards, and detail sheet

**Files:**
- Create: `src/games/fanstocks/ui/FanStocksIntro.tsx`
- Create: `src/games/fanstocks/ui/TutorialDialog.tsx`
- Create: `src/games/fanstocks/ui/StockArtwork.tsx`
- Create: `src/games/fanstocks/ui/StockCardButton.tsx`
- Create: `src/games/fanstocks/ui/StockDetailDialog.tsx`
- Create: `src/games/fanstocks/ui/DraftScreen.tsx`
- Test: `src/games/fanstocks/ui/DraftScreen.test.tsx`

**Interfaces:**
- Consumes: shared `Button`, `Dialog`, `ProgressBar`; `StockCard`, `DraftState`, `currentDraftLabel`, and `STOCK_BY_TICKER`.
- Produces: intro/tutorial and draft/detail React components with callbacks only; components never dispatch engine actions directly.

- [ ] **Step 1: Write failing component tests for copy, progress, detail navigation, fallback art, and draft**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { STOCKS } from '../content/stocks';
import type { DraftState } from '../engine/draftReducer';
import { DraftScreen } from './DraftScreen';

const state: DraftState = {
  groups: [STOCKS.slice(0, 3).map(({ ticker }) => ticker), STOCKS.slice(3, 6).map(({ ticker }) => ticker), STOCKS.slice(6, 9).map(({ ticker }) => ticker)],
  roundIndex: 0, picks: [], inspectedTicker: null, status: 'selecting',
};

it('labels the round and opens a semantic stock detail dialog', () => {
  const openDetail = vi.fn();
  render(<DraftScreen draft={state} onOpenDetail={openDetail} onMoveDetail={vi.fn()} onCloseDetail={vi.fn()} onDraft={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'Round 1 of 3 · Pick 1 stock' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Read XLE, Energy Select Sector SPDR Fund' }));
  expect(openDetail).toHaveBeenCalledWith('XLE');
});

it('shows thesis, three evidence bullets, previous/next labels, Back, and an exact Draft action', () => {
  const onDraft = vi.fn();
  render(<DraftScreen draft={{ ...state, inspectedTicker: 'XLE' }} onOpenDetail={vi.fn()} onMoveDetail={vi.fn()} onCloseDetail={vi.fn()} onDraft={onDraft} />);
  expect(screen.getByRole('dialog', { name: 'Energy Select Sector SPDR Fund' })).toBeVisible();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Previous stock' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next stock' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Draft XLE' }));
  expect(onDraft).toHaveBeenCalledWith('XLE');
});

it('renders CSS/data card art without image requests', () => {
  const { container } = render(<DraftScreen draft={state} onOpenDetail={vi.fn()} onMoveDetail={vi.fn()} onCloseDetail={vi.fn()} onDraft={vi.fn()} />);
  expect(container.querySelectorAll('img')).toHaveLength(0);
  expect(container.querySelectorAll('[data-art]')).toHaveLength(3);
});
```

- [ ] **Step 2: Run the component test and verify failure**

Run: `npm exec vitest run -- src/games/fanstocks/ui/DraftScreen.test.tsx`
Expected: FAIL because `DraftScreen.tsx` does not exist.

- [ ] **Step 3: Implement the intro and compact tutorial**

```tsx
// src/games/fanstocks/ui/FanStocksIntro.tsx
import { Button } from '../../../shared/ui/Button';

export function FanStocksIntro({ onStart }: { onStart(): void }) {
  return <main className="fanstocks-intro">
    <div className="fanstocks-intro__copy">
      <p className="fanstocks-kicker">OpenTrade</p>
      <h1>Fantasy Stock Leagues</h1>
      <p>Draft three stocks. Three AI strategies draft theirs. Highest simulated value at Friday close wins.</p>
      <p className="fanstocks-disclaimer">Synthetic market game — not investment advice.</p>
      <Button variant="primary" onClick={onStart}>Start drafting</Button>
    </div>
    <div className="fanstocks-intro__table" aria-hidden="true">
      <span className="seat seat--momentum">M</span><span className="seat seat--contrarian">C</span>
      <span className="seat seat--balanced">B</span><span className="seat seat--player">You</span>
      <span className="deck">OT</span>
    </div>
  </main>;
}
```

```tsx
// src/games/fanstocks/ui/TutorialDialog.tsx
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';

export function TutorialDialog({ open, onDismiss }: { open: boolean; onDismiss(): void }) {
  return <Dialog open={open} onClose={onDismiss} title="How to play" description="Four steps to Friday close">
    <ol>
      <li>Pick one stock in each of three rounds. Together they start as your $50 portfolio.</li>
      <li>Momentum, Contrarian, and Balanced build their own $50 portfolios.</li>
      <li>Select an opponent to offer a one-for-one stock trade; decide incoming offers with Accept or Pass.</li>
      <li>The highest simulated portfolio value at Friday close wins. Tied leaders share first place.</li>
    </ol>
    <Button variant="primary" onClick={onDismiss}>Got it</Button>
  </Dialog>;
}
```

- [ ] **Step 4: Implement resilient artwork and semantic card buttons**

```tsx
// src/games/fanstocks/ui/StockArtwork.tsx
import type { StockCard } from '../content/types';

export function StockArtwork({ stock }: { stock: StockCard }) {
  return <div className="stock-art" data-art={stock.artworkKey} aria-hidden="true"><span>{stock.ticker}</span></div>;
}
```

```tsx
// src/games/fanstocks/ui/StockCardButton.tsx
import type { StockCard } from '../content/types';
import { StockArtwork } from './StockArtwork';

export function StockCardButton({ stock, onRead }: { stock: StockCard; onRead(ticker: string): void }) {
  return <button className="stock-card" type="button" aria-label={`Read ${stock.ticker}, ${stock.company}`} onClick={() => onRead(stock.ticker)}>
    <StockArtwork stock={stock} />
    <strong>{stock.ticker}</strong>
    <span>{stock.company}</span>
  </button>;
}
```

- [ ] **Step 5: Implement the navigable detail dialog and draft screen**

```tsx
// src/games/fanstocks/ui/StockDetailDialog.tsx
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import type { StockCard } from '../content/types';
import { StockArtwork } from './StockArtwork';

export function StockDetailDialog({ stock, onMove, onClose, onDraft }: {
  stock: StockCard | null; onMove(direction: -1 | 1): void; onClose(): void; onDraft(ticker: string): void;
}) {
  return <Dialog open={stock !== null} onClose={onClose} title={stock?.company ?? 'Stock detail'} description={stock ? `${stock.ticker}, synthetic game card` : undefined}>
    {stock && <div className="stock-detail">
      <StockArtwork stock={stock} />
      <p className="stock-detail__ticker">{stock.ticker}</p>
      <h2>{stock.thesis}</h2>
      <ul>{stock.evidence.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
      <div className="stock-detail__nav">
        <Button variant="ghost" aria-label="Previous stock" onClick={() => onMove(-1)}>←</Button>
        <Button variant="ghost" aria-label="Next stock" onClick={() => onMove(1)}>→</Button>
      </div>
      <Button variant="primary" onClick={() => onDraft(stock.ticker)}>Draft {stock.ticker}</Button>
      <Button variant="ghost" onClick={onClose}>Back</Button>
    </div>}
  </Dialog>;
}
```

```tsx
// src/games/fanstocks/ui/DraftScreen.tsx
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { STOCK_BY_TICKER } from '../content/stocks';
import type { DraftState } from '../engine/draftReducer';
import { currentDraftLabel } from '../engine/draftReducer';
import { StockCardButton } from './StockCardButton';
import { StockDetailDialog } from './StockDetailDialog';

export function DraftScreen({ draft, onOpenDetail, onMoveDetail, onCloseDetail, onDraft }: {
  draft: DraftState; onOpenDetail(ticker: string): void; onMoveDetail(direction: -1 | 1): void; onCloseDetail(): void; onDraft(ticker: string): void;
}) {
  const label = currentDraftLabel(draft);
  const group = draft.groups[Math.min(draft.roundIndex, 2)];
  const detail = draft.inspectedTicker ? STOCK_BY_TICKER.get(draft.inspectedTicker) ?? null : null;
  return <main className="draft-screen">
    <header className="draft-screen__header">
      <h1>{label}</h1>
      <ProgressBar value={draft.picks.length} max={3} label={`${draft.picks.length} of 3 stocks drafted`} />
    </header>
    <div className="draft-screen__hand" aria-label="Your drafted stocks">
      {[0, 1, 2].map((slot) => <span key={slot}>{draft.picks[slot] ?? `Empty slot ${slot + 1}`}</span>)}
    </div>
    <div className="draft-screen__cards">{group.map((ticker) => <StockCardButton key={ticker} stock={STOCK_BY_TICKER.get(ticker)!} onRead={onOpenDetail} />)}</div>
    <StockDetailDialog stock={detail} onMove={onMoveDetail} onClose={onCloseDetail} onDraft={onDraft} />
  </main>;
}
```

- [ ] **Step 6: Run component tests and a production typecheck**

Run: `npm exec vitest run -- src/games/fanstocks/ui/DraftScreen.test.tsx && npm run typecheck`
Expected: PASS, 3 tests; all card art is local CSS/data and emits no request or uncaught error.

- [ ] **Step 7: Commit the draft UI**

```bash
git add src/games/fanstocks/ui/FanStocksIntro.tsx src/games/fanstocks/ui/TutorialDialog.tsx src/games/fanstocks/ui/StockArtwork.tsx src/games/fanstocks/ui/StockCardButton.tsx src/games/fanstocks/ui/StockDetailDialog.tsx src/games/fanstocks/ui/DraftScreen.tsx src/games/fanstocks/ui/DraftScreen.test.tsx
git commit -m "feat: add accessible FanStocks draft UI"
```

### Task 11: Build the responsive opponent table, hands, market controls, and semantic race chart

**Files:**
- Create: `src/games/fanstocks/ui/participantMeta.ts`
- Create: `src/games/fanstocks/ui/PortfolioHand.tsx`
- Create: `src/games/fanstocks/ui/OpponentTable.tsx`
- Create: `src/games/fanstocks/ui/MarketControls.tsx`
- Create: `src/games/fanstocks/ui/PortfolioRace.tsx`
- Create: `src/games/fanstocks/ui/LeagueScreen.tsx`
- Test: `src/games/fanstocks/ui/LeagueScreen.test.tsx`

**Interfaces:**
- Consumes: `PortfolioMap`, `PriceFrame`, `ParticipantId`, `MarketSpeed`, `marketLabel`, `portfolioValue`, and shared `Button`.
- Produces: `LeagueScreen` with `onSelectOpponent`, pause/speed callbacks, a responsive scroll-snap opponent region, a pinned player hand, and a chart with an HTML table equivalent.

- [ ] **Step 1: Write failing tests for values, text alternatives, controls, and opponent selection**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { createSeededRng } from '../../../shared/rng/seededRng';
import { STOCKS } from '../content/stocks';
import { completeAiDrafts } from '../engine/aiDraft';
import { createInitialPriceFrame } from '../engine/priceEngine';
import { LeagueScreen } from './LeagueScreen';

const portfolios = completeAiDrafts(['XLE', 'ODFL', 'IWM'], STOCKS, createSeededRng('league-ui'));
const frames = [createInitialPriceFrame(STOCKS)];

it('renders four exact $50 values and a textual chart equivalent', () => {
  render(<LeagueScreen portfolios={portfolios} frames={frames} paused={false} speed={1} pendingTrade={null} onSetPaused={vi.fn()} onSetSpeed={vi.fn()} onSelectOpponent={vi.fn()} onShare={vi.fn()} />);
  expect(screen.getAllByText('$50.00')).toHaveLength(4);
  expect(screen.getByRole('img', { name: /Portfolio race through Monday/i })).toBeVisible();
  expect(screen.getByRole('table', { name: 'Current portfolio standings' })).toBeInTheDocument();
});

it('labels controls and lets the player choose an opponent', () => {
  const onSelectOpponent = vi.fn();
  render(<LeagueScreen portfolios={portfolios} frames={frames} paused={false} speed={1} pendingTrade={null} onSetPaused={vi.fn()} onSetSpeed={vi.fn()} onSelectOpponent={onSelectOpponent} onShare={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Offer Momentum a trade' }));
  expect(onSelectOpponent).toHaveBeenCalledWith('momentum');
  expect(screen.getByRole('button', { name: 'Pause market' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('button', { name: 'Set market speed to 1x' })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 2: Run the league component test and verify failure**

Run: `npm exec vitest run -- src/games/fanstocks/ui/LeagueScreen.test.tsx`
Expected: FAIL because `LeagueScreen.tsx` does not exist.

- [ ] **Step 3: Add stable presentation metadata, hands, and controls**

```ts
// src/games/fanstocks/ui/participantMeta.ts
import type { ParticipantId } from '../engine/rules';
export const PARTICIPANT_META: Readonly<Record<ParticipantId, { name: string; strategy: string; symbol: string }>> = Object.freeze({
  player: { name: 'You', strategy: 'Your portfolio', symbol: 'YOU' },
  momentum: { name: 'Momentum', strategy: 'Trend and upside', symbol: 'M' },
  contrarian: { name: 'Contrarian', strategy: 'Laggards and reversals', symbol: 'C' },
  balanced: { name: 'Balanced', strategy: 'Diversified risk', symbol: 'B' },
});
```

```tsx
// src/games/fanstocks/ui/PortfolioHand.tsx
import { STOCK_BY_TICKER } from '../content/stocks';
import type { Portfolio } from '../engine/types';
export function PortfolioHand({ portfolio, label }: { portfolio: Portfolio; label: string }) {
  return <ul className="portfolio-hand" aria-label={label}>{portfolio.tickers.map((ticker) => <li key={ticker}><strong>{ticker}</strong><span>{STOCK_BY_TICKER.get(ticker)!.company}</span></li>)}</ul>;
}
```

```tsx
// src/games/fanstocks/ui/MarketControls.tsx
import { Button } from '../../../shared/ui/Button';
import type { MarketSpeed } from '../engine/fanStocksReducer';
export function MarketControls({ paused, speed, onSetPaused, onSetSpeed }: { paused: boolean; speed: MarketSpeed; onSetPaused(value: boolean): void; onSetSpeed(value: MarketSpeed): void }) {
  return <div className="market-controls" aria-label="Market playback controls">
    <Button variant="secondary" aria-pressed={paused} aria-label={paused ? 'Resume market' : 'Pause market'} onClick={() => onSetPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</Button>
    {([1, 2, 4] as const).map((value) => <Button key={value} variant="ghost" aria-label={`Set market speed to ${value}x`} aria-pressed={speed === value} onClick={() => onSetSpeed(value)}>{value}x</Button>)}
  </div>;
}
```

- [ ] **Step 4: Implement the semantic SVG race chart**

```tsx
import { useId } from 'react';
import type { PriceFrame } from '../engine/priceEngine';
import { marketLabel, portfolioValue } from '../engine/priceEngine';
import { PARTICIPANT_ORDER } from '../engine/rules';
import type { PortfolioMap } from '../engine/types';
import { PARTICIPANT_META } from './participantMeta';

export function PortfolioRace({ portfolios, frames }: { portfolios: PortfolioMap; frames: readonly PriceFrame[] }) {
  const titleId = useId();
  const last = frames.at(-1)!;
  const day = marketLabel(last.tick).day;
  const values = PARTICIPANT_ORDER.map((id) => ({ id, value: portfolioValue(portfolios[id], last) }));
  const points = (id: typeof PARTICIPANT_ORDER[number]) => frames.map((frame, index) => {
    const x = frames.length === 1 ? 0 : index / (frames.length - 1) * 100;
    const y = 50 - (portfolioValue(portfolios[id], frame) - 50) * 4;
    return `${x},${Math.max(4, Math.min(96, y))}`;
  }).join(' ');
  return <section className="portfolio-race">
    <svg role="img" aria-labelledby={titleId} viewBox="0 0 100 100" preserveAspectRatio="none">
      <title id={titleId}>Portfolio race through {day}; {values.map(({ id, value }) => `${PARTICIPANT_META[id].name} ${value.toFixed(2)} dollars`).join(', ')}</title>
      <line x1="0" y1="50" x2="100" y2="50" className="portfolio-race__baseline" />
      {PARTICIPANT_ORDER.map((id) => <polyline key={id} data-participant={id} points={points(id)} vectorEffect="non-scaling-stroke" />)}
    </svg>
    <table aria-label="Current portfolio standings" className="sr-only">
      <thead><tr><th>Portfolio</th><th>Value</th><th>Change</th></tr></thead>
      <tbody>{values.map(({ id, value }) => <tr key={id}><th>{PARTICIPANT_META[id].name}</th><td>${value.toFixed(2)}</td><td>{value >= 50 ? 'Up' : 'Down'} {Math.abs(value - 50).toFixed(2)} dollars</td></tr>)}</tbody>
    </table>
  </section>;
}
```

- [ ] **Step 5: Compose the table/carousel and pinned player hand**

```tsx
// src/games/fanstocks/ui/OpponentTable.tsx
import type { AiId } from '../content/types';
import type { PortfolioMap } from '../engine/types';
import { PortfolioHand } from './PortfolioHand';
import { PARTICIPANT_META } from './participantMeta';
export function OpponentTable({ portfolios, disabled, onSelect }: { portfolios: PortfolioMap; disabled: boolean; onSelect(id: AiId): void }) {
  return <div className="opponent-table" aria-label="AI opponents">{(['momentum', 'contrarian', 'balanced'] as const).map((id) => <article className={`opponent-seat opponent-seat--${id}`} key={id}>
    <span className="opponent-seat__avatar" aria-hidden="true">{PARTICIPANT_META[id].symbol}</span>
    <h3>{PARTICIPANT_META[id].name}</h3><p>{PARTICIPANT_META[id].strategy}</p>
    <PortfolioHand portfolio={portfolios[id]} label={`${PARTICIPANT_META[id].name} hand`} />
    <button type="button" disabled={disabled} onClick={() => onSelect(id)} aria-label={`Offer ${PARTICIPANT_META[id].name} a trade`}>Offer trade</button>
  </article>)}</div>;
}
```

```tsx
// src/games/fanstocks/ui/LeagueScreen.tsx
import { Button } from '../../../shared/ui/Button';
import type { AiId } from '../content/types';
import type { MarketSpeed } from '../engine/fanStocksReducer';
import type { PriceFrame } from '../engine/priceEngine';
import { marketLabel } from '../engine/priceEngine';
import type { TradeOffer } from '../engine/trades';
import type { PortfolioMap } from '../engine/types';
import { MarketControls } from './MarketControls';
import { OpponentTable } from './OpponentTable';
import { PortfolioHand } from './PortfolioHand';
import { PortfolioRace } from './PortfolioRace';

export function LeagueScreen({ portfolios, frames, paused, speed, pendingTrade, onSetPaused, onSetSpeed, onSelectOpponent, onShare }: {
  portfolios: PortfolioMap; frames: readonly PriceFrame[]; paused: boolean; speed: MarketSpeed; pendingTrade: TradeOffer | null;
  onSetPaused(value: boolean): void; onSetSpeed(value: MarketSpeed): void; onSelectOpponent(id: AiId): void; onShare(): void;
}) {
  const market = marketLabel(frames.at(-1)!.tick);
  return <main className="league-screen">
    <header><div><p className="fanstocks-kicker">Fantasy Stock Leagues</p><h1>{market.day}</h1><p>{market.closed ? 'Market closed' : paused || pendingTrade ? 'Market paused' : 'Synthetic market open'}</p></div><Button variant="primary" onClick={onShare}>Copy challenge link</Button></header>
    <div className="league-screen__board"><OpponentTable portfolios={portfolios} disabled={pendingTrade !== null} onSelect={onSelectOpponent} /><span className="league-screen__deck" aria-hidden="true">OT</span></div>
    <aside className="league-screen__race"><h2>Portfolio race</h2><PortfolioRace portfolios={portfolios} frames={frames} /><MarketControls paused={paused} speed={speed} onSetPaused={onSetPaused} onSetSpeed={onSetSpeed} /></aside>
    <section className="league-screen__player"><h2>Your portfolio</h2><PortfolioHand portfolio={portfolios.player} label="Your hand" /></section>
  </main>;
}
```

- [ ] **Step 6: Run league UI and engine value tests**

Run: `npm exec vitest run -- src/games/fanstocks/ui/LeagueScreen.test.tsx src/games/fanstocks/engine/priceEngine.test.ts && npm run typecheck`
Expected: PASS; all four initial values are `$50.00`, and the SVG and hidden table expose the same values.

- [ ] **Step 7: Commit the live league surface**

```bash
git add src/games/fanstocks/ui/participantMeta.ts src/games/fanstocks/ui/PortfolioHand.tsx src/games/fanstocks/ui/OpponentTable.tsx src/games/fanstocks/ui/MarketControls.tsx src/games/fanstocks/ui/PortfolioRace.tsx src/games/fanstocks/ui/LeagueScreen.tsx src/games/fanstocks/ui/LeagueScreen.test.tsx
git commit -m "feat: add responsive FanStocks league table"
```

### Task 12: Add explicit trade dialogs, accept/pass feedback, card-flight animation, and toasts

**Files:**
- Create: `src/games/fanstocks/ui/IncomingTradeCard.tsx`
- Create: `src/games/fanstocks/ui/OutgoingTradeDialog.tsx`
- Create: `src/games/fanstocks/ui/TradeTransferAnimation.tsx`
- Test: `src/games/fanstocks/ui/TradeUi.test.tsx`

**Interfaces:**
- Consumes: shared `Button` and `Dialog`; `TradeOffer`, `TradeEvent`, `PortfolioMap`, `AiId`, `Ticker`, and `PARTICIPANT_META`.
- Produces: `IncomingTradeCard`, `OutgoingTradeDialog`, and a reduced-motion-aware `TradeTransferAnimation`; the controller remains responsible for the concise toast.

- [ ] **Step 1: Write failing tests for unambiguous direction, legal pair selection, and animation fallback**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { createSeededRng } from '../../../shared/rng/seededRng';
import { STOCKS } from '../content/stocks';
import { completeAiDrafts } from '../engine/aiDraft';
import { IncomingTradeCard } from './IncomingTradeCard';
import { OutgoingTradeDialog } from './OutgoingTradeDialog';
import { TradeTransferAnimation } from './TradeTransferAnimation';

const portfolios = completeAiDrafts(['XLE', 'ODFL', 'IWM'], STOCKS, createSeededRng('trade-ui'));
const incoming = { id: 'incoming-ui', direction: 'incoming' as const, opponentId: 'momentum' as const, playerGives: portfolios.player.tickers[0], playerReceives: portfolios.momentum.tickers[0], createdAtTick: 10 };

it('states exactly what the player receives and gives', () => {
  render(<IncomingTradeCard offer={incoming} onAccept={vi.fn()} onPass={vi.fn()} />);
  expect(screen.getByText('You receive')).toBeVisible();
  expect(screen.getByText(incoming.playerReceives)).toBeVisible();
  expect(screen.getByText('You give')).toBeVisible();
  expect(screen.getByText(incoming.playerGives)).toBeVisible();
  expect(screen.getByRole('button', { name: `Accept: receive ${incoming.playerReceives} and give ${incoming.playerGives}` })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Pass on trade' })).toBeVisible();
});

it('submits only after selecting one card from each side', () => {
  const onSubmit = vi.fn();
  render(<OutgoingTradeDialog open opponentId="balanced" portfolios={portfolios} onClose={vi.fn()} onSubmit={onSubmit} />);
  const submit = screen.getByRole('button', { name: 'Send trade offer' });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByLabelText(`Give ${portfolios.player.tickers[0]}`));
  fireEvent.click(screen.getByLabelText(`Receive ${portfolios.balanced.tickers[0]}`));
  fireEvent.click(submit);
  expect(onSubmit).toHaveBeenCalledWith('balanced', portfolios.player.tickers[0], portfolios.balanced.tickers[0]);
});

it('removes card-flight visuals in reduced-motion mode but keeps status text', () => {
  const event = { ...incoming, status: 'accepted' as const };
  render(<TradeTransferAnimation event={event} reducedMotion />);
  expect(screen.queryByTestId('trade-flight')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(`Trade complete: received ${event.playerReceives} and gave ${event.playerGives}`);
});
```

- [ ] **Step 2: Run the trade UI test and verify failure**

Run: `npm exec vitest run -- src/games/fanstocks/ui/TradeUi.test.tsx`
Expected: FAIL because the three UI modules are absent.

- [ ] **Step 3: Implement the incoming offer card with text plus icons**

```tsx
import { Button } from '../../../shared/ui/Button';
import type { TradeOffer } from '../engine/trades';
import { PARTICIPANT_META } from './participantMeta';

export function IncomingTradeCard({ offer, onAccept, onPass }: { offer: TradeOffer; onAccept(): void; onPass(): void }) {
  return <section className="incoming-trade" aria-labelledby={`trade-title-${offer.id}`}>
    <p>{PARTICIPANT_META[offer.opponentId].name} offers a trade</p>
    <h2 id={`trade-title-${offer.id}`}>One card for one card</h2>
    <dl className="trade-direction">
      <div><dt>You receive</dt><dd>{offer.playerReceives}</dd></div>
      <div><dt>You give</dt><dd>{offer.playerGives}</dd></div>
    </dl>
    <div className="incoming-trade__actions">
      <Button variant="primary" aria-label={`Accept: receive ${offer.playerReceives} and give ${offer.playerGives}`} onClick={onAccept}><span aria-hidden="true">✓</span> Accept</Button>
      <Button variant="secondary" aria-label="Pass on trade" onClick={onPass}><span aria-hidden="true">×</span> Pass</Button>
    </div>
  </section>;
}
```

- [ ] **Step 4: Implement the outgoing two-fieldset trade builder**

```tsx
import { useEffect, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import type { AiId, Ticker } from '../content/types';
import type { PortfolioMap } from '../engine/types';
import { PARTICIPANT_META } from './participantMeta';

export function OutgoingTradeDialog({ open, opponentId, portfolios, onClose, onSubmit }: {
  open: boolean; opponentId: AiId | null; portfolios: PortfolioMap; onClose(): void;
  onSubmit(opponentId: AiId, playerGives: Ticker, playerReceives: Ticker): void;
}) {
  const [gives, setGives] = useState<Ticker | null>(null);
  const [receives, setReceives] = useState<Ticker | null>(null);
  useEffect(() => { if (!open) { setGives(null); setReceives(null); } }, [open]);
  const opponentName = opponentId ? PARTICIPANT_META[opponentId].name : 'opponent';
  return <Dialog open={open} onClose={onClose} title={`Offer ${opponentName} a trade`} description="Choose exactly one card to give and one card to receive.">
    {opponentId && <form onSubmit={(event) => { event.preventDefault(); if (gives && receives) onSubmit(opponentId, gives, receives); }}>
      <fieldset><legend>You give</legend>{portfolios.player.tickers.map((ticker) => <label key={ticker}><input type="radio" name="gives" value={ticker} checked={gives === ticker} onChange={() => setGives(ticker)} /> Give {ticker}</label>)}</fieldset>
      <fieldset><legend>You receive</legend>{portfolios[opponentId].tickers.map((ticker) => <label key={ticker}><input type="radio" name="receives" value={ticker} checked={receives === ticker} onChange={() => setReceives(ticker)} /> Receive {ticker}</label>)}</fieldset>
      <Button type="submit" variant="primary" disabled={!gives || !receives}>Send trade offer</Button>
      <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
    </form>}
  </Dialog>;
}
```

- [ ] **Step 5: Implement optional visual flight plus permanent textual confirmation**

```tsx
import { useEffect, useState } from 'react';
import type { TradeEvent } from '../engine/trades';

export function TradeTransferAnimation({ event, reducedMotion }: { event: TradeEvent | null; reducedMotion: boolean }) {
  const [visible, setVisible] = useState(Boolean(event) && !reducedMotion);
  useEffect(() => {
    setVisible(Boolean(event) && !reducedMotion);
    if (!event || reducedMotion) return;
    const timer = window.setTimeout(() => setVisible(false), 700);
    return () => window.clearTimeout(timer);
  }, [event, reducedMotion]);
  if (!event) return null;
  return <>
    <p className="sr-only" role="status">Trade complete: received {event.playerReceives} and gave {event.playerGives}</p>
    {visible && <div className="trade-flight" data-testid="trade-flight" aria-hidden="true"><span>{event.playerReceives}</span><span>{event.playerGives}</span></div>}
  </>;
}
```

- [ ] **Step 6: Run trade engine and UI tests together**

Run: `npm exec vitest run -- src/games/fanstocks/engine/trades.test.ts src/games/fanstocks/ui/TradeUi.test.tsx && npm run typecheck`
Expected: PASS; accepted trade semantics are available without animation and no button is icon-only.

- [ ] **Step 7: Commit trade interaction polish**

```bash
git add src/games/fanstocks/ui/IncomingTradeCard.tsx src/games/fanstocks/ui/OutgoingTradeDialog.tsx src/games/fanstocks/ui/TradeTransferAnimation.tsx src/games/fanstocks/ui/TradeUi.test.tsx
git commit -m "feat: add explicit FanStocks trade UI"
```

### Task 13: Add results, rematch/new-league actions, route composition, and hub registration

**Files:**
- Create: `src/games/fanstocks/ui/ResultsScreen.tsx`
- Test: `src/games/fanstocks/ui/ResultsScreen.test.tsx`
- Create: `src/games/fanstocks/FanStocksRoute.tsx`
- Modify: `src/games/fanstocks/route.tsx`
- Test: `src/games/fanstocks/FanStocksRoute.test.tsx`

**Interfaces:**
- Consumes: all controller/UI exports, foundation `Dialog`, `Button`, `GameRouteModule`, and the shared route registry.
- Produces: the default `FanStocksRoute` component and `gameRoute: GameRouteModule` consumed by the existing lazy registry.

- [ ] **Step 1: Write failing results tests for win, tie, ranking, recap, rematch, and new league**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { FanStocksResult } from '../engine/ranking';
import { ResultsScreen } from './ResultsScreen';

const result: FanStocksResult = {
  rows: [
    { participantId: 'player', rank: 1, value: 55, returnPercent: 10, decisiveTicker: 'XLE', tied: true },
    { participantId: 'momentum', rank: 1, value: 55, returnPercent: 10, decisiveTicker: 'SMCI', tied: true },
    { participantId: 'balanced', rank: 3, value: 50, returnPercent: 0, decisiveTicker: 'BMY', tied: false },
    { participantId: 'contrarian', rank: 4, value: 48, returnPercent: -4, decisiveTicker: 'SBUX', tied: false },
  ],
  winnerIds: ['player', 'momentum'], isTie: true,
  acceptedTrades: [{ id: 'accepted', direction: 'incoming', opponentId: 'momentum', playerGives: 'ODFL', playerReceives: 'SMCI', createdAtTick: 10, status: 'accepted' }],
};

it('explains a shared first place and exposes the complete recap', () => {
  render(<ResultsScreen result={result} onRematch={vi.fn()} onNewLeague={vi.fn()} onShare={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'You tied for first' })).toBeVisible();
  expect(screen.getByText('You received SMCI and gave ODFL.')).toBeVisible();
  expect(screen.getByRole('list', { name: 'Final ranking' }).children).toHaveLength(4);
});

it('offers separate rematch, new league, and challenge actions', () => {
  const onRematch = vi.fn(); const onNewLeague = vi.fn(); const onShare = vi.fn();
  render(<ResultsScreen result={result} onRematch={onRematch} onNewLeague={onNewLeague} onShare={onShare} />);
  fireEvent.click(screen.getByRole('button', { name: 'Rematch same table' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start a new league' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy this challenge' }));
  expect(onRematch).toHaveBeenCalledOnce(); expect(onNewLeague).toHaveBeenCalledOnce(); expect(onShare).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the result test and verify failure**

Run: `npm exec vitest run -- src/games/fanstocks/ui/ResultsScreen.test.tsx`
Expected: FAIL because `ResultsScreen.tsx` does not exist.

- [ ] **Step 3: Implement complete ranked results and decisive recap**

```tsx
import { Button } from '../../../shared/ui/Button';
import type { FanStocksResult } from '../engine/ranking';
import { PARTICIPANT_META } from './participantMeta';

export function ResultsScreen({ result, onRematch, onNewLeague, onShare }: { result: FanStocksResult; onRematch(): void; onNewLeague(): void; onShare(): void }) {
  const playerWon = result.winnerIds.includes('player');
  const title = playerWon ? result.isTie ? 'You tied for first' : 'You won the league' : `${PARTICIPANT_META[result.winnerIds[0]].name} won the league`;
  return <main className="results-screen">
    <p className="fanstocks-kicker">Friday close</p><h1>{title}</h1>
    <p>{result.isTie ? 'Equal displayed values share first place.' : 'Highest simulated portfolio value wins.'}</p>
    <ol className="results-ranking" aria-label="Final ranking">{result.rows.map((row) => <li key={row.participantId} value={row.rank}>
      <strong>{row.rank}. {PARTICIPANT_META[row.participantId].name}</strong>
      <span>${row.value.toFixed(2)} · {row.returnPercent >= 0 ? '+' : ''}{row.returnPercent.toFixed(2)}%</span>
      <span>Strongest close: {row.decisiveTicker}</span>
      {row.tied && <span>— tied at this value</span>}
    </li>)}</ol>
    <section><h2>Accepted trade recap</h2>{result.acceptedTrades.length === 0 ? <p>No trades were accepted.</p> : <ul>{result.acceptedTrades.map((trade) => <li key={trade.id}>You received {trade.playerReceives} and gave {trade.playerGives}.</li>)}</ul>}</section>
    <div className="results-screen__actions"><Button variant="primary" onClick={onRematch}>Rematch same table</Button><Button variant="secondary" onClick={onNewLeague}>Start a new league</Button><Button variant="ghost" onClick={onShare}>Copy this challenge</Button></div>
  </main>;
}
```

- [ ] **Step 4: Write the failing route composition test**

Mock `useFanStocksController` with one state for each phase. Assert intro shows `Start drafting`; tutorial shows the dialog; draft shows the three cards; `ai-drafting` exposes `AI opponents are building their portfolios`; market shows `Portfolio race`; results shows `Friday close`; invalid save shows a recoverable dialog with `Reset FanStocks progress` and `Return to games`.

Run: `npm exec vitest run -- src/games/fanstocks/FanStocksRoute.test.tsx`
Expected: FAIL because `FanStocksRoute.tsx` is absent.

- [ ] **Step 5: Compose every phase, outgoing selection, clipboard sharing, and recovery**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import type { AiId } from './content/types';
import { useFanStocksController } from './useFanStocksController';
import { DraftScreen } from './ui/DraftScreen';
import { FanStocksIntro } from './ui/FanStocksIntro';
import { IncomingTradeCard } from './ui/IncomingTradeCard';
import { LeagueScreen } from './ui/LeagueScreen';
import { OutgoingTradeDialog } from './ui/OutgoingTradeDialog';
import { ResultsScreen } from './ui/ResultsScreen';
import { TradeTransferAnimation } from './ui/TradeTransferAnimation';
import { TutorialDialog } from './ui/TutorialDialog';
import './fanstocks.css';

export default function FanStocksRoute() {
  const game = useFanStocksController();
  const [outgoingOpponent, setOutgoingOpponent] = useState<AiId | null>(null);
  const [shareStatus, setShareStatus] = useState('');
  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setShareStatus('Challenge link copied.');
  };
  const state = game.state;
  return <div className="fanstocks-app">
    <a className="skip-link" href="#fanstocks-main">Skip to game</a>
    <p className="sr-only" aria-live="polite">{shareStatus}</p>
    <div id="fanstocks-main">
      {(state.phase === 'intro' || state.phase === 'tutorial') && <FanStocksIntro onStart={game.startLeague} />}
      <TutorialDialog open={state.phase === 'tutorial'} onDismiss={game.dismissTutorial} />
      {state.phase === 'draft' && <DraftScreen draft={state.draft} onOpenDetail={game.openDetail} onMoveDetail={game.moveDetail} onCloseDetail={game.closeDetail} onDraft={game.draft} />}
      {state.phase === 'ai-drafting' && <main className="ai-drafting" aria-live="polite"><h1>Draft complete</h1><p>AI opponents are building their portfolios.</p></main>}
      {state.phase === 'market' && state.portfolios && <>
        <LeagueScreen portfolios={state.portfolios} frames={state.priceHistory} paused={state.paused} speed={state.speed} pendingTrade={state.pendingTrade} onSetPaused={game.setPaused} onSetSpeed={game.setSpeed} onSelectOpponent={setOutgoingOpponent} onShare={share} />
        {state.pendingTrade && <IncomingTradeCard offer={state.pendingTrade} onAccept={() => game.decideIncoming('accepted')} onPass={() => game.decideIncoming('passed')} />}
        <OutgoingTradeDialog open={outgoingOpponent !== null} opponentId={outgoingOpponent} portfolios={state.portfolios} onClose={() => setOutgoingOpponent(null)} onSubmit={(opponentId, gives, receives) => { game.submitOutgoing(opponentId, gives, receives); setOutgoingOpponent(null); }} />
        <TradeTransferAnimation key={game.lastAcceptedTrade?.id ?? 'none'} event={game.lastAcceptedTrade} reducedMotion={game.reducedMotion} />
      </>}
      {state.phase === 'results' && state.result && <ResultsScreen result={state.result} onRematch={game.rematch} onNewLeague={game.newLeague} onShare={share} />}
    </div>
    <Dialog open={game.saveProblem !== null} onClose={() => undefined} title="FanStocks progress could not be loaded" description="The saved league is corrupt or belongs to an incompatible ruleset.">
      <Button variant="danger" onClick={game.resetBrokenSave}>Reset FanStocks progress</Button>
      <Link to="/">Return to games</Link>
    </Dialog>
  </div>;
}
```

- [ ] **Step 6: Export route metadata and register it with the shared app**

```ts
// src/games/fanstocks/route.tsx
import { FANSTOCKS_METADATA } from '../../app/routes/metadata';
import type { GameRouteModule } from '../../app/routes/types';
import { parseChallenge } from '../../shared/routing/challenge';
import FanStocksRoute from './FanStocksRoute';
import { fanStocksSaveCodec, getFanStocksProgressBadge, resetFanStocksProgress } from './persistence/fanStocksSave';

export const gameRoute: GameRouteModule = Object.freeze({
  metadata: FANSTOCKS_METADATA,
  Entry: FanStocksRoute,
  saveKey: fanStocksSaveCodec.key,
  reset: resetFanStocksProgress,
  getProgressBadge: () => getFanStocksProgressBadge() ?? {
    label: 'FanStocks', value: 'No active league', tone: 'neutral',
  },
  parseChallenge,
});
```

The foundation registry already lazy-loads `./games/fanstocks/route.tsx` and expects the named `gameRoute` export. Replace the temporary foundation entry in that file; do not add a second registry.

- [ ] **Step 7: Run route, result, persistence, and registry tests**

Run: `npm exec vitest run -- src/games/fanstocks/ui/ResultsScreen.test.tsx src/games/fanstocks/FanStocksRoute.test.tsx src/games/fanstocks/persistence && npm run typecheck`
Expected: PASS; every valid phase renders one primary screen, and invalid storage exposes reset and hub recovery without throwing.

- [ ] **Step 8: Commit the complete route**

```bash
git add src/games/fanstocks/FanStocksRoute.tsx src/games/fanstocks/route.tsx src/games/fanstocks/ui/ResultsScreen.tsx src/games/fanstocks/ui/ResultsScreen.test.tsx src/games/fanstocks/FanStocksRoute.test.tsx
git commit -m "feat: complete FanStocks route and results"
```

### Task 14: Apply the faithful card-room visual system and responsive layout

**Files:**
- Create: `src/games/fanstocks/fanstocks.css`
- Test: `src/games/fanstocks/ui/FanStocksStyles.test.tsx`

**Interfaces:**
- Consumes: the foundation typography/color tokens and every class emitted by Tasks 10–13.
- Produces: desktop oval-table composition, mobile scroll-snap opponents with pinned hand, visible focus, 44px targets, deterministic CSS card art, and reduced-motion overrides.

- [ ] **Step 1: Write a failing style-contract test**

```tsx
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../fanstocks.css', import.meta.url), 'utf8');

describe('FanStocks CSS contract', () => {
  it('contains the required mobile, focus, touch, overflow, and reduced-motion rules', () => {
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('scroll-snap-type: x mandatory');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('overflow-x: clip');
  });
});
```

- [ ] **Step 2: Run the style test and verify failure**

Run: `npm exec vitest run -- src/games/fanstocks/ui/FanStocksStyles.test.tsx`
Expected: FAIL with `ENOENT` for `fanstocks.css`.

- [ ] **Step 3: Add the exact game-scoped base, intro, draft, and card styles**

```css
.fanstocks-app {
  --fs-bg: #090a0b;
  --fs-panel: #15171b;
  --fs-panel-strong: #1c1f24;
  --fs-ivory: #f4f0e8;
  --fs-muted: #aaa79f;
  --fs-line: #3d4046;
  --fs-yellow: #ffd326;
  --fs-red: #e8554f;
  --fs-green: #39b86a;
  min-height: 100svh;
  overflow-x: clip;
  color: var(--fs-ivory);
  background: var(--fs-bg);
  font-family: var(--font-sans, Inter, system-ui, sans-serif);
}
.fanstocks-app *, .fanstocks-app *::before, .fanstocks-app *::after { box-sizing: border-box; }
.fanstocks-app button, .fanstocks-app a, .fanstocks-app input { min-height: 44px; }
.fanstocks-app :focus-visible { outline: 3px solid var(--fs-yellow); outline-offset: 3px; }
.fanstocks-app .skip-link { position: fixed; inset: 8px auto auto 8px; z-index: 100; transform: translateY(-150%); background: var(--fs-yellow); color: #111; padding: 10px 14px; }
.fanstocks-app .skip-link:focus { transform: translateY(0); }
.fanstocks-kicker { margin: 0 0 8px; color: var(--fs-muted); font-family: var(--font-serif, Georgia, serif); }
.fanstocks-disclaimer { color: var(--fs-muted); font-size: .875rem; }
.sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }

.fanstocks-intro { min-height: 100svh; display: grid; grid-template-columns: minmax(280px, 430px) minmax(460px, 1fr); align-items: center; gap: clamp(48px, 8vw, 120px); width: min(1100px, calc(100% - 48px)); margin: auto; }
.fanstocks-intro h1 { margin: 0; max-width: 9ch; font: 700 clamp(3rem, 6vw, 5.5rem)/.92 var(--font-serif, Georgia, serif); }
.fanstocks-intro__copy > p:not(.fanstocks-kicker) { max-width: 43ch; line-height: 1.55; }
.fanstocks-intro__table { position: relative; aspect-ratio: 1.9; border: 1px solid #757980; border-radius: 50%; background: radial-gradient(ellipse, #22252b 0%, #15171b 60%, #0c0d0f 100%); box-shadow: inset 0 0 42px #000; }
.fanstocks-intro__table .seat { position: absolute; display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; border: 2px solid currentColor; background: #111; font-weight: 800; }
.fanstocks-intro__table .seat--momentum { color: #ff8959; inset: -28px auto auto calc(50% - 28px); }
.fanstocks-intro__table .seat--contrarian { color: #b888ff; inset: calc(50% - 28px) auto auto -28px; }
.fanstocks-intro__table .seat--balanced { color: #64d9e9; inset: calc(50% - 28px) -28px auto auto; }
.fanstocks-intro__table .seat--player { color: var(--fs-yellow); inset: auto auto -28px calc(50% - 28px); }
.fanstocks-intro__table .deck, .league-screen__deck { position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%); display: grid; place-items: center; width: 54px; height: 72px; border: 2px solid #777b83; border-radius: 7px; color: var(--fs-muted); background: #1b1d21; }

.draft-screen { min-height: 100svh; width: min(900px, calc(100% - 40px)); margin: auto; padding: clamp(72px, 12vh, 120px) 0 48px; }
.draft-screen__header { display: grid; grid-template-columns: 1fr 240px; align-items: end; gap: 24px; }
.draft-screen__header h1 { margin: 0; font-size: clamp(1.35rem, 3vw, 2rem); }
.draft-screen__hand { min-height: 72px; display: flex; justify-content: center; gap: 8px; margin: 24px 0 32px; }
.draft-screen__hand span { display: grid; place-items: center; min-width: 92px; padding: 8px; border: 1px solid var(--fs-line); border-radius: 8px; color: var(--fs-muted); }
.draft-screen__cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.stock-card { position: relative; isolation: isolate; min-height: 330px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; padding: 18px; border: 1px solid var(--fs-line); border-radius: 14px; color: white; background: var(--fs-panel); text-align: left; cursor: pointer; }
.stock-card::after { content: ''; position: absolute; z-index: -1; inset: 35% 0 0; background: linear-gradient(transparent, rgba(0,0,0,.94)); }
.stock-card:hover { border-color: var(--fs-yellow); transform: translateY(-3px); }
.stock-card > strong { font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1; text-shadow: 0 2px 8px #000; }
.stock-card > span:last-child { margin-top: 10px; font-weight: 700; }
.stock-art { position: absolute; z-index: -2; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: grayscale(1) contrast(1.05); }
.stock-detail { display: grid; gap: 14px; width: min(520px, 100%); }
.stock-detail > .stock-art { position: relative; z-index: 0; aspect-ratio: 16/6; border-radius: 10px; }
.stock-detail h2 { margin: 0; font: 700 1.5rem/1.2 var(--font-serif, Georgia, serif); }
.stock-detail li { margin-block: 8px; }
.stock-detail__ticker { margin: 0; color: var(--fs-muted); }
.stock-detail__nav { display: flex; justify-content: space-between; }
```

- [ ] **Step 4: Add the exact league, trade, results, animation, and mobile styles**

```css
.league-screen { min-height: 100svh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 340px); grid-template-rows: auto 1fr auto; gap: 20px 28px; width: min(1180px, calc(100% - 40px)); margin: auto; padding: 28px 0; }
.league-screen > header { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.league-screen > header h1 { margin: 2px 0; }
.league-screen__board { position: relative; min-height: 410px; border: 1px solid #676b73; border-radius: 50%; background: radial-gradient(ellipse, #202329, #111316 68%); }
.opponent-table { position: absolute; inset: 0; }
.opponent-seat { position: absolute; width: min(31%, 190px); padding: 10px; text-align: center; }
.opponent-seat--momentum { inset: -22px auto auto calc(50% - 95px); }
.opponent-seat--contrarian { inset: calc(50% - 95px) auto auto -24px; }
.opponent-seat--balanced { inset: calc(50% - 95px) -24px auto auto; }
.opponent-seat__avatar { display: grid; place-items: center; width: 48px; height: 48px; margin: auto; border: 2px solid currentColor; border-radius: 50%; background: #111; font-weight: 900; }
.opponent-seat--momentum .opponent-seat__avatar { color: #ff8959; }
.opponent-seat--contrarian .opponent-seat__avatar { color: #b888ff; }
.opponent-seat--balanced .opponent-seat__avatar { color: #64d9e9; }
.opponent-seat h3, .opponent-seat p { margin: 5px 0; }
.opponent-seat p { color: var(--fs-muted); font-size: .75rem; }
.opponent-seat > button { width: 100%; border: 1px solid var(--fs-line); color: var(--fs-ivory); background: #121417; border-radius: 999px; }
.portfolio-hand { display: flex; justify-content: center; gap: 5px; padding: 0; margin: 8px 0; list-style: none; }
.portfolio-hand li { display: grid; place-items: center; width: 48px; min-height: 62px; padding: 4px; border: 1px solid #666a72; border-radius: 5px; background: #1a1c20; }
.portfolio-hand li span { display: none; }
.league-screen__race { padding: 18px; border: 1px solid var(--fs-line); border-radius: 14px; background: var(--fs-panel); }
.league-screen__race h2 { margin-top: 0; }
.portfolio-race svg { width: 100%; height: 180px; overflow: visible; }
.portfolio-race polyline { fill: none; stroke-width: 2; }
.portfolio-race polyline[data-participant='player'] { stroke: var(--fs-yellow); stroke-dasharray: 0; }
.portfolio-race polyline[data-participant='momentum'] { stroke: #ff8959; stroke-dasharray: 8 3; }
.portfolio-race polyline[data-participant='contrarian'] { stroke: #b888ff; stroke-dasharray: 3 3; }
.portfolio-race polyline[data-participant='balanced'] { stroke: #64d9e9; stroke-dasharray: 10 3 2 3; }
.portfolio-race__baseline { stroke: #737780; stroke-width: .5; }
.market-controls { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.league-screen__player { grid-column: 1 / -1; position: sticky; bottom: 0; z-index: 10; display: flex; align-items: center; justify-content: center; gap: 20px; padding: 10px 16px; border: 1px solid #6d5d16; border-radius: 14px; background: rgba(18, 17, 11, .96); box-shadow: 0 -8px 30px #0009; }
.league-screen__player h2 { margin: 0; color: var(--fs-yellow); }

.incoming-trade { position: fixed; z-index: 30; inset: 50% auto auto 50%; transform: translate(-50%, -50%); width: min(430px, calc(100% - 32px)); padding: 22px; border: 1px solid #8f7621; border-radius: 14px; background: #171712; box-shadow: 0 0 0 100vmax rgba(0,0,0,.68), 0 0 30px #ffd32655; }
.incoming-trade h2 { margin: 4px 0 18px; }
.trade-direction { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.trade-direction div { padding: 14px; border: 1px solid var(--fs-line); border-radius: 9px; }
.trade-direction dt { color: var(--fs-muted); }
.trade-direction dd { margin: 8px 0 0; font-size: 1.75rem; font-weight: 900; }
.incoming-trade__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
.trade-flight { pointer-events: none; position: fixed; z-index: 40; inset: 0; }
.trade-flight span { position: absolute; display: grid; place-items: center; width: 78px; height: 104px; border: 2px solid var(--fs-yellow); border-radius: 9px; background: #1b1d21; font-weight: 900; animation: trade-card-flight 700ms cubic-bezier(.2,.8,.2,1) both; }
.trade-flight span:first-child { inset: 20% 20% auto auto; }
.trade-flight span:last-child { inset: auto auto 12% 45%; animation-direction: reverse; }
@keyframes trade-card-flight { from { transform: translate(0, 0) rotate(-4deg); opacity: .2; } to { transform: translate(-34vw, 45vh) rotate(4deg); opacity: 1; } }

.results-screen { width: min(820px, calc(100% - 40px)); margin: auto; padding: clamp(60px, 10vh, 110px) 0; }
.results-screen h1 { margin: 0 0 12px; font: 700 clamp(2.5rem, 6vw, 5rem)/1 var(--font-serif, Georgia, serif); }
.results-ranking { display: grid; gap: 8px; padding: 0; list-style: none; }
.results-ranking li { display: grid; grid-template-columns: minmax(150px, 1fr) auto auto; gap: 14px; padding: 14px; border-top: 1px solid var(--fs-line); }
.results-screen__actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }

@media (max-width: 767px) {
  .fanstocks-intro { grid-template-columns: 1fr; align-content: center; width: min(100% - 32px, 480px); padding: 28px 0 56px; }
  .fanstocks-intro h1 { font-size: clamp(3rem, 15vw, 4.5rem); }
  .fanstocks-intro__table { order: -1; width: calc(100% - 46px); margin: 30px auto 6px; }
  .draft-screen { width: calc(100% - 32px); padding-top: 48px; }
  .draft-screen__header { grid-template-columns: 1fr; }
  .draft-screen__hand { overflow-x: auto; justify-content: flex-start; }
  .draft-screen__cards { grid-template-columns: 1fr; }
  .stock-card { min-height: 220px; }
  .league-screen { display: block; width: 100%; padding: 16px 0 116px; }
  .league-screen > header, .league-screen__race { margin-inline: 16px; }
  .league-screen > header { align-items: flex-start; }
  .league-screen__board { min-height: 290px; margin: 18px 0; border-inline: 0; border-radius: 0; background: #101215; }
  .league-screen__deck { display: none; }
  .opponent-table { position: static; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(230px, 78vw); gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-inline: contain; padding: 12px 16px 22px; }
  .opponent-seat { position: static; width: auto; min-height: 245px; scroll-snap-align: center; padding: 18px; border: 1px solid var(--fs-line); border-radius: 14px; background: var(--fs-panel); }
  .portfolio-race svg { height: 150px; }
  .league-screen__player { position: fixed; inset: auto 8px 8px; justify-content: space-between; }
  .league-screen__player h2 { font-size: 1rem; }
  .results-ranking li { grid-template-columns: 1fr; gap: 3px; }
  .results-screen__actions { display: grid; }
}

@media (prefers-reduced-motion: reduce) {
  .fanstocks-app *, .fanstocks-app *::before, .fanstocks-app *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
  .stock-card:hover { transform: none; }
  .trade-flight { display: none; }
}
```

- [ ] **Step 5: Run style and all FanStocks component tests**

Run: `npm exec vitest run -- src/games/fanstocks/ui src/games/fanstocks/FanStocksRoute.test.tsx && npm run typecheck`
Expected: PASS; the CSS contract finds all six required responsive/accessibility declarations.

- [ ] **Step 6: Commit responsive visual styling**

```bash
git add src/games/fanstocks/fanstocks.css src/games/fanstocks/ui/FanStocksStyles.test.tsx
git commit -m "style: polish responsive FanStocks table"
```

### Task 15: Verify the complete draft, trade, close, persistence, and rematch path in Chromium

**Files:**
- Create: `e2e/fanstocks.spec.ts`

**Interfaces:**
- Consumes: the public hash route `/#/fanstocks?seed=<seed>&rules=1`, only accessible names/classes already defined, and Playwright's clock.
- Produces: one deterministic browser proof spanning every core phase without production-only test controls.

- [ ] **Step 1: Write the complete failing E2E flow**

```ts
import { expect, test, type Page } from '@playwright/test';

async function draftFirstCandidate(page: Page, round: number) {
  await expect(page.getByRole('heading', { name: `Round ${round} of 3 · Pick 1 stock` })).toBeVisible();
  await page.locator('.stock-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /^Draft [A-Z]{1,5}$/ }).click();
}

test('drafts, accepts and offers trades, closes Friday, persists, and rematches', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/fanstocks?seed=e2e-fanstocks&rules=1');
  await page.getByRole('button', { name: 'Start drafting' }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await draftFirstCandidate(page, 1);
  await draftFirstCandidate(page, 2);
  await draftFirstCandidate(page, 3);
  await expect(page.getByText('AI opponents are building their portfolios.')).toBeVisible();
  await page.clock.fastForward(650);
  await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Current portfolio standings' })).toContainText('$50.00');

  await page.getByRole('button', { name: 'Set market speed to 4x' }).click();
  await page.clock.fastForward(12_500);
  await expect(page.getByText('You receive')).toBeVisible();
  await page.getByRole('button', { name: /^Accept: receive / }).click();
  await expect(page.getByRole('status')).toContainText('Trade complete');

  await page.getByRole('button', { name: 'Offer Balanced a trade' }).click();
  await page.getByRole('group', { name: 'You give' }).getByRole('radio').first().check();
  await page.getByRole('group', { name: 'You receive' }).getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Send trade offer' }).click();
  await expect(page.getByText(/Trade (accepted|rejected)/)).toBeVisible();

  await page.clock.fastForward(18_750);
  await page.getByRole('button', { name: 'Pass on trade' }).click();
  await page.clock.fastForward(18_750);
  await page.getByRole('button', { name: 'Pass on trade' }).click();
  await page.clock.fastForward(25_000);
  await expect(page.getByText('Friday close')).toBeVisible();
  await expect(page.locator('.results-ranking > li')).toHaveCount(4);

  await page.getByRole('button', { name: 'Rematch same table' }).click();
  await expect(page.getByRole('heading', { name: 'Round 1 of 3 · Pick 1 stock' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Round 1 of 3 · Pick 1 stock' })).toBeVisible();
  await expect(page).toHaveURL(/seed=e2e-fanstocks%3Arematch%3A1&rules=1/);
});
```

- [ ] **Step 2: Run Chromium E2E and verify the first red state**

Run: `npm exec playwright test -- e2e/fanstocks.spec.ts --project=chromium`
Expected before route integration is complete: FAIL at `Start drafting`; after Tasks 1–14 it must PASS in under 30 seconds of wall time.

- [ ] **Step 3: Fix only product defects exposed by the E2E test**

For each failure, preserve the public accessible locator from the test and change the product state/markup rather than adding `data-testid` or a test-only clock branch. The accepted final run must show no `pageerror`, unhandled promise rejection, or console error.

- [ ] **Step 4: Re-run Chromium E2E twice for deterministic stability**

Run: `npm exec playwright test -- e2e/fanstocks.spec.ts --project=chromium --repeat-each=2`
Expected: `2 passed`; both runs reach the same three incoming-offer ticks and Friday-close ranking.

- [ ] **Step 5: Commit the full-flow browser proof**

```bash
git add e2e/fanstocks.spec.ts
git commit -m "test: cover complete FanStocks league"
```

### Task 16: Add responsive, keyboard, touch, reduced-motion, and failure-recovery E2E coverage

**Files:**
- Create: `e2e/fanstocks-responsive.spec.ts`

**Interfaces:**
- Consumes: the same public route and foundation settings/persistence behavior.
- Produces: release-gate coverage at all five required widths with no horizontal page overflow.

- [ ] **Step 1: Write the breakpoint and keyboard-dialog tests**

```ts
import { expect, test } from '@playwright/test';

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`FanStocks has no page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    await page.goto(`/#/fanstocks?seed=responsive-${width}&rules=1`);
    await expect(page.getByRole('heading', { name: 'Fantasy Stock Leagues' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test('card detail supports keyboard entry, wrapped navigation, Escape, and focus return', async ({ page }) => {
  await page.goto('/#/fanstocks?seed=keyboard&rules=1');
  await page.getByRole('button', { name: 'Start drafting' }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  const first = page.locator('.stock-card').first();
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Previous stock' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(first).toBeFocused();
});
```

- [ ] **Step 2: Add the mobile table/touch and reduced-motion trade tests**

```ts
test.describe('touch table', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
  test('uses a scroll-snap opponent strip and pinned player hand', async ({ page }) => {
    await page.clock.install();
    await page.goto('/#/fanstocks?seed=touch&rules=1');
    await page.getByRole('button', { name: 'Start drafting' }).tap();
    await page.getByRole('button', { name: 'Got it' }).tap();
    for (let round = 1; round <= 3; round += 1) {
      await page.locator('.stock-card').first().tap();
      await page.getByRole('button', { name: /^Draft / }).tap();
    }
    await page.clock.fastForward(650);
    await expect(page.locator('.opponent-table')).toHaveCSS('scroll-snap-type', 'x mandatory');
    await expect(page.locator('.league-screen__player')).toHaveCSS('position', 'fixed');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});

test('reduced motion keeps trade status but never mounts card flight', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/#/fanstocks?seed=reduced&rules=1');
  await page.getByRole('button', { name: 'Start drafting' }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  for (let round = 1; round <= 3; round += 1) {
    await page.locator('.stock-card').first().click();
    await page.getByRole('button', { name: /^Draft / }).click();
  }
  await page.clock.fastForward(1);
  await page.getByRole('button', { name: 'Set market speed to 4x' }).click();
  await page.clock.fastForward(12_500);
  await page.getByRole('button', { name: /^Accept: receive / }).click();
  await expect(page.getByRole('status')).toContainText('Trade complete');
  await expect(page.getByTestId('trade-flight')).toHaveCount(0);
});
```

- [ ] **Step 3: Add recoverable corrupt-save coverage without mutating unrelated storage**

```ts
test('corrupt FanStocks storage offers isolated reset and hub recovery', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('opentrade.fanstocks', '{broken');
    localStorage.setItem('unrelated', 'keep');
  });
  await page.goto('/#/fanstocks');
  await expect(page.getByRole('dialog', { name: 'FanStocks progress could not be loaded' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset FanStocks progress' }).click();
  expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep');
  await expect(page.getByRole('heading', { name: 'Fantasy Stock Leagues' })).toBeVisible();
});
```

- [ ] **Step 4: Run the responsive suite in Chromium**

Run: `npm exec playwright test -- e2e/fanstocks-responsive.spec.ts --project=chromium`
Expected: PASS, 8 tests; all five widths report `scrollWidth <= clientWidth`, touch uses scroll snap, Escape restores card focus, and reduced motion renders no flight layer.

- [ ] **Step 5: Run Firefox and WebKit smoke paths after Chromium is stable**

Run: `npm exec playwright test -- e2e/fanstocks.spec.ts e2e/fanstocks-responsive.spec.ts --project=firefox --project=webkit --grep "complete|320px|keyboard"`
Expected: PASS in both projects; clipboard or focus differences must be fixed in product code, not skipped by browser name.

- [ ] **Step 6: Commit cross-input verification**

```bash
git add e2e/fanstocks-responsive.spec.ts
git commit -m "test: harden FanStocks accessibility and responsiveness"
```

### Task 17: Run final FanStocks quality gates and inspect the production build

**Files:**
- Modify only if a gate exposes a FanStocks defect: files already listed in Tasks 1–16.

**Interfaces:**
- Consumes: the complete FanStocks route and project release scripts.
- Produces: a lint-clean, strictly typed, tested, built, deterministic FanStocks vertical slice.

- [ ] **Step 1: Run every FanStocks unit and component test**

Run: `npm exec vitest run -- src/games/fanstocks`
Expected: PASS; no skipped or todo tests, unhandled errors, changed snapshots, or timer leaks.

- [ ] **Step 2: Run project lint and strict typecheck**

Run: `npm run lint && npm run typecheck`
Expected: both commands exit `0`; no unsafe `any`, hook-dependency, mutation, or accessibility lint errors in `src/games/fanstocks`.

- [ ] **Step 3: Build the static production application**

Run: `npm run build`
Expected: exit `0`; `dist/index.html` exists, the FanStocks route is a separate lazy chunk, and `StockArtwork` emits no image requests because its card variants are CSS/data-driven.

- [ ] **Step 4: Run deterministic Chromium release paths**

Run: `npm exec playwright test -- e2e/fanstocks.spec.ts e2e/fanstocks-responsive.spec.ts --project=chromium`
Expected: PASS; zero page errors, console errors, network-dependent mechanics, horizontal overflow, focus traps, or persistent animation in reduced-motion mode.

- [ ] **Step 5: Inspect final diff scope before the last commit**

Run: `git status --short && git diff --check && git diff --stat`
Expected: only FanStocks files and the two FanStocks E2E files are changed; `git diff --check` prints nothing.

- [ ] **Step 6: Commit the verified vertical slice if defect fixes were required**

```bash
git add src/games/fanstocks e2e/fanstocks.spec.ts e2e/fanstocks-responsive.spec.ts
git commit -m "fix: verify FanStocks release gates"
```

Do not create this final commit when Step 5 shows no changes after the prior task commits.

## Execution handoff

Implement task-by-task with `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Do not begin FanStocks implementation until the foundation contracts at the top of this plan compile exactly; if the foundation implementation differs, reconcile the foundation first so FanStocks does not grow a compatibility adapter.
