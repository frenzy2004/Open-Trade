# OpenTrade Season implementation plan

1. Build a UI-free deterministic domain state machine, content deck, updates, settlement, receipts, and strict versioned save codec with adversarial tests.
2. Redesign the hub around one weekly ritual and keep the three games as Market Lab practice modes.
3. Add an accessible lazy `/season` route covering draft, invite/join, all three evidence days, settlement, share, and rematch.
4. Generate and provenance one Higgsfield Season hero; add it to the asset manifest, catalog, validation plan, budgets, and offline precache.
5. Add unit, browser-component, E2E, mobile/keyboard, persistence, recovery, and full-loop tests.
6. Manually play the entire loop in the in-app browser, capture the receipt and updated hub, audit logs, and record failures/recoveries.
7. Run the full release/deployment matrix, push the final commit to `main`, redeploy Vercel, and refresh the localhost handoff.

Parallel worktrees:

- `agent/season-domain`: domain/content/persistence/tests.
- `agent/season-hub`: hub hierarchy/timeline/tests.
- `agent/season-higgsfield`: generated hero/provenance/review.
- root: route UI, integration, E2E, release audit, and deployment.
