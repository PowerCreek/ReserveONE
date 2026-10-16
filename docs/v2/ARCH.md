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
Order: E1 E2 S in parallel; E0 after E1-E2 (it imports them); U1 U3 U4 in parallel against `HostEngine` via optional-call (CONTEXT: UI lane convention); I last. U1 exports the `runner` plugin; U4 lists it in `ui/index.ts`.
| lane | owned paths | contracts | acceptance |
| --- | --- | --- | --- |
| E1 match+ladder | `v2/engine/match.ts` `ladder.ts` `rungs.ts` `spots.ts` (add `spot.feats`) + their tests | model (`wants` `feat` `offer`), policy.host (`feats` `score` `ladder` `clock`), engine (`Fit` `Rung` `Coach.match|ladder|intake`) | `npm run v2:check && node --test "v2/engine/match*.test.ts" "v2/engine/ladder*.test.ts" "v2/engine/spots.test.ts"` |
| E2 respond | `v2/engine/ask.ts` `options.ts` `respond.ts` + tests | model (`request` `mood`), policy.host (`reasons` `responses` `options` `reply`), sim (`HostEvent`), engine (`Reply` `Option` `Coach.ask|options|respond`) | `npm run v2:check && node --test "v2/engine/ask*.test.ts" "v2/engine/options*.test.ts" "v2/engine/respond*.test.ts"` |
| E0 engine wiring | `v2/engine/index.ts` `tick.ts` `spawn.ts` `seat.ts` `simctx.ts` `jobs.ts` `finish.ts` | engine (`HostEngine`), sim (`HostTask`); open item: engine `center('door')` falls back to `policy.sim.door` | `npm run v2:check && node --test "v2/engine/**/*.test.ts"` (74 tests stay green; `Engine` export becomes `HostEngine`) |
| K kernel | none (no host-service need; reopen through a W4 gap note) | - | `npm run v2:check && node --test "v2/kernel/**/*.test.ts"` stays green |
| U1 starter runner | `v2/ui/runner.ts` `runner.test.ts` `scenario.ts` (loads `scenarios[id]` beside presets) | scenario (`Scenario` `Step`), sim (`HostEvent`), `v2/scenarios/index.ts` | `npm run v2:check && node --test "v2/ui/runner*.test.ts" "v2/ui/scenario.test.ts"` |
| U3 floor selector + floor | `v2/ui/floor.ts` `floor.test.ts` `draw.ts` `geo.ts` (selector per `floor` id; feature chips on tables); open item: 4 floors overlap | model (`floor` `pos.floor` `feat`) | `npm run v2:check && node --test "v2/ui/floor*.test.ts"` |
| U4 host-stand panels | `v2/ui/stand.ts` `stand.test.ts` `events.ts` `eventlog.ts` `shell.ts` `index.ts` (greet, intake chips, ladder offers, request replies; the event log narrates host and guest events via describers for `HostEvent`, e.g. "Chen party declined the banquette and left the list") | model (`wants` `offer` `request`), engine (`Coach.*`), sim (`HostEvent`) | `npm run v2:check && node --test "v2/ui/stand*.test.ts" "v2/ui/panels.test.ts" && npm run v2:build` |
| S scenarios | `v2/scenarios/**` (data + `scenarios.test.ts` checking every feat, why, reason, step key and table id resolves in `defaultPolicy.host`) | scenario, host | `npm run v2:check && node --test "v2/scenarios/**/*.test.ts"` |
| I integration | `v2/main.ts` `v2/test/**` (not `dom.ts`) `v2/build.mjs`; open item: clean-slate idle seed (host, servers, sections) | all public `index.ts` | `npm run v2:check && npm run v2:test && npm run v2:build` |
| lead | `v2/contracts/**` `docs/v2/**` `package.json` | - | contract edits keep `v2:check` green |

