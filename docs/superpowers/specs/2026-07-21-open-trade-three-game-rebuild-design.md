# OpenTrade three-game rebuild design

Date: 2026-07-21  
Status: Approved by delegated product judgment  
Repository: `frenzy2004/Open-Trade`

## 1. Product intent

Build a polished browser game hub containing faithful, improved recreations of:

1. FanStocks — a three-round stock-card draft followed by a simulated portfolio race and one-for-one AI trades.
2. Founder Mode — five historical founder decisions per episode, with Reality-versus-You valuation feedback and a scored ending.
3. Wallstreet Surfers — a three-lane endless runner combining obstacle avoidance, market-direction gates, coins, streaks, and a pursuing Powell character.

The user explicitly delegated ambiguous decisions to the implementer. The selected scope is a production-quality, self-contained simulation that requires no brokerage account, real-money flow, authentication, or live market-data subscription. It must remain fully playable after first load, be deterministic for testing, and deploy both as a static GitHub Pages site and as a Higgsfield browser game package.

The rebuild will preserve the observed mechanics, pacing, visual hierarchy, and playful financial tone while improving accessibility, responsiveness, state clarity, replayability, failure recovery, and deterministic verification. It will use original code, copy, and Higgsfield-generated artwork rather than copying proprietary source assets or implementation.

## 2. Evidence base

The design is based on direct browser play and screenshot capture of all three public games.

- FanStocks was played through all three draft rounds, card-detail inspection, AI portfolio completion, live value movement, an incoming trade rejection, and an incoming trade acceptance.
- Founder Mode was played through all five Netflix decisions and its ending; the episode archive and classic/brainrot writing-style toggle were inspected.
- Wallstreet Surfers was played repeatedly with keyboard controls through market signage, coins, lane movement, jump/roll inputs, a market-direction gate, barriers, a ticker train collision, game-over, restart, and best-score persistence.

Detailed evidence and failed-attempt analysis lives in `docs/research/open-trade-reverse-engineering.md`.

## 3. Architecture options considered

### Option A — React shell plus lazy Phaser runner (selected)

Use Vite, React, and TypeScript for the hub, FanStocks, Founder Mode, settings, persistence, and accessible overlays. Load Phaser only inside the Wallstreet Surfers route. Keep gameplay rules in pure TypeScript modules so they can be tested without rendering.

Advantages:

- Best DOM accessibility for text-heavy games.
- Mature scene, input, audio, collision, and scaling support for the runner.
- Phaser does not inflate the initial hub bundle.
- Pure mechanics remain deterministic and independently testable.

Trade-off: the runner adapter must cleanly mount and destroy Phaser on route changes.

### Option B — React plus custom Canvas runner

Use React for the application and a hand-written Canvas 2D runner.

Advantages: lower dependency weight and full rendering control.  
Trade-off: the project would own collision, object pooling, scaling, touch gestures, pause/resume, audio timing, and fixed-timestep correctness. That work does not improve the product enough to justify the risk.

### Option C — Phaser-first application

Implement the hub and every game as Phaser scenes with DOM overlays.

Advantages: one rendering and transition system.  
Trade-off: weaker semantic text, keyboard navigation, screen-reader behavior, responsive document layout, and component testing. This conflicts with the observed text density of FanStocks and Founder Mode.

## 4. Technical structure

The repository will use:

- Node 24
- npm with committed `package-lock.json`
- Vite + React + TypeScript
- React Router with hash routing for static hosting
- Phaser, pinned to an exact stable patch, lazy-loaded only by the runner route
- Vitest for pure logic and component tests
- Playwright for end-to-end, responsive, keyboard, pointer, and touch verification
- ESLint and TypeScript strict mode

Suggested module boundaries:

```text
src/
  app/                    # shell, navigation, route registry, settings
  shared/
    rng/                  # seeded pseudo-random generator
    persistence/          # versioned local save adapter and migrations
    audio/                # shared mute/volume policy
    ui/                   # buttons, modal, toast, progress, cards
    content/              # validation helpers and shared disclaimers
  games/
    fanstocks/
      engine/             # draft, price simulation, AI trades, ranking
      content/            # stock cards and AI personalities
      ui/                 # React screens and animations
    founder-mode/
      engine/             # five-step decision graph and scoring
      content/            # four episode graphs and cited sources
      ui/                 # React screens, charts, result recap
    wallstreet-surfers/
      engine/             # deterministic spawns, scoring, gates, collisions
      phaser/             # scenes, renderer, input and audio adapter
      content/            # obstacle/gate pools and tuning
  assets/                 # generated and optimized local media
```

Games may import shared services but may not import one another. Each route exposes a small contract: metadata, entry component, save key, reset function, and optional challenge-seed parser.

## 5. Shared hub and product shell

The hub recreates the observed three-card presentation with a warm off-white editorial surface, strong type, responsive card grid, keyboard-focus treatment, and one generated cover per game. It adds:

