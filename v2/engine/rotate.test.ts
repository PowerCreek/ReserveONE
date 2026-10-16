import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity} from '../contracts/index.ts'
import {Engine} from './index.ts'
import {bump, serverFor} from './rotate.ts'
import {N, P, demo, mins, staff, table, world} from './testkit.ts'
const rk = (...ss: ReturnType<typeof staff>[]) => Engine.rotate(P, world(ss), N).map(r => r.staff).join()
test('rotate: lowest cover tally goes next; ties go to the longest since last seated; tally outranks idle', () => {
  assert.equal(rk(staff('a', 10, 5), staff('b', 4, 5), staff('c', 7, 5)), 'b,c,a')
  assert.equal(rk(staff('a', 5, 10), staff('b', 5, 60), staff('c', 5, 30)), 'b,c,a')
  assert.equal(rk(staff('a', 5, 1), staff('b', 6, 500)), 'a,b')
})
test('rotate: no cap, skip demotes, inactive servers are left out, never-seated counts as fully idle', () => {
  assert.equal(rk(staff('a', 1, 5), staff('b', 9, 5)), 'a,b')
  assert.equal(rk(staff('a', 1, 5, {skip: 300}), staff('b', 9, 5)), 'b,a')
  assert.equal(rk(staff('a', 0, 5, {active: false}), staff('b', 9, 5)), 'b')
  assert.equal(rk(staff('a', 3, 5), staff('b', 3, 0, {lastSeatedAt: null})), 'b,a')
})
test('serverFor: best-ranked server covering the section; otherwise the top server, flagged fallback', () => {
  const w = demo()
  assert.deepEqual(Engine.serverFor(P, w, N, ['t5']), {staff: 'w1', fallback: false, by: 'chunk'})
  assert.deepEqual(Engine.serverFor(P, w, N, ['t1', 't8']), {staff: 'w2', fallback: false, by: 'chunk'}) // Dev outranks Maya
  assert.deepEqual(Engine.serverFor(P, world([table('x', 2), staff('s', 0, 1)]), N, ['x']), {staff: 's', fallback: true, by: 'fallback'})
  assert.deepEqual(Engine.serverFor(P, world([table('x', 2)]), N, ['x']), {staff: null, fallback: true, by: 'fallback'})
})
const lapsed = (ids: string[]) => { const w = demo(); return {...w, ents: {...w.ents, ...Object.fromEntries(ids.map(i => [i, {...w.ents[i], table: {...w.ents[i].table!, status: 'lapsed' as const}}]))}} }
test('bus: the lapsed table whose server is next up (Dev, B2) is cleared first, flips when Sam becomes next up', () => {
  const order = (w = lapsed(['t7', 't13'])) => Engine.bus(P, w, N).map(b => b.table).join()
  assert.equal(order(), 't7,t13')
  const w = lapsed(['t7', 't13'])
  assert.equal(order({...w, ents: {...w.ents, w3: {...w.ents.w3, staff: {...w.ents.w3.staff!, tally: 0}}}}), 't13,t7')
  assert.ok(Engine.bus(P, w, N).every(b => b.staff !== null))
})
test('bus: priority = waiting parties that fit x demand + base + rotation bonus; waited minutes come from the lapsed slot', () => {
  const [b] = Engine.bus(P, lapsed(['t7']), N)
  assert.equal(b.priority, 1 * P.alerts.busDemand + P.alerts.busBase + 4 * P.alerts.busRank) // Chen (2) fits; Dev is rank 0 of 4
  assert.equal(b.waitedMin, 10) // s3 turn was 10 min ago
  assert.deepEqual(Engine.bus(P, demo(), N).map(x => x.table), ['t7']) // the fixture already has B2 lapsed
  assert.deepEqual(Engine.bus(P, world([table('x', 2)]), N), [])
  assert.equal(Engine.bus(P, lapsed(['t5']), N).find(b => b.table === 't5')!.waitedMin, 0)
  assert.ok(P.seat.lapsedClearMin > 0 && mins(1) === 60000)
})

