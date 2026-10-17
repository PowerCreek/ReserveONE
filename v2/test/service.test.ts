// Service modes end to end on the real seed (main.ts) and the real engine: who serves a seating, and who must be told first.
import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy, having} from '../contracts/index.ts'
import type {Id, Policy, SimOut, World} from '../contracts/index.ts'
import {Engine, apply} from '../engine/index.ts'
import {seed} from '../main.ts'
const at = (h: number) => new Date(2026, 9, 16, h, 0).getTime()
const MIN = 60000
const base = (): World => seed().world
/** Seat a fresh party of `size` on `table` at `now`; returns the world after the seating. */
const sit = (w: World, now: number, table: Id, size = 2): World => {
  const d = Engine.seat(defaultPolicy, w, now, {size, kind: 'W', tables: [table]})
  assert.ok(d.ok, d.ok ? '' : d.err)
  return apply(w, d.ok ? d.patches : [])
}
const waiter = (w: World, table: Id) => w.ents[table].table!.waiter
test('sectioned 10:00: main-floor parties are seated with the section holder, and the engine names the same holder', () => {
  const tables = ['rf_1', 'rf_5', 'rf_9', 'rf_13', 'rf_17', 'rf_21', 'rf_24'] // spread over the four chunks
  const holds = Object.fromEntries(Engine.holds(defaultPolicy, base(), at(10)).map(h => [h.table, h]))
  const w = tables.reduce((x, t) => sit(x, at(10), t), base())
  assert.equal(Engine.modeAt(defaultPolicy, w, at(10)), 'sectioned')
  assert.deepEqual(tables.map(t => waiter(w, t)), tables.map(t => holds[t].staff))
  assert.ok(tables.every(t => holds[t].by === 'chunk' && holds[t].staff !== null))
  assert.deepEqual([...new Set(tables.map(t => waiter(w, t)))].sort(), ['sv1', 'sv2', 'sv3', 'sv4'])
})
test('rotation 12:00: floor seatings spread across the floor servers; bar and roof seatings go to their own pairs only', () => {
  const pick = (a: string) => having(base(), 'table', 'area').filter(t => t.area.id === a && t.table.shape !== 'stool' && t.table.status === 'available').map(t => t.id)
  const [bar, up, main] = [pick('bar'), pick('roof'), pick('main').slice(0, 8)]
  const w = [...main, ...bar, ...up].reduce((x, t) => sit(x, at(12), t, 1), base()) // singles; stools are first come, first served
  assert.equal(Engine.modeAt(defaultPolicy, w, at(12)), 'rotation')
  assert.ok(bar.every(t => waiter(w, t) === 'bt_bar') && up.every(t => waiter(w, t) === 'bt_roof'), 'each pair keeps its own area')
  assert.ok(main.every(t => ['sv1', 'sv2', 'sv3', 'sv4'].includes(waiter(w, t) ?? '')), 'floor tables to floor servers')
  const tally = ['sv1', 'sv2', 'sv3', 'sv4'].map(id => w.ents[id].staff!.tally)
  assert.ok(Math.max(...tally) - Math.min(...tally) <= 1, `floor covers stay level: ${tally}`)
})
/** A walk-in the sim spawned, seated at `table` by the player (not the sim host); then the clock runs. */
const guest = (table: Id) => {
  const w0 = base()
  const w1 = apply(w0, Engine.spawn(defaultPolicy, w0, at(10), 3))
  const id = having(w1, 'queue')[0].id
  const d = Engine.seat(defaultPolicy, w1, at(10), {size: w1.ents[id].party!.size, kind: 'W', party: id, tables: [table]})
  assert.ok(d.ok)
  return {id, w: apply(w1, d.ok ? d.patches : []), now: at(10)}
}
type Run = ReturnType<typeof guest> & {log: SimOut['events']}
const advance = (r: Run, ms: number, p: Policy = defaultPolicy, dt = 1000): Run =>
  Array.from({length: Math.ceil(ms / dt)}).reduce<Run>(x => {
    const out = Engine.tick(p, x.w, x.now + dt, dt)
    return {...x, w: apply(x.w, out.patches), now: x.now + dt, log: [...x.log, ...out.events]}
  }, r)
const served = (r: Run) => r.log.filter(e => e.ev === 'served')
test('a non-main seating stays unserved until the host tells the server; a main-floor seating is served without it', () => {
  const patio = advance({...guest('rf_p1'), log: []}, 5 * MIN)
  assert.deepEqual(served(patio), [])
  assert.equal(Engine.knows(defaultPolicy, patio.w, patio.now, 'rf_p1'), false)
  const told = Engine.tell(defaultPolicy, patio.w, patio.now, 'rf_p1')
  assert.ok(told.ok)
  const after = advance({...patio, w: apply(patio.w, told.ok ? told.patches : [])}, 3 * MIN)
  assert.deepEqual(served(after).map(e => (e as {table: string}).table), ['rf_p1'])
  const main = advance({...guest('rf_5'), log: []}, 3 * MIN)
  assert.deepEqual(served(main).map(e => (e as {table: string}).table), ['rf_5'])
})
test('a guest seated by the stand is served: the seating itself hands the guest its wait for service (no sim host involved)', () => {
  const r = guest('rf_9')
  assert.deepEqual([defaultPolicy.sim.autoSeat, r.w.ents[r.id].body!.backlog], [false, [{do: 'serve', table: 'rf_9'}]])
  assert.equal(served(advance({...r, log: []}, 3 * MIN)).length, 1)
})
test('default seed free run: 120 sim minutes of arrivals, with and without the sim host seating, never stuck and the sim host seats only when allowed', () => {
  const run = (p: Policy) => Array.from({length: 60}, (_, i) => i).reduce<{w: World; now: number; log: SimOut['events']}>((x, i) => {
    const w = apply(x.w, Engine.spawn(p, x.w, x.now, i + 1))
    const adv = advance({id: '', w, now: x.now, log: []}, 2 * MIN, p, 2000)
    return {w: adv.w, now: adv.now, log: [...x.log, ...adv.log]}
  }, {w: base(), now: at(10), log: []})
  const [off, on] = [defaultPolicy, {...defaultPolicy, sim: {...defaultPolicy.sim, autoSeat: true}}].map(run)
  assert.deepEqual(off.log.filter(e => e.ev === 'stuck'), [])
  assert.deepEqual(on.log.filter(e => e.ev === 'stuck'), [])
  assert.equal(off.log.filter(e => e.ev === 'seated').length, 0, 'autoSeat off: the sim host seats nothing')
  assert.ok(on.log.filter(e => e.ev === 'seated').length > 0, 'autoSeat on: it does')
})