- Visible `Play`, `How it works`, and `Reset progress` actions.
- Shared sound and reduced-motion controls.
- Clear `Simulated game — not investment advice` labeling.
- Progress badges for active FanStocks league, Founder streak, and runner best score.
- A stable URL seed for repeatable demos and challenges.
- Installable/offline support after core routes stabilize.

All interface text is rendered by code, never baked into generated images.

## 6. FanStocks design

### Core loop

1. Start a guest league.
2. Read a compact tutorial.
3. Draft one stock from each of three candidate groups.
4. Inspect any candidate through a detail sheet with thesis, evidence bullets, navigation, Back, and Draft.
5. Watch three AI opponents finish their own three-card portfolios.
6. Run a compressed deterministic “market week” in which every portfolio begins at $50.
7. Receive and decide one-for-one AI trade offers; optionally initiate a trade by selecting an opponent.
8. Reach simulated Friday close, rank all portfolios, and show a replay/rematch result screen.

### Data and simulation

- Use a curated set of recognizable public tickers with explicit synthetic-demo labeling.
- Each card defines sector, volatility, momentum bias, correlation group, thesis, evidence bullets, and one square generated illustration.
- A seeded price engine produces bounded paths from factor shocks plus card-specific volatility.
- AI personalities map to deterministic draft and trade preferences:
  - Momentum: favors trend and volatile upside.
  - Contrarian: favors laggards and mean reversion.
  - Balanced: favors diversification and risk-adjusted value.
- A complete session lasts roughly five minutes, with pause and speed controls for inspection.
- Challenge URLs store only seed and ruleset version, not personal data.

### Fidelity improvements

- Persistent hand slots say `Round 2 of 3 · Pick 1 stock` to remove progress ambiguity.
- Trade cards explicitly label `You receive` and `You give` while retaining quick accept/pass controls.
- Accepted trades animate between hands and produce a concise confirmation toast.
- Mobile uses a horizontally pageable opponent table with the player hand pinned below.
- A proper Friday-close results screen covers ranking, tie handling, decisive picks/trades, rematch, and new league.

## 7. Founder Mode design

### Core loop

1. Select an episode and writing style: classic or brainrot.
2. Assume the role of a founder in a documented historical scenario.
3. Read one dilemma and choose one of three strategies.
4. Receive `Matched history` and `Outcome` judgments, original historical/alternate prose, and a valuation delta.
5. Repeat for exactly five decisions.
6. See a final Reality-versus-You valuation, decision recap, founder-style mix, result tier, replay, and episode picker.

### Episode scope

Version one includes four complete five-decision episodes matching the observed archive shape:

- Netflix, 2011
- Kodak, 1975
- Apple, 1997
- Blockbuster, 2000

Each episode contains original writing grounded in primary or reputable historical sources stored as content metadata. Classic and brainrot variants express the same facts and outcome values; style must never change mechanics.

### Scoring

- Each option carries a valuation multiplier, history-match boolean, success band, and founder-style weights.
- Values are deterministic and validated at build/test time.
- The final tier derives from value versus historical reality plus resilience and boldness scores.
- All five decision pips are interactive recaps rather than unexplained colors.

### Fidelity improvements

- Decision choices appear above the fold at 720px height.
- Charts directly label both endpoints and have text equivalents.
- Status chips use unambiguous icons and explanations instead of an `×` that resembles a close control.
- The final founder-style mix explains its calculation.
- Winning and losing paths receive equally useful narrative feedback.

## 8. Wallstreet Surfers design

### Core loop

1. Start from a cinematic illustrated splash screen.
2. Auto-run across three lanes while Powell closes the gap.
3. Move left/right, jump, or roll using keyboard, touch swipes/buttons, or declared gamepad controls.
4. Collect coins, avoid barriers and ticker trains, and pass market gates.
5. At a market gate, answer `LONG` with Up or `SHORT` with Down; correct answers increase streak and push Powell back.
6. Speed and density ramp by distance.
7. Collision or a depleted Powell gap ends the run with a specific failure message.
8. Restart instantly or share the seed as a challenge.

### Determinism and tuning

- Fixed logical viewport with Phaser FIT scaling and centered world coordinates.
- Fixed-timestep simulation and seeded obstacle/gate sequence.
- Three discrete lanes; jump and roll have explicit invulnerability windows by obstacle type.
- Object pools cover coins, trains, barriers, signs, and scenery.
- Market gates are generated from an authored question bank with unambiguous answers and difficulty tags.
- Score combines distance, coins, correct-gate streak, and near-miss bonuses.
- A developer overlay can show seed, distance, lane, current obstacle, collision bounds, and next gate. It is disabled in production unless `?debug=1` is present.

### Fidelity improvements

