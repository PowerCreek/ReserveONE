import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy, having} from './contracts/index.ts'
import {Engine, merges} from './engine/index.ts'
import type {Entity} from './contracts/index.ts'
import {venue} from './venue.ts'
import {staffed} from './crew.ts'
const ents = staffed(venue([800, 520]))
const w = {nextParty: 1, ents: Object.fromEntries(ents.map(e => [e.id, e]))}
const tables = having(w, 'table', 'area')
const inArea = (a: string) => tables.filter(t => t.area.id === a)
const assign = (t: Entity) => t.assign?.staff
const labels = (ts: Entity[]) => ts.map(t => t.table!.label)

test('every table carries an area tag with the expected counts', () => {
  assert.equal(tables.length, having(w, 'table').length)
  assert.deepEqual(['main', 'grotto', 'patio', 'bar', 'upstairs'].map(a => inArea(a).length), [24, 6, 7, 18, 11])
  assert.deepEqual(labels(inArea('grotto')).sort(), ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'])
})
test('main is four quadrant blocks with balanced covers, never interleaved, held by the four floor servers', () => {
  const main = having(w, 'table', 'area', 'pos').filter(t => t.area.id === 'main')
  const sec = (label: string) => main.find(t => t.table.label === label)!.table.section
  const by = (s: number) => main.filter(t => t.table.section === `sec_m${s}`)
  const covers = [1, 2, 3, 4].map(s => by(s).reduce((a, t) => a + t.table.capacity, 0))
  assert.equal([1, 2, 3, 4].reduce((a, s) => a + by(s).length, 0), 24)
  assert.ok(Math.max(...covers) - Math.min(...covers) <= defaultPolicy.section.tol * (covers.reduce((a, b) => a + b, 0) / 4) * 2 + 2, `covers ${covers}`)
  assert.ok(new Set(['1', '2', '3', '4', '24'].map(sec)).size >= 2, 'no server holds every booth')
  assert.deepEqual([sec('5') === sec('7'), sec('13') === sec('15'), sec('6') === sec('8'), sec('14') === sec('16')], [true, true, true, true]) // each quad splits along its horizontal aisle
  assert.deepEqual([sec('5') !== sec('6'), sec('13') !== sec('14')], [true, true])
  const bx = (s: number) => { const ts = by(s); return {x0: Math.min(...ts.map(t => t.pos.x)), x1: Math.max(...ts.map(t => t.pos.x + t.pos.w)), y0: Math.min(...ts.map(t => t.pos.y)), y1: Math.max(...ts.map(t => t.pos.y + t.pos.h))} }
  const inside = (s: number, o: number) => by(o).filter(t => t.pos.x >= bx(s).x0 && t.pos.x + t.pos.w <= bx(s).x1 && t.pos.y >= bx(s).y0 && t.pos.y + t.pos.h <= bx(s).y1).length
  assert.deepEqual([1, 2, 3, 4].flatMap(s => [1, 2, 3, 4].filter(o => o !== s).map(o => inside(s, o))).filter(Boolean), [], 'no section has another section\'s table inside its bounds')
  const servers = having(w, 'staff').filter(s => !s.staff.area)
  assert.deepEqual(servers.map(s => [s.staff.weight, s.staff.sections]), [1, 2, 3, 4].map(i => [undefined, [`sec_m${i}`]]))
})
test('grotto is one whole section; patio tops are dealt across the servers', () => {
  assert.equal(new Set(inArea('grotto').map(t => t.table.section)).size, 1)
  assert.ok(inArea('grotto').every(t => t.table.section === 'sec_grotto' && !assign(t)))
  const tops = inArea('patio').map(t => assign(t))
  assert.deepEqual(tops, ['sv1', 'sv2', 'sv3', 'sv4', 'sv1', 'sv2', 'sv3'])
  assert.ok(inArea('patio').every(t => t.table.section === null))
})
test('bar and upstairs each have a bartender pair of weight 2', () => {
  const pairs = having(w, 'staff').filter(s => s.staff.area)
  assert.deepEqual(pairs.map(p => [p.staff.area, p.staff.weight, p.staff.crew?.length]), [['bar', 2, 2], ['upstairs', 2, 2]])
  assert.ok(inArea('bar').concat(inArea('upstairs')).every(t => t.table.section === null && !assign(t)))
})
test('singleton service entity, host, busser and door are present', () => {
  assert.deepEqual(w.ents.service!.service, {override: null, carve: {main: 'chunk', grotto: 'whole', patio: 'tops', bar: 'level', upstairs: 'level'}})
  assert.deepEqual(['host', 'busser'].map(r => having(w, 'body').filter(e => e.body.role === r).length), [1, 1])
  assert.deepEqual(w.ents.door!.pos, {floor: 'rf1', x: 24, y: 260, w: 0, h: 0})
  assert.equal(ents.filter(e => e.id === 'service').length, 1)
})
const main = (ids: string[]) => ids.map(n => w.ents[`rf_${n}`]!.table!)
const nums = (ids: number[]) => ids.map(String)
test('main floor capacities: booths 1-4 and 24 seat 6, the listed 2-tops seat 2, every other table is a 4-top', () => {
  const booths = ['1', '2', '3', '4', '24'], twos = ['5', '6', '7', '8', '13', '14', '15', '16', '19', '21']
  const fours = nums(Array.from({length: 24}, (_, i) => i + 1)).filter(n => ![...booths, ...twos].includes(n))
  assert.deepEqual(main(booths).map(t => [t.capacity, t.shape]), booths.map(() => [6, 'booth']))
  assert.deepEqual(main(twos).map(t => [t.capacity, t.shape]), twos.map(() => [2, 'rect']))
  assert.deepEqual(main(fours).map(t => [t.capacity, t.shape]), fours.map(() => [4, 'rect']))
  assert.deepEqual(fours, ['9', '10', '11', '12', '17', '18', '20', '22', '23'])
  assert.equal(having(w, 'table').length, 66)
})
test('every floor is laid out without overlaps; adjacency (adj) is the owner\'s runs, symmetric and on one floor', () => {
  const ts = having(w, 'table', 'pos', 'area')
  const hit = (a: typeof ts[0], b: typeof ts[0]) => a.pos.floor === b.pos.floor && a.pos.x < b.pos.x + b.pos.w && b.pos.x < a.pos.x + a.pos.w && a.pos.y < b.pos.y + b.pos.h && b.pos.y < a.pos.y + a.pos.h
  assert.deepEqual(ts.flatMap((a, i) => ts.slice(i + 1).filter(b => hit(a, b)).map(b => [a.id, b.id])), [])
  const adj = (id: string) => w.ents[id]!.adj?.with ?? []
  assert.ok(ts.every(t => adj(t.id).every(o => adj(o).includes(t.id) && w.ents[o]!.pos!.floor === t.pos.floor)))
  assert.deepEqual(['17', '19', '23', '9', '12', '1', '24'].map(n => adj(`rf_${n}`)), [['rf_18'], ['rf_18', 'rf_20'], ['rf_22'], ['rf_10'], ['rf_11'], [], []])
  assert.deepEqual(['g1', 'g2', 'g4', 'b14', 'b15', 'b21', 'b20', 'b22', 'u1', 'u4', 'u5', 'u7', 'u8'].map(n => adj(`rf_${n}`)),
    [['rf_g2'], ['rf_g1', 'rf_g3'], ['rf_g5'], ['rf_b15'], ['rf_b14', 'rf_b16'], ['rf_b20'], ['rf_b21'], [], ['rf_u2', 'rf_u5'], ['rf_u3'], ['rf_u1', 'rf_u6'], ['rf_u3', 'rf_u6'], []])
})
test('merge options come from those runs: any connected set up to policy.merge.max, across the aisle upstairs, never across floors or into the grotto from the main floor', () => {
  const ids = merges(defaultPolicy, w).map(s => s.id)
  assert.ok(['m:rf_17+rf_18+rf_19', 'm:rf_18+rf_19+rf_20+rf_21', 'm:rf_10+rf_11+rf_12', 'm:rf_g1+rf_g2+rf_g3', 'm:rf_b14+rf_b15+rf_b16', 'm:rf_b20+rf_b21'].every(i => ids.includes(i)))
  assert.ok(['m:rf_u1+rf_u5', 'm:rf_u1+rf_u2+rf_u5+rf_u6', 'm:rf_u2+rf_u3+rf_u4'].every(i => ids.includes(i)))
  assert.ok(!ids.some(i => /rf_(1|2|3|4|5|6|7|8|24|b22|b1|p1|u8|u9|u10|u_bar)(\+|$)/.test(i)), 'booths, quads, stools, patio, high tables and bar do not merge')
  assert.ok(!ids.some(i => i.split('+').length > defaultPolicy.merge.max))
  assert.ok(!ids.includes('m:rf_17+rf_18+rf_19+rf_20+rf_21'))
})
const only = (open: string[]) => ({...w, ents: Object.fromEntries(Object.entries(w.ents).map(([id, e]) => [id, e.table && !open.includes(id) ? {...e, table: {...e.table, status: 'occupied' as const}} : e]))})
test('the centre lane (9-12) is pushed together only when no other merge is ready', () => {
  const ask = (open: string[], size: number) => Engine.fit(defaultPolicy, only(open), 0, [size])[0]
  assert.deepEqual(ask(['rf_9', 'rf_10', 'rf_11', 'rf_12'], 8).tables.sort(), ['rf_10', 'rf_9']) // nothing else is free: the lane goes
  assert.deepEqual(ask(['rf_9', 'rf_10', 'rf_11', 'rf_12', 'rf_b14', 'rf_b15', 'rf_b16'], 8).tables.sort(), ['rf_b14', 'rf_b15', 'rf_b16']) // the bar run serves first
  assert.deepEqual(ask(['rf_9', 'rf_10', 'rf_11', 'rf_12', 'rf_18', 'rf_19', 'rf_20'], 8).tables.sort(), ['rf_18', 'rf_19', 'rf_20']) // so does the 17-23 run
})
test('bar stools are first come, first served: the host never offers or seats them, even when nothing else is free', () => {
  const stools = ['rf_b1', 'rf_b7', 'rf_b12', 'rf_u_bar']
  assert.deepEqual(stools.map(id => w.ents[id]!.table!.shape), Array(4).fill('stool'))
  const alone = only(stools)
  const [it] = Engine.fit(defaultPolicy, alone, 0, [1])
  assert.deepEqual([it.ready, it.tables.some(t => stools.includes(t))], [false, false]) // every other table is busy: the party waits rather than take a stool
  const d = Engine.seat(defaultPolicy, alone, 0, {size: 1, kind: 'W', tables: ['rf_b1']})
  assert.deepEqual([d.ok, d.ok ? '' : d.err], [false, 'B1 is first come, first served: the host does not seat it'])
  assert.ok(!merges(defaultPolicy, w).some(s => s.spot.tables.some(t => stools.includes(t))))
})
test('real venue: a party of 12 is pushed together from the grotto, upstairs or 17-23 before the centre lane; 2, 4 and 6 stay on a single table', () => {
  const ask = (size: number) => Engine.fit(defaultPolicy, w, 0, [size])[0]
  assert.deepEqual([ask(12).ready, ask(12).tables.length, ask(12).tables.reduce((a, t) => a + w.ents[t]!.table!.capacity, 0), ask(12).tables.some(t => ['rf_9', 'rf_10', 'rf_11', 'rf_12'].includes(t))], [true, 3, 12, false])
  assert.deepEqual([2, 4, 6].map(n => ask(n).tables.length), [1, 1, 1])
})
