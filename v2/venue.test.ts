import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy, having} from './contracts/index.ts'
import {Engine, merges} from './engine/index.ts'
import type {Entity} from './contracts/index.ts'
import {venue} from './venue.ts'
import {staffed} from './crew.ts'
const ents = staffed(venue(defaultPolicy.sim.floor))
const w = {nextParty: 1, ents: Object.fromEntries(ents.map(e => [e.id, e]))}
const tables = having(w, 'table', 'area')
const inArea = (a: string) => tables.filter(t => t.area.id === a)
const assign = (t: Entity) => t.assign?.staff
const labels = (ts: Entity[]) => ts.map(t => t.table!.label)

test('every table carries an area tag with the expected counts', () => {
  assert.equal(tables.length, having(w, 'table').length)
  assert.deepEqual(['main', 'grotto', 'patio', 'bar', 'roof'].map(a => inArea(a).length), [24, 6, 7, 18, 11])
  assert.deepEqual(labels(inArea('grotto')).sort(), ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'])
})
test('main is four quadrant blocks with balanced covers, never interleaved, held by the four floor servers', () => {
  const main = having(w, 'table', 'area', 'pos').filter(t => t.area.id === 'main')
  const sec = (n: string) => main.find(t => t.table.label === `T${n}`)!.table.section
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
test('bar and roof each have a bartender pair of weight 2', () => {
  const pairs = having(w, 'staff').filter(s => s.staff.area)
  assert.deepEqual(pairs.map(p => [p.staff.area, p.staff.weight, p.staff.crew?.length]), [['bar', 2, 2], ['roof', 2, 2]])
  assert.ok(inArea('bar').concat(inArea('roof')).every(t => t.table.section === null && !assign(t)))
})
test('singleton service entity, host, busser and door are present', () => {
  assert.deepEqual(w.ents.service!.service, {override: null, carve: {main: 'chunk', grotto: 'whole', patio: 'tops', bar: 'level', roof: 'level'}})
  assert.deepEqual(['host', 'busser'].map(r => having(w, 'body').filter(e => e.body.role === r).length), [1, 1])
  assert.deepEqual(w.ents.door!.pos, {floor: 'rf1', x: defaultPolicy.sim.door[0], y: defaultPolicy.sim.door[1], w: 0, h: 0})
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
test('every level is laid out without overlaps (floors on one level share its frame); adjacency (adj) is the owner\'s runs, symmetric and on one floor', () => {
  const ts = having(w, 'table', 'pos', 'area')
  const level = (t: typeof ts[0]) => w.ents[t.pos.floor]!.floor!.level
  const hit = (a: typeof ts[0], b: typeof ts[0]) => level(a) === level(b) && a.pos.x < b.pos.x + b.pos.w && b.pos.x < a.pos.x + a.pos.w && a.pos.y < b.pos.y + b.pos.h && b.pos.y < a.pos.y + a.pos.h
  assert.deepEqual(ts.flatMap((a, i) => ts.slice(i + 1).filter(b => hit(a, b)).map(b => [a.id, b.id])), [])
  const adj = (id: string) => w.ents[id]!.adj?.with ?? []
  assert.ok(ts.every(t => adj(t.id).every(o => adj(o).includes(t.id) && w.ents[o]!.pos!.floor === t.pos.floor)))
  assert.deepEqual(['17', '19', '23', '9', '12', '1', '24'].map(n => adj(`rf_${n}`)), [['rf_18'], ['rf_18', 'rf_20'], ['rf_22'], ['rf_10'], ['rf_11'], [], []])
  assert.deepEqual(['g1', 'g2', 'g4', 'b14', 'b15', 'b21', 'b20', 'b22', 'r1', 'r2', 'r4', 'r5', 'r7', 'r8', 'r9'].map(n => adj(`rf_${n}`)),
    [['rf_g2'], ['rf_g1', 'rf_g3'], ['rf_g5'], ['rf_b15'], ['rf_b14', 'rf_b16'], ['rf_b20'], ['rf_b21'], [], ['rf_r2', 'rf_r5'], ['rf_r1', 'rf_r3', 'rf_r6'], ['rf_r3'], ['rf_r1', 'rf_r6'], ['rf_r3', 'rf_r6'], [], []])
})
test('labels are the owner\'s: T1-T24, G, B, P, R; floors are named and stacked on two levels', () => {
  const by = (a: string) => labels(inArea(a))
  assert.deepEqual(by('main'), Array.from({length: 24}, (_, i) => `T${i + 1}`))
  assert.ok(by('bar').every(l => /^B\d+$/.test(l)) && by('patio').every(l => /^P\d+$/.test(l)))
  assert.deepEqual(by('roof'), [...Array.from({length: 10}, (_, i) => `R${i + 1}`), 'Bar'])
  assert.deepEqual(having(w, 'floor').map(f => [f.id, f.floor.name, f.floor.level]), [['rf1', 'Main Dining Room', 0], ['rf2', 'Bar', 0], ['rf3', 'Patio', 0], ['rf4', 'Roof', 1]])
  assert.deepEqual(['r1', 'r8', 'r9', 'r10', 'r_bar'].map(n => [w.ents[`rf_${n}`]!.table!.capacity, w.ents[`rf_${n}`]!.feat!.tags.includes('hightop')]), [[4, false], [6, true], [4, true], [2, true], [10, false]])
})
const p = (n: string) => w.ents[`rf_${n}`]!.pos!
const at = (a: string) => having(w, 'table', 'area', 'pos').filter(t => t.area.id === a)
const cx = (n: string) => p(n).x + p(n).w / 2
const cy = (n: string) => p(n).y + p(n).h / 2
const wall = Math.max(...nums([17, 18, 19, 20, 21, 22, 23, 24]).map(n => p(n).y + p(n).h)) // main's bottom wall (T17's)
const G = defaultPolicy.sim.grid
const zones = having(w, 'zone', 'pos')
const zone = (label: string) => zones.find(z => z.zone.label === label)!.pos
type Box = {x: number; y: number; w: number; h: number}
const holds = (o: Box, i: Box) => i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h
const crosses = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
test('level 0 is one frame: the bar sits right of the walkway along T4/T15/T16/T24, the patio below T17-T24 and clear of the bar', () => {
  const walk = Math.max(...['4', '15', '16', '24'].map(n => p(n).x + p(n).w))
  assert.deepEqual(new Set(['b4', 'b5', 'b6', 'b7', 'b8'].map(n => p(n).x)).size, 1, 'B4-B8 form one column')
  assert.ok(['b4', 'b20', 'b16'].every(n => p(n).x > walk) && at('bar').every(t => t.pos.x >= p('b16').x), 'the B20/B4-B8/B16 column faces main across the walkway')
  assert.ok(['b20', 'b4', 'b5', 'b6', 'b7', 'b8', 'b16'].every((n, i, a) => i === 0 || p(a[i - 1]!).y < p(n).y), 'B20 heads the column, B16 ends it')
  assert.ok(at('patio').every(t => t.pos.y > wall && t.pos.x + t.pos.w < p('b4').x), 'patio in front of main, clear of the bar')
})
test('roof (owner): R1-R4 on T17\'s line, R5-R7 across from R1-R3, R9/R10 between R7 and the bar, R8 centred on the bar an aisle off, R10 above and left of R8', () => {
  const [bar, r8, r9, r10, r7] = ['r_bar', 'r8', 'r9', 'r10', 'r7'].map(p)
  assert.deepEqual(['r1', 'r2', 'r3', 'r4'].map(n => p(n).y), Array(4).fill(p('17').y), 'R1-R4 on T17-T24\'s line')
  assert.ok(['r1', 'r2', 'r3', 'r4'].every((n, i, a) => i === 0 || cx(a[i - 1]!) < cx(n)), 'R1-R4 left to right')
  assert.deepEqual([['r5', 'r1'], ['r6', 'r2'], ['r7', 'r3']].map(([a, b]) => p(a!).x === p(b!).x && p(a!).y + p(a!).h < p(b!).y), [true, true, true], 'R5-R7 one aisle above R1-R3, same columns')
  assert.ok([r9!, r10!].every(r => r.x >= r7!.x + r7!.w && r.x + r.w <= bar!.x), 'R9 and R10 between R7 and the roof bar')
  assert.equal(cy('r8'), cy('r_bar'), 'R8 centred along the bar\'s length')
  assert.ok(bar!.x - (r8!.x + r8!.w) >= 2 * G, 'an aisle between R8 and the bar')
  assert.ok(r10!.y + r10!.h < r8!.y && cx('r10') < cx('r8'), 'R10 across the aisle above R8, to its left')
  const [stairs, walkTop, corner] = ['Stairs down', 'Top walk', 'Stair corner'].map(zone)
  assert.ok(stairs!.x <= p('r5').x && stairs!.y + stairs!.h <= p('r5').y && stairs!.y <= r9!.y, 'the stairs arrive top-left, above R5')
  assert.ok(walkTop!.x === stairs!.x + stairs!.w && walkTop!.x + walkTop!.w === r9!.x && walkTop!.y === r9!.y, 'from the stairs the top walk runs right to R9, the first table')
  assert.ok(corner!.x <= r7!.x && corner!.x + corner!.w >= r7!.x + r7!.w && corner!.y + corner!.h <= r7!.y && corner!.y >= walkTop!.y + walkTop!.h, 'a corner (wall) above R7, below the walk')
})
test('the door is on the bottom wall in the lower-left corner, the lobby just inside it, the stairs above the lobby; the policy door and the crew agree', () => {
  const [door, lobby, stairs, swall] = ['Front door', 'Lobby', 'Stairs to the roof', 'Stair wall'].map(zone)
  const [dx, dy] = defaultPolicy.sim.door
  assert.equal(door!.y, wall, 'door on T17\'s wall, facing out')
  assert.ok(door!.x + door!.w <= p('17').x && door!.x <= Math.min(...having(w, 'table', 'pos').filter(t => w.ents[t.pos.floor]!.floor!.level === 0).map(t => t.pos.x)), 'lower-left corner')
  assert.ok(holds({...door!, y: door!.y - 1, h: door!.h + 1}, {x: dx, y: dy, w: 0, h: 0}), 'policy.sim.door is the door')
  assert.ok(lobby!.y + lobby!.h === door!.y && lobby!.x <= door!.x && lobby!.x + lobby!.w <= p('17').x && lobby!.w >= 6 * G, 'lobby (about two tables wide) just inside the door, left of T17')
  assert.ok(stairs!.y + stairs!.h <= lobby!.y && stairs!.x === lobby!.x && stairs!.x + stairs!.w < lobby!.x + lobby!.w, 'stairs behind the stand, their foot reached right, up, then left')
  assert.ok(swall!.y === stairs!.y + stairs!.h && swall!.y + swall!.h === lobby!.y, 'a wall between lobby and stairs')
  const host = having(w, 'body').find(b => b.body.role === 'host')!.body
  assert.ok(holds(lobby!, {x: host.x, y: host.y, w: 0, h: 0}), 'host at the stand in the lobby')
  const ts = having(w, 'table', 'pos')
  assert.deepEqual(having(w, 'body').filter(b => ts.some(t => holds(t.pos, {x: b.body.x, y: b.body.y, w: 0, h: 0}))).map(b => b.id), [], 'crew parked clear of tables')
})
test('patio: P1 about in line with T17 and the door\'s approach (below the door) is empty', () => {
  const door = zone('Front door')
  assert.ok(Math.abs(p('p1').x - p('17').x) <= G, `P1 ${p('p1').x} vs T17 ${p('17').x}`)
  const gap = {x: door.x, y: door.y, w: door.w, h: defaultPolicy.sim.floor[1] - door.y}
  assert.deepEqual(having(w, 'table', 'pos').filter(t => w.ents[t.pos.floor]!.floor!.level === 0 && crosses(gap, t.pos)).map(t => t.id), [])
  assert.ok(!zones.some(z => z.zone.kind === 'area' && crosses(gap, z.pos)), 'no area outline over the approach')
})
test('every table sits on whole grid cells: footprint and centre', () => {
  const off = having(w, 'table', 'pos').filter(({pos: q}) => [q.x, q.y, q.w, q.h].some(v => v % G !== 0) || [q.x + q.w / 2, q.y + q.h / 2].some(v => (2 * v) % G !== 0) || q.w < G || q.h < G)
  assert.deepEqual(off.map(t => t.id), [])
})
test('zones mark each part, labelled as a host says them, and each area zone holds its tables on its floor', () => {
  assert.deepEqual(zones.map(z => [z.zone.label, z.zone.kind]).sort(), [['Banquette aisle', 'aisle'], ['Bar', 'area'], ['Booth aisle', 'aisle'], ['Front door', 'door'], ['Grotto', 'area'], ['Lobby', 'lobby'], ['Main dining', 'area'], ['Patio', 'area'], ['Roof', 'area'],
    ['Stair corner', 'wall'], ['Stair wall', 'wall'], ['Stairs down', 'stairs'], ['Stairs to the roof', 'stairs'], ['Top walk', 'walkway'], ['Walkway', 'walkway']])
  const area = {main: 'Main dining', grotto: 'Grotto', bar: 'Bar', patio: 'Patio', roof: 'Roof'}
  Object.entries(area).forEach(([a, label]) => assert.ok(at(a).every(t => holds(zone(label), t.pos) && zones.find(z => z.zone.label === label)!.pos.floor === t.pos.floor), label))
  assert.equal(w.ents[zones.find(z => z.zone.label === 'Stairs down')!.pos.floor]!.floor!.level, 1)
  const walkway = zone('Walkway')
  assert.ok(walkway.x >= Math.max(...['4', '15', '16', '24'].map(n => p(n).x + p(n).w)) && walkway.x + walkway.w <= p('b4').x, 'walkway between main and the bar')
  assert.deepEqual(['Booth aisle', 'Banquette aisle', 'Walkway', 'Lobby', 'Stairs to the roof', 'Front door'].flatMap(l => at('main').concat(at('grotto'), at('bar')).filter(t => crosses(zone(l), t.pos)).map(t => `${l}:${t.id}`)), [], 'aisles, lobby, stairs and door are clear of tables')
})
test('merge options come from those runs: any connected set up to policy.merge.max, across the aisle on the roof, never across floors or into the grotto from the main floor', () => {
  const ids = merges(defaultPolicy, w).map(s => s.id)
  assert.ok(['m:rf_17+rf_18+rf_19', 'm:rf_18+rf_19+rf_20+rf_21', 'm:rf_10+rf_11+rf_12', 'm:rf_g1+rf_g2+rf_g3', 'm:rf_b14+rf_b15+rf_b16', 'm:rf_b20+rf_b21'].every(i => ids.includes(i)))
  assert.ok(['m:rf_r1+rf_r5', 'm:rf_r1+rf_r2+rf_r5+rf_r6', 'm:rf_r1+rf_r2+rf_r5', 'm:rf_r2+rf_r3+rf_r4', 'm:rf_r3+rf_r7'].every(i => ids.includes(i)))
  assert.ok(!ids.some(i => /rf_(1|2|3|4|5|6|7|8|24|b22|b1|p1|r8|r9|r10|r_bar)(\+|$)/.test(i)), 'booths, quads, stools, patio, high tables and bar do not merge')
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
  const stools = ['rf_b1', 'rf_b7', 'rf_b12', 'rf_r_bar']
  assert.deepEqual(stools.map(id => w.ents[id]!.table!.shape), Array(4).fill('stool'))
  const alone = only(stools)
  const [it] = Engine.fit(defaultPolicy, alone, 0, [1])
  assert.deepEqual([it.ready, it.tables.some(t => stools.includes(t))], [false, false]) // every other table is busy: the party waits rather than take a stool
  const d = Engine.seat(defaultPolicy, alone, 0, {size: 1, kind: 'W', tables: ['rf_b1']})
  assert.deepEqual([d.ok, d.ok ? '' : d.err], [false, 'B1 is first come, first served: the host does not seat it'])
  assert.ok(!merges(defaultPolicy, w).some(s => s.spot.tables.some(t => stools.includes(t))))
})
test('real venue: a party of 12 is pushed together from the grotto, the roof or 17-23 before the centre lane; 2, 4 and 6 stay on a single table', () => {
  const ask = (size: number) => Engine.fit(defaultPolicy, w, 0, [size])[0]
  assert.deepEqual([ask(12).ready, ask(12).tables.length, ask(12).tables.reduce((a, t) => a + w.ents[t]!.table!.capacity, 0), ask(12).tables.some(t => ['rf_9', 'rf_10', 'rf_11', 'rf_12'].includes(t))], [true, 3, 12, false])
  assert.deepEqual([2, 4, 6].map(n => ask(n).tables.length), [1, 1, 1])
})
