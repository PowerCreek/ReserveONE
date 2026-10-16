// Loading a scenario resets the world to a preset or a starter, starts the sim clock at a fixed evening, and seeds the opening guests.
import {defaultPolicy} from '../contracts/index.ts'
import type {App, Entity, Id, Patch, Scenario, Seed, TableSeed} from '../contracts/index.ts'
import {scenarios} from '../scenarios/index.ts'
import {note} from './log.ts'
import {party} from './party.ts'
import {layout, presets} from './presets.ts'
import {begin, here, mint, runner, stop} from './runner.ts'
import {spawn} from './sim.ts'
import {uiOf} from './state.ts'
export const START = Date.UTC(2026, 9, 16, 17, 0)
/** One picker row: a preset (random arrivals) or a starter (timed steps). */
export interface Choice {id: string; label: string; blurb: string; kind: 'preset' | 'starter'}
export const choices = (): Choice[] => [
  ...Object.values(presets).map((p): Choice => ({id: p.id, label: p.label, blurb: p.blurb, kind: 'preset'})),
  ...Object.values(scenarios).map((s): Choice => ({id: s.id, label: s.title, blurb: s.brief, kind: 'starter'})),
]
const unit = (role: 'host' | 'server' | 'busser', x: number, y: number) => ({role, x, y, speed: defaultPolicy.sim.walkPxPerSec, task: null, backlog: [], party: null})
const room = (s: Seed, sec: Id): Entity[] => s.tables.map(t => ({
  id: t.id, pos: {floor: t.floor ?? 'f1', x: t.x, y: t.y, w: t.w, h: t.h}, feat: {tags: t.feats},
  table: {label: t.label, capacity: t.capacity, min: 1, shape: t.feats.includes('booth') ? 'booth' : 'rect', status: 'available', waiter: null, section: t.section ?? sec},
}))
const crew = (s: Seed, secs: Id[]): Entity[] => s.servers.map((v, i) => ({
  id: v.id, body: unit('server', 740, 40 + i * 40),
  staff: {name: v.name, active: true, sections: v.sections.length ? v.sections : secs, lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 40},
}))
const dining = (app: App, now: number, s: Seed) => (b: NonNullable<Seed['busy']>[number], i: number): Patch[] => {
  const t = s.tables.find(r => r.id === b.table)!, num = mint(app), at = now - b.minAgo * 60000
  const ent = party(num, 'W', b.size, `Table ${t.label}`, {mood: {score: 0}, body: {...unit('server', t.x + t.w / 2, t.y + t.h / 2), role: 'guest', party: `p${num}`}})
  return [
    {op: 'add', ent: here(ent, b.size)},
    {op: 'add', ent: {id: `slot-${num}-${at}`, slot: {table: t.id, party: ent.id, seatedAt: at, turnAt: at + defaultPolicy.seat.turnDefault * 60000, status: 'ACTIVE'}}},
    {op: 'set', id: t.id, parts: {table: {...app.store.state.world.ents[t.id].table!, status: 'occupied', waiter: s.servers[i % s.servers.length].id}}},
  ]
}
const floors = (ts: TableSeed[]): Entity[] => [...new Set(['f1', ...ts.map(t => t.floor ?? 'f1')])].map(id => ({id, floor: {name: id, active: true}}))
const base = (s: Seed): Entity[] => {
  const secs = s.sections ?? [{id: 's1', name: 'Main'}]
  return [
    ...floors(s.tables),
    {id: 'door', pos: {floor: 'f1', x: defaultPolicy.sim.door[0], y: defaultPolicy.sim.door[1], w: 0, h: 0}},
    ...secs.map((x, i): Entity => ({id: x.id, section: {name: x.name, color: ['#0ea5e9', '#f59e0b', '#10b981'][i % 3]}})),
    {id: 'host', body: unit('host', 70, 260)},
    {id: 'bus1', body: unit('busser', 740, 480)},
    ...room(s, secs[0].id), ...crew(s, secs.map(x => x.id)),
  ]
}
/** Starter seed -> patches: wipe the old world, add room + crew, then seat the busy tables (set after add, so order matters). */
const seeded = (app: App, sc: Scenario, now: number): Patch[] => {
  const adds = [...Object.keys(app.store.state.world.ents).map((id): Patch => ({op: 'del', id})), ...base(sc.seed).map((ent): Patch => ({op: 'add', ent}))]
  app.apply(adds)
  return (sc.seed.busy ?? []).flatMap(dining(app, now, sc.seed))
}
const preset = (app: App, id: string) => {
  const p = presets[id], s = app.store.state
  app.apply(layout(p, Object.keys(s.world.ents), START))
  s.now = START
  s.world.nextParty = 1
  Object.assign(uiOf(app), {scenario: id, rate: p.rate, speed: p.speed, running: false, acc: 0, log: [], fx: []})
  spawn(app, p.guests)
  note(app, 'info', `Loaded "${p.label}": ${p.blurb}`)
}
const starter = (app: App, id: string) => {
  const sc = scenarios[id], s = app.store.state
  s.now = START
  s.world.nextParty = 1
  app.apply(seeded(app, sc, START))
  Object.assign(uiOf(app), {scenario: id, rate: 0, speed: 5, running: false, acc: 0, log: [], fx: []})
  note(app, 'info', `Loaded "${sc.title}": ${sc.brief}`)
  begin(app, id)
}
const loaders: Record<Choice['kind'], (app: App, id: string) => void> = {preset, starter}
export const load = (app: App, id: string) => {
  runner(app)
  stop(app)
  loaders[scenarios[id] ? 'starter' : 'preset'](app, id)
}
