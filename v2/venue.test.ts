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
  assert.deepEqual(['main', 'grotto', 'patio', 'bar', 'roof'].map(a => inArea(a).length), [24, 6, 7, 19, 11])
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
  assert.deepEqual([sec('5') === sec('7'), sec('6') === sec('8'), sec('13') === sec('15'), sec('14') === sec('16')], [true, true, true, true], 'a quad block is never split across its divider')
  const c = (t: typeof main[0]) => [t.pos.x + t.pos.w / 2, t.pos.y + t.pos.h / 2] as const // the partition cuts on table centres
  const bx = (s: number) => { const cs = by(s).map(c); return {x0: Math.min(...cs.map(q => q[0])), x1: Math.max(...cs.map(q => q[0])), y0: Math.min(...cs.map(q => q[1])), y1: Math.max(...cs.map(q => q[1]))} }
  const inside = (s: number, o: number) => by(o).map(c).filter(([x, y]) => x >= bx(s).x0 && x <= bx(s).x1 && y >= bx(s).y0 && y <= bx(s).y1).length
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
  assert.equal(having(w, 'table').length, 67)
})
test('every level is laid out without overlaps (floors on one level share its frame); adjacency (adj) is the owner\'s runs, symmetric and on one floor', () => {
  const ts = having(w, 'table', 'pos', 'area')
  const level = (t: typeof ts[0]) => w.ents[t.pos.floor]!.floor!.level
  const hit = (a: typeof ts[0], b: typeof ts[0]) => level(a) === level(b) && a.pos.x < b.pos.x + b.pos.w && b.pos.x < a.pos.x + a.pos.w && a.pos.y < b.pos.y + b.pos.h && b.pos.y < a.pos.y + a.pos.h
  assert.deepEqual(ts.flatMap((a, i) => ts.slice(i + 1).filter(b => hit(a, b)).map(b => [a.id, b.id])), [])
  const adj = (id: string) => w.ents[id]!.adj?.with ?? []
  assert.ok(ts.every(t => adj(t.id).every(o => adj(o).includes(t.id) && w.ents[o]!.pos!.floor === t.pos.floor)))
  assert.deepEqual(['17', '19', '23', '9', '12', '1', '24'].map(n => adj(`rf_${n}`)), [['rf_18'], ['rf_18', 'rf_20'], ['rf_22'], ['rf_10'], ['rf_11'], [], []])
  assert.deepEqual(['g1', 'g2', 'g4', 'b14', 'b15', 'b21', 'b20', 'b22', 'b13'].map(n => adj(`rf_${n}`)), [['rf_g2'], ['rf_g1', 'rf_g3'], ['rf_g5'], ['rf_b15'], ['rf_b14', 'rf_b16'], ['rf_b20'], ['rf_b21'], [], []])
  const R = (...ns: number[]) => ns.map(n => `rf_rt${n}`).sort()
  assert.deepEqual([4, 5, 6, 7, 8, 9, 10].map(n => adj(`rf_rt${n}`)), [R(5, 9), R(4, 6, 8), R(5, 7), R(6, 8), R(5, 7, 9), R(4, 8, 10), R(9)], 'roof: each snake row a run, rows joined across their aisle by column')
  assert.deepEqual(['rt1', 'rt2', 'rt3', 'r_bar'].map(n => adj(`rf_${n}`)), [[], [], [], []])
})
test('labels are the owner\'s: T1-T24, G, B, P, R; floors are named and stacked on two levels', () => {
  const by = (a: string) => labels(inArea(a))
  assert.deepEqual(by('main'), Array.from({length: 24}, (_, i) => `T${i + 1}`))
  assert.ok(by('bar').every(l => /^B\d+$/.test(l)) && by('patio').every(l => /^P\d+$/.test(l)))
  assert.deepEqual(by('roof'), [...Array.from({length: 10}, (_, i) => `RT${i + 1}`), 'Roof bar'])
  assert.deepEqual(having(w, 'floor').map(f => [f.id, f.floor.name, f.floor.level]), [['rf1', 'Main Dining Room', 0], ['rf2', 'Bar', 0], ['rf3', 'Patio', 0], ['rf4', 'Roof', 1]])
  assert.deepEqual(['rt4', 'rt10', 'rt1', 'rt2', 'rt3', 'r_bar'].map(n => [w.ents[`rf_${n}`]!.table!.capacity, w.ents[`rf_${n}`]!.feat!.tags.includes('hightop')]), [[4, false], [4, false], [4, true], [2, true], [6, true], [10, true]])
})
const p = (n: string) => w.ents[`rf_${n}`]!.pos!
const at = (a: string) => having(w, 'table', 'area', 'pos').filter(t => t.area.id === a)
const cx = (n: string) => p(n).x + p(n).w / 2
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
  assert.ok(['b4', 'b20', 'b16'].every(n => p(n).x > walk) && at('bar').every(t => t.pos.x >= p('b20').x), 'the B20/B4-B8/B16 column faces main across the walkway')
  const right = Math.max(...at('bar').map(t => t.pos.x + t.pos.w + (w.ents[t.id]!.seating?.bench?.includes('r') ? G : 0)))
  assert.deepEqual([w.ents.rf_b15!.table!.capacity, w.ents.rf_b13!.table!.capacity], [4, 2], 'B15 a 4-top, B13 a 2-top')
  assert.equal(p('b14').x + p('b14').w + G, right, 'B14 against the right bar wall')
  assert.deepEqual([p('b16').x === p('b20').x, p('b15').x - (p('b16').x + p('b16').w) === p('b14').x - (p('b15').x + p('b15').w)], [true, true], 'B16 under B20, B15 balanced between B16 and B14')
  assert.ok(p('b13').y === p('b12').y && p('b13').x === p('b12').x + p('b12').w && w.ents.rf_b13!.seating!.chairs.b === 1, 'B13 next to B12, its chair tucked under it')
  assert.ok(!zones.some(z => z.zone.label === 'Spare chair') && p('b4').x - (zone('Walkway').x + zone('Walkway').w) === 3 * G, 'B13\'s one stowed chair is its seat (no spare); the stool column three cells off the walkway')
  assert.deepEqual([p('b22').x - (p('b21').x + p('b21').w), p('b21').x - (p('b20').x + p('b20').w)], [G, G], 'B20, B21, B22 one cell apart')
  assert.ok(p('b3').y + p('b3').h === zone('Bar counter').y && p('b3').w === G && p('b9').y === zone('Bar counter').y + zone('Bar counter').h && p('b3').x === zone('Bar counter').x, 'stools hug the counter')
  assert.ok(['b20', 'b4', 'b5', 'b6', 'b7', 'b8', 'b16'].every((n, i, a) => i === 0 || p(a[i - 1]!).y < p(n).y), 'B20 heads the column, B16 ends it')
  assert.ok(at('patio').every(t => t.pos.y > wall && t.pos.x + t.pos.w < p('b4').x), 'patio in front of main, clear of the bar')
})
test('roof (owner): all RT; ids snake (RT4-RT6 back left, RT7-RT10 right) three cells apart, rows across by column; RT1 (T9-sized) and RT2 high-tops on the top band; RT3 5 long an aisle off the L bar of 10 stools', () => {
  const y = (ns: string[]) => new Set(ns.map(n => p(n).y)).size === 1
  const order = (ns: string[]) => ns.every((n, i) => i === 0 || cx(ns[i - 1]!) < cx(n))
  assert.ok(y(['rt4', 'rt5', 'rt6']) && y(['rt7', 'rt8', 'rt9', 'rt10']) && order(['rt6', 'rt5', 'rt4']) && order(['rt7', 'rt8', 'rt9', 'rt10']), 'the snake')
  assert.equal(p('rt7').y - (p('rt6').y + p('rt6').h), 3 * G, 'three cells between the rows')
  assert.deepEqual([['rt6', 'rt7'], ['rt5', 'rt8'], ['rt4', 'rt9']].map(([a, b]) => cx(a!) === cx(b!)), [true, true, true], 'columns face across the aisle')
  assert.deepEqual([[p('rt1').w, p('rt1').h], [p('rt3').w / G, p('rt3').h / G]], [[p('9').w, p('9').h], [2, 5]], 'RT1 the size of T9, RT3 five long')
  assert.ok(p('rt2').x - (p('rt1').x + p('rt1').w) >= 3 * G, 'RT1\'s right chairs, a cell or two, then RT2\'s')
  const rdoor0 = zone('Roof door')
  assert.ok(p('rt4').x + p('rt4').w === rdoor0.x && p('rt4').y === rdoor0.y + rdoor0.h, 'RT4\'s right chairs right under the roof door\'s bottom cell')
  const bar = w.ents.rf_r_bar!
  assert.deepEqual([bar.table!.capacity, bar.seating!.at!.length, bar.seating!.top!.length, bar.seating!.at!.filter(a => a[2] === 'r').length], [10, 10, 6, 6], 'one bar: an L top, 6 at the front, 4 under the foot')
  assert.ok(p('r_bar').x - (p('rt3').x + p('rt3').w) >= 3 * G, 'RT3: seat band, an aisle, then the bar stools')
  const [stairs, walkTop, wallR, rdoor] = ['Stairs down', 'Top walk', 'Wall', 'Roof door'].map(zone)
  assert.ok(at('roof').every(t => t.pos.x >= stairs!.x && t.pos.y >= stairs!.y), 'the stairs arrive top-left')
  assert.ok(holds(walkTop!, stairs!) && stairs!.y === walkTop!.y && stairs!.h * 2 === walkTop!.h && stairs!.h === 4 * G, 'the stairs down are the top walk\'s upper half (two 2-cell flights)')
  assert.ok(wallR!.x === walkTop!.x + walkTop!.w && p('rt1').x - G === wallR!.x + wallR!.w && rdoor!.x === wallR!.x && rdoor!.y === wallR!.y + wallR!.h, 'the wall beside RT1, the door under it')
  assert.deepEqual([stairs!.x, stairs!.y, stairs!.w, stairs!.h], [zone('Stairs to the roof').x, zone('Stairs to the roof').y, zone('Stairs to the roof').w, zone('Stairs to the roof').h], 'the flight lands over the ground stairs')
})
test('ground (owner): door lower-left on the bottom wall; lobby, host stand against the stair wall (the T5-T16 band), stairs off the booth aisle; POS cubbies; the exit at the walkway\'s foot; restrooms up the grotto\'s left wall', () => {
  const [door, lobby, host, stairs, swall, booth, bq, walkway] = ['Front door', 'Lobby', 'Host stand', 'Stairs to the roof', 'Stair wall', 'Booth aisle', 'Banquette aisle', 'Walkway'].map(zone)
  const [dx, dy] = defaultPolicy.sim.door
  assert.equal(door!.y, wall, 'door on T17\'s wall, facing out')
  assert.ok(door!.x + door!.w <= p('17').x && door!.x <= Math.min(...having(w, 'table', 'pos').filter(t => w.ents[t.pos.floor]!.floor!.level === 0).map(t => t.pos.x)), 'lower-left corner')
  assert.ok(holds({...door!, y: door!.y - 1, h: door!.h + 1}, {x: dx, y: dy, w: 0, h: 0}), 'policy.sim.door is the door')
  assert.ok(lobby!.y + lobby!.h === door!.y && lobby!.x <= door!.x && lobby!.w >= 6 * G, 'lobby (about two tables wide) just inside the door')
  assert.ok(host!.y + host!.h === lobby!.y && swall!.y + swall!.h === host!.y && host!.y === p('5').y, 'host stand on the lobby, against the stair wall, in line with the T5-T16 band')
  assert.ok(stairs!.y + stairs!.h === swall!.y && stairs!.h === 4 * G && stairs!.x + stairs!.w === booth!.x && stairs!.y + stairs!.h === booth!.y + booth!.h && swall!.h === 0, 'half-turn stairs (2-cell flights) on a stair-wall line, the lower flight flush on the booth aisle')
  assert.deepEqual([booth!.h, bq!.h, lobby!.h], [2 * G, G, 5 * G], 'booth aisle two cells, banquette aisle one, the lobby five')
  const [pdoor, pos1, pos2, exit] = ['Patio entrance', 'POS', 'POS (walkway)', 'Exit (no re-entry)'].map(zone)
  assert.ok(pdoor!.y === wall && pdoor!.x > door!.x + door!.w && pdoor!.x + pdoor!.w <= lobby!.x + lobby!.w, 'the patio entrance on the lobby\'s bottom wall')
  const t17 = {x: p('17').x - G, y: p('17').y - G} // its bench (left) and chair band (top)
  assert.ok(pos1!.x === lobby!.x + lobby!.w && pos1!.x + pos1!.w === t17.x && pos1!.y === t17.y && pos1!.y + pos1!.h === wall, 'a POS cubby between the lobby and T17, T17\'s height')
  assert.ok(pos2!.x === p('24').x + p('24').w && pos2!.x + pos2!.w === walkway!.x - 2 * G && pos2!.y === p('24').y, 'a POS right of T24, on T24\'s top, shrunk two cells off the walkway')
  assert.equal(p('24').x + p('24').w, p('14').x + p('14').w, 'T24\'s right edge on T14\'s')
  assert.ok(p('24').x === p('23').x + p('23').w + G, 'T24 borders T23\'s bench')
  assert.ok(exit!.x === walkway!.x && exit!.y === wall && exit!.x + exit!.w <= p('b16').x - G, 'the exit at the walkway\'s foot, between that POS and the bar wall by B16')
  assert.ok(['1', '2', '3', '4'].every(n => p(n).y + p(n).h === booth!.y) && ['9', '10', '11', '12'].every(n => p(n).y === booth!.y + booth!.h), 'booths and the centre lane flush on the booth aisle')
  assert.ok(['17', '18', '20', '22', '23'].every(n => p(n).y - G === bq!.y + bq!.h), 'banquette chairs flush on the banquette aisle')
  assert.equal(zone('Grotto').y + zone('Grotto').h, booth!.y, 'the grotto opens flush on the booth aisle')
  const [aisle, walk, mens, ladies] = ['Restroom aisle', 'Restroom walk', "Men's room", "Ladies' room"].map(zone)
  assert.deepEqual([aisle!.w, walk!.h, zone('POS').x], [3 * G, 3 * G, zone('Grotto').x + 2 * G], 'restroom aisle and walk 3 cells; the lobby reaches the grotto\'s third cell, where the POS by T17 starts')
  const gdoor = zone('Grotto entrance'), lanes = p('g4').x - G - (p('g1').x + p('g1').w + G)
  assert.deepEqual([gdoor.w, gdoor.y, lanes, gdoor.x - (p('g1').x + p('g1').w + G)], [2 * G, booth!.y, 4 * G, G], 'a 2-cell grotto entrance centred between lanes 4 cells apart')
  assert.ok(aisle!.x + aisle!.w === zone('Grotto').x && aisle!.y + aisle!.h === booth!.y && aisle!.y === walk!.y + walk!.h, 'the restroom aisle runs up the grotto\'s left wall from the booth aisle to the restroom walk')
  assert.ok(mens!.x <= aisle!.x && mens!.x + mens!.w >= aisle!.x + aisle!.w && mens!.y + mens!.h === walk!.y, 'the men\'s room straight up the aisle')
  assert.ok(ladies!.x + ladies!.w < mens!.x && ladies!.y + ladies!.h === walk!.y && walk!.x <= ladies!.x, 'the walk turns left to the ladies\' room, a gap between the two')
  const hostAt = having(w, 'body').find(b => b.body.role === 'host')!.body
  assert.ok(holds(host!, {x: hostAt.x, y: hostAt.y, w: 0, h: 0}), 'host at the stand')
  const ts = having(w, 'table', 'pos').filter(t => w.ents[t.pos.floor]!.floor!.level === 0)
  assert.deepEqual(having(w, 'body').filter(b => ts.some(t => holds(t.pos, {x: b.body.x, y: b.body.y, w: 0, h: 0}))).map(b => b.id), [], 'crew parked clear of tables')
})
test('spacing (owner): chairs in a one-cell band, a shared walking margin between exposed neighbours, 4-tops long-edge seated and turnable; benches fixed; booths and the patio carry no seat cells', () => {
  const s = (n: string) => w.ents[`rf_${n}`]!.seating
  assert.deepEqual([s('9'), s('g1'), s('5'), s('18'), s('19'), s('17'), s('23'), s('b16'), s('b20'), s('rt3'), s('p1'), s('p4')],
    [{chairs: {l: 2, r: 2}, turn: true}, {chairs: {l: 2, r: 2}, turn: true}, {chairs: {l: 1, r: 1}}, {chairs: {t: 2}, bench: ['b']}, {chairs: {t: 1}, bench: ['b']}, {chairs: {t: 1}, bench: ['b', 'l']}, {chairs: {t: 1}, bench: ['b', 'r']}, {chairs: {t: 1}, bench: ['b', 'l']}, {chairs: {b: 1}, bench: ['t', 'l']}, {chairs: {l: 3, r: 3}, high: true}, {chairs: {l: 1, r: 1}}, {chairs: {}, ring: 6}])
  assert.deepEqual(['1', '2', '24'].map(n => s(n)?.open), ['b', 'b', 't'], 'booths: D-shaped, the straight edge on the aisle')
  assert.deepEqual(['p1', 'p4'].map(n => [w.ents[`rf_${n}`]!.table!.capacity, w.ents[`rf_${n}`]!.table!.shape]), [[2, 'rect'], [6, 'round']], 'patio: 2-tops and round 6-tops')
  assert.ok(p('9').h > p('9').w, '4-tops are longer on the seated edge')
  const gap = (a: string, b: string) => (p(b).x - (p(a).x + p(a).w)) / G
  assert.deepEqual([gap('9', '10'), gap('10', '11'), gap('11', '12'), gap('7', '9'), gap('12', '13')], [3, 3, 3, 3, 3], 'seat, shared margin, seat')
  assert.deepEqual([gap('5', '7'), gap('13', '15')], [4, 4], 'quads: a divider between, margins not shared')
  assert.deepEqual([gap('18', '19'), gap('19', '20'), gap('20', '21'), gap('21', '22')], [1, 1, 1, 1], 'banquettes: one shared cell to get in')
  assert.deepEqual([gap('2', '3'), gap('3', '4')], [0, 0], 'booths 2-4 share edges')
  assert.equal(zones.filter(z => z.zone.kind === 'divider').length, 4)
})
test('patio: P1 about in line with T17 and the door\'s approach (below the door) is empty', () => {
  const door = zone('Front door')
  assert.ok(zone('Patio').x <= zone('Patio entrance').x && zone('Patio').x + zone('Patio').w >= zone('Patio entrance').x + zone('Patio entrance').w, 'the patio holds its entrance')
  assert.equal(zone('Patio').x, zone('Patio entrance').x, 'patio lines up with its entrance (left bound)')
  const gap = {x: door.x, y: door.y, w: door.w, h: defaultPolicy.sim.floor[1] - door.y}
  assert.deepEqual(having(w, 'table', 'pos').filter(t => w.ents[t.pos.floor]!.floor!.level === 0 && crosses(gap, t.pos)).map(t => t.id), [])
  assert.ok(!zones.some(z => z.zone.kind === 'area' && w.ents[z.pos.floor]!.floor!.level === 0 && crosses(gap, z.pos)), 'no ground area outline over the approach')
})
test('every table sits on whole grid cells: footprint and centre', () => {
  const off = having(w, 'table', 'pos').filter(({pos: q}) => [q.x, q.y, q.w, q.h].some(v => v % G !== 0) || [q.x + q.w / 2, q.y + q.h / 2].some(v => (2 * v) % G !== 0) || q.w < G || q.h < G)
  assert.deepEqual(off.map(t => t.id), [])
})
test('zones mark each part, labelled as a host says them, and each area zone holds its tables on its floor', () => {
  assert.deepEqual([...new Set(zones.map(z => `${z.zone.label}:${z.zone.kind}`))].sort(), ['Banquette aisle:aisle', 'Bar counter:wall', 'Bar wall:wall', 'Bar:area', 'Booth aisle:aisle', 'Divider:divider', 'Exit (no re-entry):door', 'Front door:door', 'Grotto entrance:door', 'Grotto wall:wall', 'Grotto:area', 'Host stand:stand', "Ladies' room:room", 'Lobby:lobby', 'Main dining:area', "Men's room:room",
    'POS (walkway):stand', 'POS:stand', 'Patio entrance:door', 'Patio:area', 'Restroom aisle:aisle', 'Restroom walk:walkway', 'Roof door:door', 'Roof:area', 'Stair wall:wall', 'Stairs down:stairs', 'Stairs to the roof:stairs', 'Top walk:walkway', 'Walkway:walkway', 'Wall:wall'])
  const area = {main: 'Main dining', grotto: 'Grotto', bar: 'Bar', patio: 'Patio', roof: 'Roof'}
  Object.entries(area).forEach(([a, label]) => assert.ok(at(a).every(t => holds(zone(label), t.pos) && zones.find(z => z.zone.label === label)!.pos.floor === t.pos.floor), label))
  assert.equal(w.ents[zones.find(z => z.zone.label === 'Stairs down')!.pos.floor]!.floor!.level, 1)
  const walkway = zone('Walkway')
  assert.ok(walkway.x >= Math.max(...['4', '15', '16', '24'].map(n => p(n).x + p(n).w)) && walkway.x + walkway.w <= p('b4').x, 'walkway between main and the bar')
  assert.deepEqual(['Booth aisle', 'Banquette aisle', 'Walkway', 'Lobby', 'Host stand', 'POS', 'POS (walkway)', 'Stairs to the roof', 'Front door', 'Restroom aisle', 'Restroom walk', "Men's room", "Ladies' room", 'Bar counter'].flatMap(l => at('main').concat(at('grotto'), at('bar')).filter(t => crosses(zone(l), t.pos)).map(t => `${l}:${t.id}`)), [], 'aisles, lobby, stairs and door are clear of tables')
})
test('merge options come from those runs: any connected set up to policy.merge.max, across the aisle on the roof, never across floors or into the grotto from the main floor', () => {
  const ids = merges(defaultPolicy, w).map(s => s.id)
  assert.ok(['m:rf_17+rf_18+rf_19', 'm:rf_18+rf_19+rf_20+rf_21', 'm:rf_10+rf_11+rf_12', 'm:rf_g1+rf_g2+rf_g3', 'm:rf_b14+rf_b15+rf_b16', 'm:rf_b20+rf_b21'].every(i => ids.includes(i)))
  assert.ok(['m:rf_rt6+rf_rt7', 'm:rf_rt4+rf_rt5+rf_rt6', 'm:rf_rt10+rf_rt7+rf_rt8+rf_rt9', 'm:rf_rt4+rf_rt9'].every(i => ids.includes(i)))
  assert.ok(!ids.some(i => /rf_(1|2|3|4|5|6|7|8|24|b22|b1|b13|p1|rt1|rt2|rt3|r_bar)(\+|$)/.test(i)), 'booths, quads, stools, patio, high tables and bar do not merge')
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
