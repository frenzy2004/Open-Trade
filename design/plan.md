# Open Trade Arcade — Build Contract

This file is the compact assembly contract required by the Higgsfield game preflight. Product rationale, observed source mechanics, and task-level implementation details live in `docs/`; this file freezes the gameplay numbers that generated assets and code must share.

## Experience

The player feels like a sharp market operator because the arcade constantly turns financial judgment into immediate, readable consequences.

The suite is solo, simulated, deterministic, and playable without accounts, live market data, brokerage connections, or real money. FanStocks emphasizes calculation and anticipation; Founder Mode emphasizes discovery and story; Wallstreet Surfers emphasizes execution and pattern mastery. Sessions last roughly 5–12 minutes. The hub remembers progress and always exposes the next action.

## Shared delivery profile

- Platforms: desktop keyboard, mobile touch, and standard gamepad.
- Rendering: semantic React UI for the hub, FanStocks, and Founder Mode; a lazy Phaser canvas for Wallstreet Surfers.
- Simulation: pure TypeScript engines, seeded RNG, command objects, and a 60 Hz fixed timestep for the runner.
- Persistence: versioned local storage with safe decoding and reset-on-corruption behavior.
- Sharing: deterministic challenge seeds encoded in relative URLs; no realtime multiplayer.
- Accessibility: no hover-only actions, 44 px minimum targets, visible focus, reduced motion, mute, semantic charts, and color-independent signals.
- Localization: player-visible strings are centralized data rather than scattered UI literals.

## Frozen style formula

High-contrast editorial finance arcade art combining cinematic collage, hand-inked contours, subtle risograph grain, and clean geometric silhouettes. Use off-black and warm-ivory environments; original market-archetype characters contrast in electric market-yellow, signal-red, and gain-green accents. Lighting uses warm rim highlights and deep graphic shadows. Keep interface illustrations flat-frontal, and runner scenes in a consistent forward-facing one-point perspective. Preserve readable silhouettes and muted background detail, with no embedded text, logos, watermarks, tiny details, or photorealistic clutter.

Every visual generation prompt must include that paragraph byte-for-byte. Asset-specific prompt text may identify content, key color, crop, and perspective role but may not paraphrase the formula. Audio prompts preserve its confident analog-finance energy conceptually.

## FanStocks

- Start with a `$50.00` simulated portfolio and an empty three-slot draft.
- Play exactly three rounds. Each round presents exactly three candidates from a seeded twelve-card universe.
- A candidate detail view exposes ticker, company, thesis, bullets, previous, next, back, and draft.
- ChatGPT, Claude, and Gemini use distinct deterministic draft priorities and hold comparable starting portfolios.
- Market movement is drawn before the player's trade decision and advances on a bounded 60-tick seeded tape.
- Each incoming trade is one-for-one. Pass preserves the holding; accept removes exactly the offered holding and adds exactly the requested holding.
- Rankings update after every draft, market tick batch, and trade. Highest Friday-close value wins.

## Founder Mode

- Ship Netflix 2011, Kodak 1975, Apple 1997, and Blockbuster 2000.
- Each episode has exactly five decisions with exactly three choices per decision.
- A choice changes valuation and three style axes immediately, then appears again in the final recap.
- Classic and Brainrot change presentation copy only; IDs, mechanics, scores, and outcomes remain identical.
- The ending compares the player's valuation with the historical benchmark, explains the style mix, updates the completion streak once per local calendar day, and supports replay.

## Wallstreet Surfers

- Three lanes: `-1`, `0`, `1`. Commands: left, right, jump/LONG, roll/SHORT, pause, restart.
- Fixed simulation step: `1000 / 60` ms. The adapter processes at most five catch-up steps after a frame gap.
- Lane transition: 180 ms. Jump window: 760 ms. Roll window: 650 ms.
- Obstacles are barriers and ticker trains; pickups are coins; market gates ask LONG=Up or SHORT=Down.
- A correct gate increases streak and Powell gap. A wrong gate resets streak and reduces the gap.
- The schedule generator proves at least one reachable response path in every spawn window for 100 reference seeds through 5,000 m.
- A seed plus command stream reproduces a run exactly. `?dev=1` exposes seed, fps, frame time, entity count, draw count, distance, and programmatic input controls.

## Feedback and economy

- Every accepted input produces immediate visual state, sound when unmuted, and a later state echo.
- FanStocks uses cash, holdings, and mark-to-market value; every source has a visible sink or position effect.
- Founder Mode uses valuation and explainable style weights; no hidden score changes are allowed.
- Wallstreet Surfers uses distance, coins, streak, and Powell gap. Coins reward route risk but never purchase gameplay power in v1.
- Shared gain green and signal red are always paired with icons, labels, motion, or shape so color is never the only channel.

## Entry and mastery

- Launch to hub requires one screen; hub card to first meaningful action requires at most two explicit presses.
- FanStocks teaches inspect then draft, introduces portfolio ranking, then tests trades.
- Founder Mode introduces one decision at a time and ends with a combined five-choice consequence recap.
- Wallstreet Surfers teaches lane change, jump, roll, then combines them with market gates before full-speed schedules.
- Return visits show saved progress and a direct continue/replay action.

## Asset contract

`design/assets.csv` is authoritative. Every row must resolve to a relative packaged file, and every shipped generated file must serve a listed role. CSS and semantic text supply tickers, company marks, labels, charts, and episode variants so generated images never need embedded words or logos.
