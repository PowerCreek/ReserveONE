# v2 policy (all agents; each lane report cites section ids, never restates them)

## C — Code shape
- C1 Flat bodies: statements at function top level only; branching = lookup table / dispatch map / `??`; iteration = `map|filter|reduce|flatMap` or a generator, one dimension.
- C2 Line chain: every declared/assigned name is consumed by the next line; one line = one responsibility; name only what a later line uses.
- C3 Data over structure: stage tables, collectors and accumulators first (`const rules = {...}`), then fold the input through them.
- C4 Names short and exact (`seat`, `fit`, `tally`); function bodies ≤ ~12 lines.
- C5 Everything is an entity: plain data `{id, ...components}`; behaviour = functions keyed by component name; compose, never inherit.
- C6 Constraints/decorators are declarative data (`{when, require, apply}`) evaluated by one interpreter, GraphQL-style selection of fields.
- C7 Host wiring is a fluent builder: `App.create().use(engine).use(ui).mount(el)` (Program.cs/Startup shape); each `use` registers, nothing edits the core (SOLID S+O).
- C8 Reactivity = `Proxy` store + `MutationObserver` binders, assigned by one handler/factory per concern.
- C9 KISS/YAGNI: add a thing when a test or the sim needs it today.

## E — Engine
- E1 Stateless and policy-driven: `decide(policy, data, now) -> output`; no module-level mutable state.
- E2 Output derives from data state only; history is data too.
- E3 Zero UI/DOM imports under `v2/engine/`; UI talks to it through its public `index.ts` only.

## U — UI / sim
- U1 Tailwind for all styling; no hand-written CSS beyond `@theme` tokens.
- U2 Sim mode: 2D top-down restaurant; staff and guests are units that take tasks (move, seat, serve, clear); the player asserts the app's flows make sense for a scenario.

## W — Workflow (token frugality)
- W1 Start: read `docs/v2/CONTEXT.md`, then only the files your lane owns plus contracts it names.
- W2 Own files only; a lane touches nothing else. Cross-lane needs go through `v2/contracts/`.
- W3 Verify by command (`tsc`, tests) with silent success; batch edits per call.
- W4 Gap notes: whenever progress needed context you lacked or a step order you found late, log one line `need: <context> | would-have: <step/protocol> | place: <file>` in your report (≤3 lines). The lead folds them into CONTEXT.md.
- W5 Report ≤ 12 lines: files, commands run + result, gap notes.