- A short interactive tutorial pauses the world and verifies each input once.
- Market-gate prompt text is legible before the response window.
- Touch controls have visible alternatives to gesture-only play.
- Reduced-motion mode lowers camera shake, parallax, and screen flashes.
- Every failure message identifies the collision source and offers one actionable tip.

## 9. Visual and audio system

Higgsfield will produce original assets under one shared style formula. The formula is fixed before any generation and repeated byte-for-byte in every visual prompt:

> High-contrast editorial finance arcade art combining cinematic collage, hand-inked contours, subtle risograph grain, dramatic perspective, and clean geometric silhouettes. Use an off-black and warm-ivory foundation with electric market-yellow, signal-red, and gain-green accents. Characters are original, expressive market archetypes rather than existing meme or brand mascots. Lighting uses warm rim highlights and deep graphic shadows. Keep backgrounds readable behind interface overlays, avoid embedded text, logos, watermarks, tiny details, and photorealistic clutter.

Game-specific treatments stay inside that shared system:

- FanStocks: smoky card-room glamour, monochrome collage cards, colored seat glows, chips and table felt.
- Founder Mode: sparse editorial portraits and episode covers; interface remains mostly typographic.
- Wallstreet Surfers: exaggerated perspective, original bull/bear trains, layered meme-street collage, readable hazards and pickups.

Higgsfield routing:

- `nano_banana_flash` for most static art.
- `gpt_image_2` only for controlled hero composition when necessary.
- `flux_2` to establish runner animation key poses.
- `seedance1_5` plus manual frame extraction/background removal for run, jump, and hit sheets because AutoSprite is unavailable.
- `seed_audio` for essential UI, coin, gate, jump, collision, and ambience effects.
- `sonilo_music` for one loop per game only when it materially improves the experience.

Generated assets are inspected, optimized, and stored locally. Interface frames, cards, labels, prices, charts, buttons, and all readable text remain HTML/CSS/Canvas code.

## 10. Persistence, privacy, and failure handling

- Store only game state, settings, ruleset version, seed, and timestamp in localStorage.
- Version saves and provide migrations; corrupted or incompatible saves fall back to a recoverable reset prompt.
- Never store identity, brokerage, payment, or sensitive financial data.
- Missing images render a branded fallback instead of breaking a game.
- Audio failures degrade silently to muted play.
- Every route has an error boundary with retry and return-to-hub actions.
- Pause simulation on hidden tabs and resume without large time jumps.
- A reset/demo menu can clear one game or all local progress.

## 11. Accessibility and responsive behavior

- Keyboard access and visible focus for every DOM action.
- Proper dialog focus trap, Escape close, and focus return.
- Text alternatives for charts, trade direction, and decision markers.
- Color never carries meaning alone.
- Live regions announce only meaningful state changes, not per-frame/per-second updates.
- Minimum 44px touch targets.
- Responsive checks at 320, 375, 768, 1024, and 1440 CSS pixels.
- Non-Latin keyboard layouts use `event.code`.
- The runner supports keyboard, touch-only play, and declared gamepad input.

## 12. Testing and quality gates

### Unit and content tests

- Seeded RNG repeatability.
- FanStocks draft legality, value conservation, AI roster completion, trade swaps, ranking, ties, and restart.
- Founder graph reachability, exactly five decisions, no dangling outcomes, deterministic scoring, and classic/brainrot fact parity.
- Runner lane bounds, spawn solvability, collision types, jump/roll timing, gate scoring, streak reset, Powell-gap rules, and restart.
- Save schema validation and migration.

### End-to-end tests

- Hub navigation and reset.
- One complete FanStocks draft, trade, close, and rematch.
- One complete Founder episode with ending and replay.
- Runner tutorial, a deterministic gate, collision, restart, and challenge seed.
- Keyboard, pointer, touch, responsive, reduced-motion, and offline-first-reload paths.

### Release gates

- Lint, strict typecheck, unit tests, production build, Chromium E2E.
- Firefox/WebKit smoke tests after core Chromium flow is stable.
- No console errors, network 404s, missing assets, focus traps, or horizontal page overflow.
- Runner holds the defined frame budget on the target desktop and mobile profiles.
- Higgsfield package contains root `index.html` and the required root logic module, uses relative local assets, and passes a post-deploy smoke path.

## 13. Delivery and commit strategy

Milestone commits remain independently buildable and reviewable:

1. Design and research evidence.
2. Vite/React/TypeScript project, CI, and empty deployable shell.
3. Shared tokens, routing, deterministic RNG, persistence, and hub.
4. FanStocks vertical slice and tests.
5. Founder Mode four-episode vertical slice and tests.
6. Wallstreet Surfers vertical slice and tests.
7. Higgsfield-generated asset integration and audio polish.
8. Offline support, responsive/accessibility hardening, and final release verification.
9. GitHub Pages deployment and Higgsfield game deployment.

Public marketplace publication is excluded unless separately requested. A draft pull request may be opened after the implementation branch is pushed.

