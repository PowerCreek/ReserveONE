// Wiring (C7): seed the real venue with a crew, provide the engine, mount the ui last. `persist` stays opt-in.
import {App} from './kernel/index.ts'
import {Engine} from './engine/index.ts'
import {spawn, ui} from './ui/index.ts'
import {defaultPolicy} from './contracts/index.ts'
import type {Entity, Id, Plugin, State} from './contracts/index.ts'
import {venue} from './venue.ts'
const [dx, dy] = defaultPolicy.sim.door
const walk = defaultPolicy.sim.walkPxPerSec
const door = (floor: string): Entity => ({id: 'door', pos: {floor, x: dx, y: dy, w: 0, h: 0}})
/** Sections follow the floors; each server owns one. */
const sections: {id: Id; name: string; color: string; floors: Id[]; server: string}[] = [
  {id: 'sec_main', name: 'Main Room', color: '#0ea5e9', floors: ['rf1'], server: 'Ana'},
  {id: 'sec_bar', name: 'Bar', color: '#f59e0b', floors: ['rf2'], server: 'Ben'},
  {id: 'sec_out', name: 'Patio & Upstairs', color: '#10b981', floors: ['rf3', 'rf4'], server: 'Cy'},
]
/** Features per floor, per shape, and per table (policy.host.feats ids); a table carries the union. */
const byFloor: Record<Id, string[]> = {rf1: [], rf2: ['loud'], rf3: ['patio', 'window', 'sunny'], rf4: ['quiet']}
const byShape = {booth: ['booth'], rect: ['chairs']}
const byTable: Record<Id, string[]> = {rf_g1: ['door'], rf_g2: ['door'], rf_1: ['window'], rf_2: ['window'], rf_9: ['accessible'], rf_10: ['accessible'], rf_24: ['roomy'], rf_u8: ['roomy'], rf_u_bar: ['bar'], rf_b20: ['hightop'], rf_b22: ['hightop']}
const dress = (e: Entity): Entity => {
  const sec = sections.find(s => s.floors.includes(e.pos?.floor ?? ''))
  const tags = [...byShape[e.table?.shape ?? 'rect'], ...(byFloor[e.pos?.floor ?? ''] ?? []), ...(byTable[e.id] ?? [])]
  return e.table ? {...e, feat: {tags}, table: {...e.table, section: sec?.id ?? null}} : e
}
const unit = (role: 'host' | 'server' | 'busser', x: number, y: number) => ({role, x, y, speed: walk, task: null, backlog: [], party: null})
const crew = (): Entity[] => [
  {id: 'host', body: unit('host', 70, 260)}, {id: 'bus1', body: unit('busser', 740, 480)},
  ...sections.map((s, i): Entity => ({id: `sv${i + 1}`, body: unit('server', 740, 40 + i * 40), staff: {name: s.server, active: true, sections: [s.id], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 40}})),
  ...sections.map((s): Entity => ({id: s.id, section: {name: s.name, color: s.color}})),
]
const entities = () => [...venue(defaultPolicy.sim.floor).map(dress), door('rf1'), ...crew()]
/** Fresh load: the venue, a host stand, 3 servers in 3 sections. Arrivals are off until Play, but the +guest buttons and the opening party work at once. */
export const seed = (): State => ({now: Date.now(), ui: {size: 2, pick: '', tone: '', rate: 0.5}, world: {nextParty: 1, ents: Object.fromEntries(entities().map(e => [e.id, e]))}})
const engine: Plugin = app => app.provide('engine', Engine)
const opening: Plugin = app => spawn(app, 1) // one party at the door so the stand has someone to greet
export const build = () => App.create(seed()).use(engine).use(ui).use(opening)
export const start = (el: Element) => build().mount(el)
if (typeof document !== 'undefined' && document.getElementById('app')) start(document.getElementById('app')!)
