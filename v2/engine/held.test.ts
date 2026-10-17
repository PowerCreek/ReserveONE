import test from 'node:test'
import assert from 'node:assert/strict'
import type {Cmd, Entity, Outcome, World} from '../contracts/index.ts'
import {Engine} from './index.ts'
import {apply} from './patch.ts'
import {plan} from './fit.ts'
import {N, P, mins, party} from './testkit.ts'
import {room, tbl} from './mkit.ts'
const hm = (ms: number) => new Date(ms).toISOString().slice(11, 16)
const run = (w: World, cmd: Cmd, now = N) => Engine.act(P, w, now, cmd)
const after = (w: World, o: Outcome) => (o.ok ? apply(w, o.patches) : assert.fail(o.err))
const res = party(9, 'R', 4, 'Planned', {reservation: {at: N + mins(20), durationMin: 90, table: null, status: 'BOOKED', phone: '', notes: ''}})
const door = (num: number, size: number): Entity => party(num, 'W', size, `W${num}`, {queue: {since: N - mins(5), quotedMin: 10, status: 'WAITING', from: null}})
/** T12 held 30 min for the planned party pty9; T11 a slacker 6-top. */
const held = (o: Partial<Extract<Cmd, {do: 'hold'}>> = {}, ...more: Entity[]) =>
  after(room(tbl('t11', 6), tbl('t12', 4), res, ...more), run(room(tbl('t11', 6), tbl('t12', 4), res, ...more), {do: 'hold', tables: ['t12'], size: 4, until: N + mins(30), why: 'for Planned', party: 'pty9', ...o}))
test('a held table is not fit for a walk-in; seat refuses with the hold; the fast seat goes to the next table', () => {
  const w = held()
  assert.deepEqual(w.ents.t12!.hold, {id: 'hd1', size: 4, until: N + mins(30), why: 'for Planned', party: 'pty9'})
  assert.deepEqual(plan(P, w, N, [4])[0].tables, ['t11'])
  const r = run(w, {do: 'seat', size: 4, spot: 't12'})
  assert.deepEqual(r.ok ? null : r.held, {id: 'hd1', tables: ['t12'], party: 'pty9', size: 4, until: N + mins(30)})
  assert.equal(r.ok ? '' : r.err, `T12 is held for HS-R-9 Planned x4 until ${hm(N + mins(30))}: for Planned`)
  const fast = run(w, {do: 'seat', size: 4})
  assert.ok(fast.ok && fast.events[0]?.ev === 'seated' && (fast.events[0] as {table: string}).table === 't11')
  assert.ok(!Engine.ladder(P, apply(w, [{op: 'add', ent: door(1, 4)}]), N, 'pty1').some(x => x.spot === 't12'))
})
test('exclusive: the named party or a reservation booked there takes it (a same-size walk-in does not); the seat releases the hold', () => {
  const w = held({}, door(1, 4))
  const seated = after(w, run(w, {do: 'seat', party: 'pty9', spot: 't12'}))
  assert.equal(seated.ents.t12!.hold, undefined)
  assert.equal(seated.ents.t12!.table!.status, 'occupied')
  const r = run(w, {do: 'seat', party: 'pty1', spot: 't12'})
  assert.equal(r.ok ? '' : r.err, `T12 is held for HS-R-9 Planned x4 until ${hm(N + mins(30))}: for Planned`)
  const open = held({party: undefined}, door(1, 4), party(8, 'R', 2, 'Booked', {reservation: {at: N, durationMin: 90, table: 't12', status: 'ARRIVED', phone: '', notes: ''}}))
  assert.equal(run(open, {do: 'seat', party: 'pty1', spot: 't12'}).ok, false)
  assert.deepEqual([plan(P, open, N, [4])[0].tables, run(open, {do: 'seat', party: 'pty8'}).ok], [['t11'], true])
})
test('expiry frees it, force overrides with a warning, unhold drops it, a gate holds back until it opens', () => {
  const w = held()
  assert.deepEqual(plan(P, w, N + mins(31), [4])[0].tables, ['t12'])
  const f = run(w, {do: 'seat', size: 4, spot: 't12', force: true})
  assert.ok(f.ok && f.tone === 'warn' && f.msg.includes('over a hold: Hold T12 (4 seats) for HS-R-9 Planned x4 until'))
  assert.equal(after(w, f).ents.t12!.hold, undefined)
  const un = after(w, run(w, {do: 'unhold', id: 'hd1'}))
  assert.deepEqual([un.ents.t12!.hold, plan(P, un, N, [4])[0].tables], [undefined, ['t12']])
  assert.equal(run(w, {do: 'unhold', id: 'nope'}).ok, false)
  const gated = held({gate: {kind: 'at', at: N + mins(10)}})
  assert.deepEqual([plan(P, gated, N, [4])[0].tables, plan(P, gated, N + mins(11), [4])[0].tables], [['t12'], ['t11']])
  assert.equal(run(room(tbl('t1', 4)), {do: 'hold', tables: ['zz'], size: 4, until: N + 1, why: ''}).ok, false)
})
test('a held table in a merge set is excluded; strategy reads saved holds as live', () => {
  const pair = [{...tbl('a', 4), adj: {with: ['b']}}, {...tbl('b', 4), adj: {with: ['a']}}, {...tbl('c', 4), adj: {with: ['d']}}, {...tbl('d', 4), adj: {with: ['c']}}]
  const w = room(...pair)
  const h = after(w, run(w, {do: 'hold', tables: ['a'], size: 2, until: N + mins(60), why: 'regulars'}))
  assert.deepEqual([plan(P, w, N, [8])[0].tables, plan(P, h, N, [8])[0].tables], [['a', 'b'], ['c', 'd']])
  const v = Engine.strategy!(P, h, N, {guess: 'none', behind: [], holds: []})
  assert.deepEqual([v.live, v.moves[8]?.tables], [['hd1'], ['c', 'd']])
})
test('named hold: the door party x3 goes to its held T17 first (preview, seat, ladder) though B20 is tighter; another x3 is refused T17', () => {
  const patel = party(1, 'W', 3, 'Patel', {queue: {since: N - mins(5), quotedMin: 10, status: 'WAITING', from: null}})
  const base = room(tbl('t17', 4), tbl('b20', 3), patel, door(2, 3))
  const w = after(base, run(base, {do: 'hold', tables: ['t17'], size: 3, until: N + mins(45), why: 'regular', party: 'pty1'}))
  const at = (o: Outcome) => (o.ok ? (o.events[0] as {table: string}).table : o.err)
  assert.deepEqual([at(run(w, {do: 'seat', party: 'pty1'})), at(run(w, {do: 'seat', from: 'door', size: 3}))], ['t17', 't17'])
  assert.equal(Engine.ladder(P, w, N, 'pty1')[0]?.spot, 't17')
  assert.equal(at(run(w, {do: 'seat', party: 'pty2'})), 'b20')
  const no = run(w, {do: 'seat', party: 'pty2', spot: 't17'})
  assert.deepEqual(no.ok ? null : [no.err, no.held?.party], [`T17 is held for HS-W-1 Patel x3 until ${hm(N + mins(45))}: regular`, 'pty1'])
  const unnamed = after(base, run(base, {do: 'hold', tables: ['t17'], size: 3, until: N + mins(45), why: 'later'}))
  const r = run(unnamed, {do: 'seat', size: 3, spot: 't17'})
  assert.equal(r.ok ? '' : r.err, `T17 is held for a 3 until ${hm(N + mins(45))}: later`)
})
