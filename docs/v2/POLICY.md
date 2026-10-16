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

## R — Reference shapes (real code from the skeleton; imitate, do not copy blindly)
R1 Engine decide: data stages first, then a one-line fold (`v2/engine/index.ts`; C1 C2 C3 E1).
```ts
const open = (w: World, size: number) => having(w, 'table').filter(t => t.table.status === 'available' && t.table.capacity >= size)
const tightest = (ts: Ent<'table'>[]) => ts.reduce<Ent<'table'> | undefined>((b, t) => (b && b.table.capacity <= t.table.capacity ? b : t), undefined)
const item = (size: number, now: number, t?: Ent<'table'>): SeqItem =>
  ({size, spot: t?.id ?? null, tables: t ? [t.id] : [], label: t?.table.label ?? '-', waitMin: 0, at: now, code: t ? 'HOT_GREEN' : 'NO_TABLE', ready: !!t})
export const fit: Engine['fit'] = (_p, w, now, sizes) => sizes.map(size => item(size, now, tightest(open(w, size))))
```
R2 Fluent wiring: each `use` registers, nothing edits the core (`v2/main.ts`, `v2/ui/index.ts`; C7 C8).
```ts
export const build = () => App.create(seed()).use(app => app.provide('engine', {fit})).use(ui)
export const ui: Plugin = app => {
  app.act('more', a => a.store.state.ui.size++).view(el => (el.innerHTML = html))
  app.store.watch('ui.size', () => refit(app), true) // engine call lives in a named step, not in the handler
}
```
R3 Declarative binders: one table, one factory, the observer attaches them (`v2/kernel/index.ts`; C3 C6 C8).
```ts
const builtin: Binder[] = [
  {attr: 'data-text', apply: (el, v) => (el.textContent = String(v ?? ''))},
  {attr: 'data-class', apply: (el, v) => (el.className = `${base(el as HTMLElement)} ${v ?? ''}`)},
]
const bind = (el: Element) => live.set(el, binders.filter(b => el.hasAttribute(b.attr)).map(b => store.watch(el.getAttribute(b.attr)!, v => b.apply(el, v), true)))
```
