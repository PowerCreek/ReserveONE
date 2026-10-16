// Scenario presets are data (C3): tables, links, crew, opening guests, arrival rate, speed, reservations. `layout` folds one into patches.
import {defaultPolicy} from '../contracts/index.ts'
import type {Entity, Id, Patch} from '../contracts/index.ts'
import {party} from './party.ts'
type Tbl = [label: string, cap: number, x: number, y: number, sec: 0 | 1]
export interface Preset {id: string; label: string; blurb: string; tables: Tbl[]; links: [string, string][]; servers: number; guests: number; rate: number; speed: number; res: [name: string, size: number, inMin: number][]}
const room: Tbl[] = [
  ['T1', 2, 100, 60, 0], ['T2', 2, 100, 160, 0], ['T3', 4, 200, 60, 0], ['T4', 4, 200, 170, 0], ['T5', 2, 100, 300, 0], ['T6', 4, 200, 310, 0],
  ['T7', 4, 420, 60, 1], ['T8', 4, 540, 60, 1], ['T9', 6, 420, 190, 1], ['T10', 2, 580, 190, 1], ['T11', 8, 420, 320, 1], ['T12', 6, 580, 320, 1],
]
export const presets: Record<string, Preset> = {
  lunch: {id: 'lunch', label: 'Quiet lunch', blurb: 'Light traffic, full crew: the happy path.', tables: room, links: [], servers: 2, guests: 4, rate: 0.5, speed: 5, res: [['Alvarez', 2, 20]]},
  rush: {id: 'rush', label: 'Friday rush', blurb: 'Heavy walk-ins, reservations due, queue builds.', tables: room, links: [['T7', 'T8']], servers: 2, guests: 10, rate: 3, speed: 30, res: [['Chen', 4, 10], ['Okafor', 6, 25], ['Rossi', 2, 40]]},
  thin: {id: 'thin', label: 'Short staffed', blurb: 'One server for two sections: rotation and alerts.', tables: room, links: [], servers: 1, guests: 8, rate: 1.5, speed: 10, res: [['Kim', 4, 15]]},
  big: {id: 'big', label: 'Big parties', blurb: 'Large groups force link groups and long waits.', tables: room, links: [['T3', 'T4'], ['T9', 'T10']], servers: 2, guests: 6, rate: 1, speed: 10, res: [['Patel', 8, 15], ['Novak', 10, 30]]},
}
const dims = (cap: number) => ({2: [56, 56], 4: [72, 72]}[cap as 2 | 4] ?? [cap > 6 ? 130 : 110, 64])
const body = (role: 'host' | 'server' | 'busser', x: number, y: number) => ({role, x, y, speed: defaultPolicy.sim.walkPxPerSec, task: null, backlog: [], party: null})
const table = ([label, cap, x, y, sec]: Tbl): Entity => {
  const [w, h] = dims(cap)
  return {id: label.toLowerCase(), pos: {floor: 'f1', x, y, w, h}, table: {label, capacity: cap, min: 1, shape: cap > 4 ? 'booth' : 'rect', status: 'available', waiter: null, section: `s${sec + 1}`}}
}
const server = (i: number, n: number): Entity => ({
  id: `sv${i + 1}`, body: body('server', 740, 40 + i * 40),
  staff: {name: ['Ana', 'Ben', 'Cy'][i], active: true, sections: n > 1 ? [`s${i + 1}`] : ['s1', 's2'], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 40},
})
const reserve = (now: number, [name, size, inMin]: Preset['res'][number], i: number): Entity => party(100 + i, 'R', size, name, {
  reservation: {at: now + inMin * 60000, durationMin: 90, table: null, status: 'BOOKED', phone: '', notes: ''},
})
export const layout = (p: Preset, old: Id[], now: number): Patch[] => [
  ...old.map((id): Patch => ({op: 'del', id})),
  ...[
    {id: 'f1', floor: {name: 'Main', active: true}},
    {id: 'door', pos: {floor: 'f1', x: defaultPolicy.sim.door[0], y: defaultPolicy.sim.door[1], w: 0, h: 0}}, // spawn point: engine and floor view agree via policy
    {id: 's1', section: {name: 'Window', color: '#0ea5e9'}},
    {id: 's2', section: {name: 'Patio', color: '#f59e0b'}},
    {id: 'host', body: body('host', 70, 260)},
    {id: 'bus1', body: body('busser', 740, 480)},
    ...p.tables.map(table),
    ...p.links.map(([a, b]): Entity => ({id: `k-${a}-${b}`, link: {members: [a.toLowerCase(), b.toLowerCase()]}})),
    ...Array.from({length: p.servers}, (_, i) => server(i, p.servers)),
    ...p.res.map((r, i) => reserve(now, r, i)),
  ].map((ent): Patch => ({op: 'add', ent})),
]
