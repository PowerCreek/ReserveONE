// Test-only fixtures (not exported from index.ts): the v1 demo scenario as v2 entities, plus a mini builder.
import {defaultPolicy} from '../contracts/index.ts'
import type {Entity, PType, TStatus, World} from '../contracts/index.ts'
import {MIN} from './time.ts'
export const P = defaultPolicy
export const N = new Date(2026, 5, 1, 18, 0, 0).getTime()
export const mins = (n: number) => n * MIN
type Row = [id: string, label: string, cap: number, x: number, y: number, section: string, floor: string]
const rows: Row[] = [
  ['t1', 'A1', 2, 40, 40, 'sA', 'f1'], ['t2', 'A2', 2, 80, 40, 'sA', 'f1'], ['t3', 'A3', 4, 200, 40, 'sA', 'f1'], ['t4', 'A4', 4, 320, 40, 'sA', 'f1'], ['t5', 'A5', 2, 440, 40, 'sA', 'f1'],
  ['t6', 'B1', 4, 40, 200, 'sB', 'f1'], ['t7', 'B2', 4, 160, 200, 'sB', 'f1'], ['t8', 'B3', 6, 280, 200, 'sB', 'f1'], ['t9', 'B4', 8, 440, 200, 'sB', 'f1'],
  ['t10', 'C1', 4, 40, 360, 'sC', 'f1'], ['t11', 'C2', 4, 200, 360, 'sC', 'f1'], ['t12', 'C3', 2, 360, 360, 'sC', 'f1'], ['t13', 'C4', 2, 440, 360, 'sC', 'f1'],
  ['p1', 'P1', 2, 40, 40, 'sD', 'f2'], ['p2', 'P2', 4, 160, 40, 'sD', 'f2'], ['p3', 'P3', 4, 320, 40, 'sD', 'f2'], ['p4', 'P4', 6, 40, 200, 'sD', 'f2'],
]
// [slot, table, waiter, party num, size, minutes ago, minutes left, status]
type Occ = [string, string, string, number, number, number, number, 'ACTIVE' | 'LAPSED']
const occ: Occ[] = [['s1', 't3', 'w1', 1, 4, 35, 25, 'ACTIVE'], ['s2', 't6', 'w3', 2, 4, 50, 10, 'ACTIVE'], ['s3', 't7', 'w3', 3, 3, 70, -10, 'LAPSED'], ['s4', 't10', 'w4', 4, 3, 20, 40, 'ACTIVE']]
export const table = (id: string, cap: number, status: TStatus = 'available', section: string | null = null, waiter: string | null = null, floor = 'f1', x = 0): Entity =>
  ({id, pos: {floor, x, y: 0, w: 80, h: 80}, table: {label: id.toUpperCase(), capacity: cap, min: 1, shape: 'rect', status, waiter, section}})
export const staff = (id: string, tally: number, idleMin: number, over: Partial<Entity['staff'] & object> = {}): Entity =>
  ({id, staff: {name: id, active: true, sections: [], lastSeatedAt: N - mins(idleMin), tally, skip: 0, maxCovers: 18, ...over}})
export const party = (num: number, kind: PType, size: number, name = `G${num}`, extra: Partial<Entity> = {}): Entity =>
  ({id: `pty${num}`, party: {num, label: `HS-${kind}-${num}`, prefix: 'HS', kind, name, size}, ...extra})
export const world = (ents: Entity[], nextParty = 100): World => ({nextParty, ents: Object.fromEntries(ents.map(e => [e.id, e]))})
const taken = (id: string) => occ.find(o => o[1] === id)
const ofRow = ([id, label, capacity, x, y, section, floor]: Row): Entity => ({id, pos: {floor, x, y, w: 80, h: 80},
  table: {label, capacity, min: 1, shape: 'rect', status: !taken(id) ? 'available' : taken(id)![7] === 'LAPSED' ? 'lapsed' : 'occupied', waiter: taken(id)?.[2] ?? null, section}})
const seated = ([sid, table, , num, size, ago, left, status]: Occ, now: number): Entity[] =>
  [party(num, 'W', size), {id: sid, slot: {table, party: `pty${num}`, seatedAt: now - mins(ago), turnAt: now + mins(left), status}}]
const crew: [string, string, string, number, number][] = [['w1', 'Maya', 'sA', 12, 35], ['w2', 'Dev', 'sB', 6, 60], ['w3', 'Sam', 'sC', 14, 20], ['w4', 'Lee', 'sD', 9, 12]]
/** Two floors, four 1:1 stations, four seated/lapsed parties, a booked 6-top, a late 2-top, one queued walk-in. */
export const demo = (now = N): World => {
  const sections = ['sA', 'sB', 'sC', 'sD'].map(id => ({id, section: {name: id, color: '#fff'}}))
  const res = (num: number, size: number, at: number, table: string | null): Entity => party(num, 'R', size, `R${num}`, {reservation: {at: now + mins(at), durationMin: 90, table, status: 'BOOKED', phone: '', notes: ''}})
  return world([
    ...rows.map(ofRow), ...occ.flatMap(o => seated(o, now)), ...sections, {id: 'a1', link: {members: ['t1', 't2']}},
    ...crew.map(([id, name, sec, tally, ago]) => staff(id, tally, ago, {name, sections: [sec]})),
    res(5, 6, 30, 't8'), res(6, 2, -20, null), res(8, 4, 26 * 60, 't3'),
    party(7, 'W', 2, 'Chen', {queue: {since: now - mins(8), quotedMin: 15, status: 'WAITING', from: null}}),
  ], 9)
}