const at = (h: number) => new Date(2026, 5, 1, h).getTime()
const area = (e: Entity, id: string): Entity => ({...e, area: {id}})
const sv = (override: string | null): Entity => ({id: 'service', service: {override, carve: {}}})
const floor = () => world([area(table('m1', 4, 'available', 'sA'), 'main'), staff('a', 10, 5, {sections: ['sA']}), staff('b', 0, 5, {sections: ['sB']})])
test('serverFor: sectioned (10:00, 16:00) keeps the section holder; rotation (12:00) hands the seating to the lowest tally', () => {
  const pick = (h: number, w = floor()) => serverFor(P, w, at(h), ['m1'])
  assert.deepEqual(pick(10), {staff: 'a', fallback: false, by: 'chunk'})
  assert.deepEqual(pick(12), {staff: 'b', fallback: false, by: 'rotation'})
  assert.deepEqual(pick(16), {staff: 'a', fallback: false, by: 'chunk'})
})
test('serverFor: the service override beats the schedule either way', () => {
  const ents = (o: string | null) => world([...Object.values(floor().ents), sv(o)])
  assert.equal(serverFor(P, ents('rotation'), at(10), ['m1']).staff, 'b')
  assert.equal(serverFor(P, ents('sectioned'), at(12), ['m1']).staff, 'a')
})
test('serverFor: sectioned reads the carve per area: dealt top (patio), bar pair (level); an undealt top falls back to a unit that fits', () => {
  const w = world([area(table('p1', 4), 'patio'), {...area(table('p2', 4), 'patio'), assign: {staff: 'b'}}, area(table('r1', 4), 'bar'), staff('a', 0, 9), staff('b', 5, 5), staff('pair', 20, 5, {area: 'bar', weight: 2})])
  assert.deepEqual(serverFor(P, w, at(10), ['p2']), {staff: 'b', fallback: false, by: 'tops'})
  assert.deepEqual(serverFor(P, w, at(10), ['r1']), {staff: 'pair', fallback: false, by: 'level'})
  assert.deepEqual(serverFor(P, w, at(10), ['p1']), {staff: 'a', fallback: true, by: 'fallback'}) // pair is bar-only
})
test('rotation: a weight-2 bartender pair counts as two slots, so it takes twice the covers of a floor server', () => {
  const bar = ['r1', 'r2', 'r3'].map(id => area(table(id, 4), 'bar'))
  const run = (ss: ReturnType<typeof staff>[], n: number): Record<string, number> => Array.from({length: n}).reduce<{ss: typeof ss; got: Record<string, number>}>(({ss, got}, _, i) => {
    const id = serverFor(P, world([...bar, ...ss]), at(12) + i * 60000, ['r1']).staff!
    return {ss: bump(ss as never, id, 4, at(12) + i * 60000) as never, got: {...got, [id]: (got[id] ?? 0) + 4}}
  }, {ss, got: {}}).got
  const got = run([staff('a', 0, 5), staff('b', 0, 5), staff('pair', 0, 5, {area: 'bar', weight: 2, crew: ['Kit', 'Lou']})], 16)
  assert.deepEqual(got, {a: 16, b: 16, pair: 32})
  assert.deepEqual(rk(staff('a', 6, 5), staff('pair', 8, 5, {weight: 2})), 'pair,a') // 8/2 < 6
})
const bound = {...P, service: {...P.service, modes: {...P.service.modes, rotation: {...P.service.modes.rotation, anywhere: false}}}}
test('rotation: where the mode is not `anywhere`, a unit bound to an area never takes another area; unbound units take any', () => {
  const w = world([area(table('m1', 4), 'main'), staff('pair', 0, 99, {area: 'bar', weight: 2}), staff('a', 50, 1)])
  assert.deepEqual(serverFor(bound, w, at(12), ['m1']), {staff: 'a', fallback: false, by: 'rotation'})
  assert.deepEqual(serverFor(bound, world([area(table('m1', 4), 'main'), staff('pair', 0, 9, {area: 'bar'})]), at(12), ['m1']), {staff: null, fallback: true, by: 'fallback'})
})
test('rotation (anywhere, the default): servers and bartenders rotate over every area, a pair counting two slots', () => {
  const w = world([area(table('m1', 4), 'main'), staff('pair', 0, 99, {area: 'bar', weight: 2}), staff('a', 50, 1)])
  assert.deepEqual(serverFor(P, w, at(12), ['m1']), {staff: 'pair', fallback: false, by: 'rotation'})
})
