# Host Seating Planner — notes for Claude Code

Restaurant host-stand web app: React 18 + TypeScript, esbuild single-file build, no backend (state in `localStorage`).

**Start here, in order:**
1. `docs/HANDOFF.md` — living handoff: milestones, decisions, UI guidelines U1–U9, what still needs a real-device check. Read it first and only re-read code you will change.
2. `docs/PROTOCOLS.md` — token-frugality protocols T1–T30 + efficiency log. Apply them (batch edits into one call, typecheck instead of eyeballing, save edit scripts, mirror work often). Append a log entry when you notice avoidable waste.
3. `docs/SPEC.md` — original spec and the pasted algorithm/scoring spec.

**Commands:** `npm install` · `npx tsc --noEmit` · `npm run build` (→ `dist/index.html`, one self-contained file) · `npm test` (unit via esbuild+node, UI smoke via jsdom).

**Rules of the house:** one way per action (reuse `clearTables`, `enqueue`, `seatModeFor`, `tableInfo`…); every container gets a `HELP` entry; anything naming a table gets `data-tid`; numeric fields use `NumInput`; new top-right fixed widgets go in `FixedTop`; add unit + smoke checks in the same change; update HANDOFF/PROTOCOLS when you decide something.

## v2 (branch `v2/engine-sim`)
Rebuild lives in `v2/`. Read `docs/v2/CONTEXT.md` then follow `docs/v2/POLICY.md` (C code shape, E engine, U ui/sim, W workflow). Lanes own disjoint files; log gap notes per W4.
