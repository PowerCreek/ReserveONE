import test from 'node:test'
import assert from 'node:assert/strict'
import {Engine} from './index.ts'
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
  assert.deepEqual(Engine.serverFor(P, w, N, ['t5']), {staff: 'w1', fallback: false})
  assert.deepEqual(Engine.serverFor(P, w, N, ['t1', 't8']), {staff: 'w2', fallback: false}) // Dev outranks Maya
  assert.deepEqual(Engine.serverFor(P, world([table('x', 2), staff('s', 0, 1)]), N, ['x']), {staff: 's', fallback: true})
  assert.deepEqual(Engine.serverFor(P, world([table('x', 2)]), N, ['x']), {staff: null, fallback: true})
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
