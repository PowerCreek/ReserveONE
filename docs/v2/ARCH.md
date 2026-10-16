# v2 architecture (contract layer + lanes)
Domain truth: `docs/SPEC.md`; code rules: `docs/v2/POLICY.md`. Contracts are frozen: change them only through the lead.

## Layout (`v2/`)
- `contracts/` types + signatures only (plus `having`, `defaultPolicy`): `model` `policy` `sim` `engine` `kernel`, re-exported by `index.ts`.
- `engine/` pure domain logic, `index.ts` exports the `Engine` API (E3: no DOM). `kernel/` App, store, binders, factories, rules.
- `ui/` Tailwind views, sim canvas, `app.css` (Tailwind entry + `@theme`). `test/` integration tests + `dom.ts` (jsdom globals).
- `main.ts` wiring: `App.create(seed).use(engine).use(ui).mount(el)`. `build.mjs` -> `dist/v2.html` (esbuild + Tailwind v4 CLI, inlined).
- Imports use explicit `.ts` and `import type` (node runs the sources directly via type stripping; no enums/namespaces).

## Vocabulary (`contracts/model.ts`)
Entity = `{id, ...components}` in `World.ents` (flat `Record<Id,Entity>`, plus `nextParty`). Times are epoch ms.
- Layout: `floor`, `section`, `pos` (floor,x,y,w,h), `table`, `link` (group of tables). Derived `spot` = a table or link group (v1 "Unit"), via `engine.spots`.
- Flow: `party` (num,label,kind W/P/R/V,size) with at most one of `reservation` | `queue`; `slot` = a seating (history stays as data, E2).
- People: `staff` (sections, tally of covers, skip), `event` (private event). Sim: `body` (role guest/host/server/busser, x,y,task,backlog) makes any entity a sim *unit*.
- `Patch` = `set|add|del`; engine returns patches, `app.apply` writes them into the Proxy store.

## Engine API (`contracts/engine.ts`; all `(policy, world, now, ...args) => out`)
- seating/fit: `spots`, `fit` (progressive sequence), `lookahead`, `seat` (-> `Decision` with patches).
- turnover/ETA: `eta` (walk-in `Quote`), `turnover` (in/out `Bucket[]`). rotation: `rotate`, `serverFor`, `bus`.
- alerts: `alerts`, `reconcile` (lapse + event lock patches). sim: `tick(dtMs) -> {patches, events}`, `spawn(seed)`.
- Policy data (`contracts/policy.ts`) holds every constant; no module-level state.

## Sim protocol (`contracts/sim.ts`)
Tasks a unit can take: `move`, `seat`, `serve`, `clear`, `wait`. Events emitted: `arrived`, `seated`, `served`, `cleared`, `left`, `stuck`.
`tick` assigns tasks to idle units (host seats queue head via `seat`; server serves own section; busser clears by `bus` order), moves bodies by `speed*dt`, and turns finished tasks into events + patches. UI renders bodies and drives `tick` from a clock that writes `state.now`.

## Kernel API (`contracts/kernel.ts`)
`App.create(state).use(plugin).provide(key, part).binder(b).view(fn).act(name, fn).apply(patches).mount(el)`. `store.state` is a deep Proxy, `store.watch(path, fn, immediate)`. Binders: `data-text`, `data-class`; a MutationObserver binds/unbinds elements as they enter/leave the DOM. `Rule {when, require, apply}` + `services.rules.run` is the declarative constraint/decorator interpreter; `services.make` has entity/component factories. UI state is extended by module augmentation of `UiState`.

## LANES
| lane | owned paths | depends on | acceptance |
| --- | --- | --- | --- |
| A engine | `v2/engine/**` | `contracts/{model,policy,engine,sim}` | `npm run v2:check && node --test "v2/engine/**/*.test.ts"` |
| B kernel | `v2/kernel/**` | `contracts/{model,kernel}`, `test/dom.ts` | `npm run v2:check && node --test "v2/kernel/**/*.test.ts"` |
| C ui+sim | `v2/ui/**` | `contracts/*`, `kernel` and `engine` only via `index.ts` | `npm run v2:check && node --test "v2/ui/**/*.test.ts" && npm run v2:build` |
| D integration | `v2/test/**` (not `dom.ts`), `v2/main.ts`, `v2/build.mjs`, `v2/tsconfig.json` | all public `index.ts` | `npm run v2:check && npm run v2:test && npm run v2:build` |
| lead | `v2/contracts/**`, `v2/test/dom.ts`, `docs/v2/**`, `package.json` | - | contract edits keep `v2:check` green |
Lane-local tests live beside the code as `*.test.ts`. Skeleton stubs in lane dirs (`fit`, `kernel/index.ts`, `ui/index.ts`) are replaced in place; keep the exported names.