## WAVE 3 LANES (service modes: DOMAIN.md "service modes"; contracts landed: `contracts/service.ts` (`ServiceCfg` `AreaDef` `Carve` `Hold`, `defaultService`), model `area|assign|service` + `staff.weight|area|crew` + `slot.told`, sim `HostTask.tell` + `ServiceEvent`, engine `Service` (inside `HostEngine` as `Partial<Service>`: `modeAt` `holds` `assign` `knows` `tell`; `Pick.by`), `policy.service`, `policy.sim.autoSeat` default false)
Order: E3a, U5, U6, V in parallel; E3b wires `engine/index.ts` once E3a's files exist (it may start earlier on `knows` `tell` `jobs` `book`); I last. When E3b lands, the lead flips `Partial<Service>` to `Service` in `contracts/engine.ts`. UI calls go through `ask` (optional-call). Policy is data: a test that needs the sim host sets `autoSeat: true` on its own policy copy (engine tests) or on `defaultPolicy.sim` (ui/integration tests).
| lane | owned paths | contracts | acceptance |
| --- | --- | --- | --- |
| E3a engine assign+modes | `v2/engine/modes.ts` (`modeAt`) `holds.ts` `assign.ts` `rotate.ts` (weight: score uses tally / `staff.weight`; `serverFor` reads the mode: sectioned = `assign` top, else section holder, else bartender pair for the table's area, else ranked fallback; rotation = best-ranked unit whose `staff.area` is unset or equals the table's area; fill `Pick.by`) `time.ts` (`minuteOfDay`) `section.ts` + `modes.test.ts` `holds.test.ts` `assign.test.ts` `rotate.test.ts` | model (`area` `assign` `service` `staff.*`), service, engine (`Service.modeAt|holds|assign`, `Pick`) | `npm run v2:check && node --test "v2/engine/modes*.test.ts" "v2/engine/holds*.test.ts" "v2/engine/assign*.test.ts" "v2/engine/rotate*.test.ts"` (existing rotate/bus tests stay green: weight defaults to 1) |
| E3b engine awareness+serve | `v2/engine/knows.ts` `tell.ts` `jobs.ts` `finish.ts` `book.ts` `seat.ts` `tick.ts` `testkit.ts` `index.ts` + `knows.test.ts` `tell.test.ts` `tick.test.ts` `seat.test.ts`. Known bugs: (1) a stand-seated guest never gets a `serve` task: `book` patches the party body (move to table, backlog `serve`) so the stand seat and the sim host share one path, `finish.follow` is dropped; (2) the sim host seats only when `policy.sim.autoSeat`; (3) `serverJob` takes a table only when `knows(table)` | model (`slot.told` `area`), service (`areas.*.seen`), sim (`ServiceEvent`), engine (`Service.knows|tell`) | `npm run v2:check && node --test "v2/engine/**/*.test.ts"` |
| U5 ui assignment + staff panel | `v2/ui/staff.ts` `assign.ts` (new) `floor.ts` `draw.ts` `geo.ts` `index.ts` `shell.ts` + `staff.test.ts` `assign.test.ts` `floor.test.ts` `panels.test.ts`: mode toggle (follows schedule / override via `service.override`), section chunks tinted on the floor, grotto carve choice, piecemeal tops per server, bartender pairs per level with weight, Deal button (`assign` patches through `commit`) | model, service, engine (`Service`), `ask` | `npm run v2:check && node --test "v2/ui/staff*.test.ts" "v2/ui/assign*.test.ts" "v2/ui/floor*.test.ts" "v2/ui/panels.test.ts" && npm run v2:build` |
| U6 ui stand tell + log | `v2/ui/stand.ts` `events.ts` `eventlog.ts` `seat.ts` `sim.ts` `log.ts` `tone.ts` + `stand.test.ts` `sim.test.ts`: "Tell {server}" on every seated table whose area is not `seen`, told / not-told chip (from `slot.told`), `told` describer for `SimEvent \| HostEvent \| ServiceEvent` (e.g. "Host told Ben about Chen party at P3"), no tell button in seen areas | model (`slot.told`), service, sim (`HostTask.tell` `ServiceEvent`), engine (`Service.tell|knows`) | `npm run v2:check && node --test "v2/ui/stand*.test.ts" "v2/ui/sim.test.ts" && npm run v2:build` |
| V venue seed | `v2/venue.ts` (`area` tag per table: main 1-24, grotto G1-6, patio P1-7, bar, upstairs) `v2/crew.ts` (new: sections, crew, `service` entity) `v2/venue.test.ts` (new): main in contiguous section chunks by table number, grotto one whole section, patio tops dealt, bar and upstairs each a bartender pair (`weight` 2, `crew` two names, `area`), floor servers `weight` 1, entity `service {override: null, carve}` | model, service | `npm run v2:check && node --test "v2/venue.test.ts"` |
| I integration | `v2/main.ts` `v2/test/**` (not `dom.ts`) `v2/build.mjs` `v2/scenarios/**` `v2/ui/runner*.ts` `v2/ui/scenario*.ts` `v2/ui/presets.ts`: seed from `crew.ts`, update tests that relied on the sim host seating (set `autoSeat: true` there), end-to-end: stand seats a patio party, the server idles until Tell, then serves; mode flips at 11:00 | all public `index.ts` | `npm run v2:check && npm run v2:test && npm run v2:build` |
| lead | `v2/contracts/**` `docs/v2/**` `package.json` | - | contract edits keep `v2:check` green |
