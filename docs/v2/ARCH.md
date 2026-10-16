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

## WAVE 2 LANES (host service: DOMAIN.md; contracts landed: model `wants|feat|offer|request|mood`, `contracts/host.ts`, `contracts/scenario.ts`, `sim.ts` HostTask/HostEvent, `engine.ts` Coach/HostEngine, `policy.host`)
Order: E1 E2 E3 S in parallel; E0 after E1-E3 (it imports them); U1 U2 U3 U4 in parallel against `HostEngine` via optional-call (CONTEXT: UI lane convention); I last. U1 and U2 export plugins (`runner`, `assessPane`); U4 lists them in `ui/index.ts`.
| lane | owned paths | contracts | acceptance |
| --- | --- | --- | --- |
| E1 match+ladder | `v2/engine/match.ts` `ladder.ts` `rungs.ts` `spots.ts` (add `spot.feats`) + their tests | model (`wants` `feat` `offer`), policy.host (`feats` `score` `ladder` `clock`), engine (`Fit` `Rung` `Coach.match|ladder|intake`) | `npm run v2:check && node --test "v2/engine/match*.test.ts" "v2/engine/ladder*.test.ts" "v2/engine/spots.test.ts"` |
| E2 respond | `v2/engine/ask.ts` `options.ts` `respond.ts` + tests | model (`request` `mood`), policy.host (`reasons` `responses` `options` `reply`), sim (`HostEvent`), engine (`Reply` `Option` `Coach.ask|options|respond`) | `npm run v2:check && node --test "v2/engine/ask*.test.ts" "v2/engine/options*.test.ts" "v2/engine/respond*.test.ts"` |
| E3 assess | `v2/engine/assess.ts` `metrics.ts` `trace.ts` + tests | scenario (`Trace` `Assessment` `Score` `Check`), policy.host (`rubric` `pass`), engine (`Coach.assess`) | `npm run v2:check && node --test "v2/engine/assess*.test.ts" "v2/engine/metrics*.test.ts" "v2/engine/trace*.test.ts"` |
| E0 engine wiring | `v2/engine/index.ts` `tick.ts` `spawn.ts` `seat.ts` `simctx.ts` `jobs.ts` `finish.ts` | engine (`HostEngine`), sim (`HostTask`); open item: engine `center('door')` falls back to `policy.sim.door` | `npm run v2:check && node --test "v2/engine/**/*.test.ts"` (74 tests stay green; `Engine` export becomes `HostEngine`) |
| K kernel | none (no host-service need; reopen through a W4 gap note) | - | `npm run v2:check && node --test "v2/kernel/**/*.test.ts"` stays green |
| U1 scenario runner | `v2/ui/runner.ts` `runner.test.ts` `scenario.ts` (loads `scenarios[id]` beside presets) | scenario (`Scenario` `Step`), sim (`HostEvent`), `v2/scenarios/index.ts` | `npm run v2:check && node --test "v2/ui/runner*.test.ts" "v2/ui/scenario.test.ts"` |
| U2 assessment panel | `v2/ui/assess.ts` `assess.test.ts` | scenario (`Assessment`), engine (`Coach.assess`) | `npm run v2:check && node --test "v2/ui/assess*.test.ts"` |
| U3 floor selector + floor | `v2/ui/floor.ts` `floor.test.ts` `draw.ts` `geo.ts` (selector per `floor` id; feature chips on tables); open item: 4 floors overlap | model (`floor` `pos.floor` `feat`) | `npm run v2:check && node --test "v2/ui/floor*.test.ts"` |
| U4 host-stand panels | `v2/ui/stand.ts` `stand.test.ts` `events.ts` `eventlog.ts` `shell.ts` `index.ts` (greet, intake chips, ladder offers, request replies; describers for `HostEvent`) | model (`wants` `offer` `request`), engine (`Coach.*`), sim (`HostEvent`) | `npm run v2:check && node --test "v2/ui/stand*.test.ts" "v2/ui/panels.test.ts" && npm run v2:build` |
| S scenarios | `v2/scenarios/**` (data + `scenarios.test.ts` checking every feat, why, reason, step key and table id resolves in `defaultPolicy.host`) | scenario, host | `npm run v2:check && node --test "v2/scenarios/**/*.test.ts"` |
| I integration | `v2/main.ts` `v2/test/**` (not `dom.ts`) `v2/build.mjs`; open item: clean-slate idle seed (host, servers, sections) | all public `index.ts` | `npm run v2:check && npm run v2:test && npm run v2:build` |
| lead | `v2/contracts/**` `docs/v2/**` `package.json` | - | contract edits keep `v2:check` green |
