// Starter runner (U1, free play): plays `scenarios[id].steps` into the sim at their minute, then the sandbox runs on. No scoring, no expectations.
import {defaultPolicy, having} from '../contracts/index.ts'
import type {App, Decision, Entity, Id, Outcome, Patch, Plugin, PType, Step} from '../contracts/index.ts'
import {scenarios} from '../scenarios/index.ts'
import {ask} from './ask.ts'
import {locate} from './geo.ts'
import {note} from './log.ts'
import {party} from './party.ts'
import {uiOf} from './state.ts'
/** Progress through one starter: `t0` = start time, `done` = steps already played, `keys` = starter-local name -> party id. */
export interface Run {id: string; t0: number; done: number; keys: Record<string, Id>}
declare module '../contracts/kernel.ts' {
  interface UiState {run?: Run}
}
type Do<K extends Step['do']> = Extract<Step, {do: K}>
type Doer<K extends Step['do']> = (app: App, x: Do<K>, id: Id) => Patch[]
const MIN = 60000
const [DX, DY] = defaultPolicy.sim.door
const WALK = defaultPolicy.sim.walkPxPerSec
const plan = (id?: string): Step[] => (scenarios[id ?? '']?.steps ?? []).map((x, i) => ({x, i})).sort((a, b) => a.x.at - b.x.at || a.i - b.i).map(r => r.x)
const due = (run: Run | undefined, now: number) => plan(run?.id).slice(run?.done ?? 0).filter(x => x.at * MIN <= now - (run?.t0 ?? 0))
/** Next party number, same rule as the engine (max party.num + 1, never below `nextParty`). */
export const mint = (app: App) => {
  const w = app.store.state.world
  const n = having(w, 'party').reduce((m, e) => Math.max(m, e.party.num + 1), w.nextParty)
  w.nextParty = n + 1
  return n
}
const queue = (now: number, quotedMin: number): Partial<Entity> => ({queue: {since: now, quotedMin, status: 'WAITING', from: null}})
const booked = (now: number): Partial<Entity> => ({reservation: {at: now, durationMin: 90, table: null, status: 'ARRIVED', phone: '', notes: ''}})
const flows: Record<PType, (now: number, quotedMin: number) => Partial<Entity>> = {W: queue, P: queue, V: queue, R: booked}
/** A guest one second of walking short of the door, heading in (engine spawn shape). */
const walkIn = (id: Id) => ({role: 'guest' as const, x: DX - WALK, y: DY, speed: WALK, task: {do: 'move' as const, x: DX, y: DY}, backlog: [], party: id})
/** The entity with its whole party on hand. */
export const here = (e: Entity, n: number): Entity => ({...e, party: {...e.party!, here: n}})
const arrive: Doer<'arrive'> = (app, x, id) => {
  const quoted = Math.round(ask(app, 'eta', x.size)?.waitMin ?? 0)
  const ent = party(Number(id.slice(1)), x.kind, x.size, x.name, {...flows[x.kind](app.store.state.now, quoted), wants: {list: x.wants, heard: []}, mood: {score: 0}, body: walkIn(id)})
  return [{op: 'add', ent: here(ent, x.size)}]
}
const complain = (app: App, d?: Decision | Outcome) => (d && !d.ok && note(app, 'warn', d.err), d?.ok ? d.patches : [])
type Stager = (app: App, e: Entity, x: Do<'place'>, body: NonNullable<Entity['body']>) => Patch[]
/** A scripted `ask` at the arrived stage needs the lease still open then: it settles a minute after that ask at the earliest (the open request then holds it). */
const holdFor = (app: App, x: Do<'place'>) => plan(uiOf(app).run?.id).filter(s => s.do === 'ask' && s.key === x.key && s.stage === 'arrived').map(s => (uiOf(app).run?.t0 ?? 0) + (s.at + 1) * MIN)
const kept = (app: App, x: Do<'place'>, id: Id): Patch[] => {
  const l = app.store.state.world.ents[id]?.lease
  return l ? [{op: 'set', id, parts: {lease: {...l, until: Math.max(l.until, ...holdFor(app, x))}}}] : []
}
/** seated = the engine books the table; arrived = led there, not seated: leased through the desk (`act lease`), the guest already at the table. */
const stages: Record<Do<'place'>['stage'], Stager> = {
  seated: (app, e, x, body) => (app.apply([{op: 'set', id: e.id, parts: {body}}]), complain(app, ask(app, 'seat', {size: e.party!.size, kind: e.party!.kind, party: e.id, tables: [x.table]}))), // at the table first: the seating then queues the guest's wait for service
  arrived: (app, e, x, body) => (app.apply(complain(app, ask(app, 'act', {do: 'lease', party: e.id, spot: x.table, step: 'exact'}))), [{op: 'set', id: e.id, parts: {body}}, ...kept(app, x, e.id)]),
}
const place: Doer<'place'> = (app, x, id) => {
  const w = app.store.state.world
  const {x: cx, y: cy} = locate(w, x.table)
  return stages[x.stage](app, w.ents[id], x, {...w.ents[id].body!, x: cx, y: cy, task: null, backlog: []})
}
const raise: Doer<'ask'> = (app, x, id) => complain(app, ask(app, 'ask', id, x.reason))
const doers: {[K in Step['do']]: Doer<K>} = {arrive, place, ask: raise}
const who: Record<Step['do'], (app: App, x: Step) => Id> = {
  arrive: app => `p${mint(app)}`, place: (app, x) => uiOf(app).run!.keys[x.key], ask: (app, x) => uiOf(app).run!.keys[x.key],
}
const exec = (app: App, x: Step) => {
  const id = who[x.do](app, x)
  uiOf(app).run!.keys[x.key] = id
  app.apply((doers[x.do] as Doer<Step['do']>)(app, x as never, id))
}
/** Play every step that is due at the current sim time (idempotent: each step plays once). */
export const play = (app: App) => {
  const run = uiOf(app).run as Run | undefined
  const todo = due(run, app.store.state.now)
  todo.length && (uiOf(app).run = {...run!, done: run!.done + todo.length})
  todo.forEach(x => exec(app, x))
}
export const stop = (app: App) => ((uiOf(app) as {run?: Run}).run = undefined)
/** Begin a starter at the current time and play its minute-0 steps. */
export const begin = (app: App, id: string) => (uiOf(app).run = {id, t0: app.store.state.now, done: 0, keys: {}}, play(app))
const wired = new WeakSet<object>()
/** Plugin: plays due steps whenever sim time moves. Safe to `use` more than once (and `load` wires it too). */
export const runner: Plugin = app => wired.has(app) || (wired.add(app), app.store.watch('now', () => play(app)))
