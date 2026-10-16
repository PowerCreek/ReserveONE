// The seeded crew (C3): sections dealt over the venue's tables, floor servers, bartender pairs, host, busser, the `service` singleton and the door. main.ts composes `staffed(tables)`.
import {defaultPolicy, defaultService} from './contracts/index.ts'
import type {Carve, Entity, Id} from './contracts/index.ts'
import {partition} from './engine/partition.ts'
import {POSTS} from './venue.ts'
const NAMES = ['Ana', 'Ben', 'Cy', 'Dot']
const COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#a855f7']
const PAIRS: [area: string, crew: [string, string]][] = [['bar', ['Eli', 'Fay']], ['roof', ['Gus', 'Hal']]]
const walk = defaultPolicy.sim.walkPxPerSec
const [dx, dy] = defaultPolicy.sim.door
type Deal = {section?: Id; assign?: Id}
type Dealt = [Id, Deal][]
const num = (e: Entity) => parseInt(e.table!.label.replace(/\D/g, ''), 10)
/** Per area: how its tables are held. Main is carved into spatial clusters of balanced covers (engine.partition); bar and roof are held by their pair (`staff.area`), not by the table. */
const deals: Record<string, (ts: Entity[]) => Dealt> = {
  main: ts => partition(defaultPolicy, ts, NAMES.length).flatMap((ids, i): Dealt => ids.map(id => [id, {section: `sec_m${i + 1}`}])),
  grotto: ts => ts.map((t): [Id, Deal] => [t.id, {section: 'sec_grotto'}]),
  patio: ts => ts.sort((a, b) => num(a) - num(b)).map((t, i): [Id, Deal] => [t.id, {assign: `sv${(i % NAMES.length) + 1}`}]),
}
const areaOf = (e: Entity) => e.area?.id ?? 'main'
const dealt = (es: Entity[], area: string): Dealt => deals[area]!(es.filter(e => e.table && areaOf(e) === area))
const mark = (e: Entity, d: Deal): Entity => ({...e, table: {...e.table!, section: d.section ?? null}, ...(d.assign ? {assign: {staff: d.assign}} : {})})
/** Deal sections (main clusters by position and covers, grotto whole) and patio tops over the tables; other entities pass through. */
export const carve = (es: Entity[]): Entity[] => {
  const hold = Object.fromEntries(Object.keys(deals).flatMap(a => dealt(es, a)))
  return es.map(e => (e.id in hold ? mark(e, hold[e.id]!) : e))
}
const unit = (role: 'host' | 'server' | 'busser', x: number, y: number) => ({role, x, y, speed: walk, task: null, backlog: [], party: null})
const staff = (name: string, extra: object = {}) => ({name, active: true, sections: [], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 40, ...extra})
const servers = (): Entity[] => NAMES.map((n, i) => ({id: `sv${i + 1}`, body: unit('server', ...POSTS.servers[i]!), staff: staff(n, {sections: [`sec_m${i + 1}`]})}))
const pairs = (): Entity[] => PAIRS.map(([area, c], i) => ({id: `bt_${area}`, body: unit('server', ...POSTS.pairs[i]!), staff: staff(c.join(' & '), {weight: 2, area, crew: c})}))
const sections = (): Entity[] => [...NAMES.map((n, i) => ({id: `sec_m${i + 1}`, section: {name: `${n}'s chunk`, color: COLORS[i]!}})), {id: 'sec_grotto', section: {name: 'Grotto', color: '#ef4444'}}]
const carves = (): Record<Id, Carve> => Object.fromEntries(Object.entries(defaultService.areas).map(([id, a]) => [id, a.carve[0]!]))
/** Host (at the stand in the lobby), busser, 4 floor servers, 2 bartender pairs (parked per venue POSTS, clear of tables), sections, the `service` singleton and the door spawn point. */
export const crew = (): Entity[] => [
  {id: 'host', body: unit('host', ...POSTS.host)}, {id: 'bus1', body: unit('busser', ...POSTS.bus)},
  ...servers(), ...pairs(), ...sections(),
  {id: 'service', service: {override: null, carve: carves()}},
  {id: 'door', pos: {floor: 'rf1', x: dx, y: dy, w: 0, h: 0}},
]
/** The full seed: tables dealt, then the crew. */
export const staffed = (tables: Entity[]): Entity[] => [...carve(tables), ...crew()]
