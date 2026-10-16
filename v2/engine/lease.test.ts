import test from 'node:test'
import assert from 'node:assert/strict'
import type {Cmd, Entity, World} from '../contracts/index.ts'
import {act, apply, fit, match, merges, respond, rotate, settle, stand, tick} from './index.ts'
import {N, P, mins, party, staff, world} from './testkit.ts'
import {tbl} from './mkit.ts'
import {asking, room as led} from './askkit.ts'
const q = (since: number) => ({queue: {since: N - mins(since), quotedMin: 10, status: 'WAITING' as const, from: null}})
const host: Entity = {id: 'host', body: {role: 'host', x: 0, y: 0, speed: 80, task: null, backlog: [], party: null}}
const after = (w: World, cmd: Cmd, now = N) => { const o = act(P, w, now, cmd); assert.ok(o.ok, o.ok ? '' : o.err); return apply(w, o.ok ? o.patches : []) }
const settled = (w: World, now: number) => { const s = settle(P, w, now); return {w: apply(w, s.patches), evs: s.events} }
const slotOf = (w: World, party: string) => Object.values(w.ents).find(e => e.slot?.party === party && e.slot.status === 'ACTIVE')?.slot
const two = () => world([host, staff('w1', 0, 5), staff('w2', 0, 5), party(1, 'W', 2, 'Chen', q(10)), party(2, 'W', 2, 'Ortiz', q(5)), tbl('a', 2), tbl('b', 2), tbl('c', 4)].map(e => (e.id === 'a' ? {...e, adj: {with: ['b']}} : e.id === 'b' ? {...e, adj: {with: ['a']}} : e)))
test('settle: a lease past policy.host.clock.leaseMin becomes a seating by the host on its leased tables', () => {
  const w = after(two(), {do: 'lease', party: 'pty1', spot: 'a', step: 'exact'})
  const until = N + mins(P.host.clock.leaseMin)
  assert.deepEqual(settled(w, until - 1000).evs, [])
  const s = settled(w, until)
  assert.deepEqual(s.evs, [{ev: 'seated', party: 'pty1', table: 'a', by: 'host'}])
  assert.deepEqual([slotOf(s.w, 'pty1')?.table, s.w.ents.a.table?.status, 'lease' in s.w.ents.pty1, s.w.ents.pty1.queue?.status], ['a', 'occupied', false, 'SEATED'])
})
test('settle: while a concern (an open request) is raised the lease waits for the host; once answered it settles', () => {
  const w = asking(led(), 'draft')
  assert.deepEqual(stand(P, w, N).leased.map(r => [r.party, r.concern]), [['pty1', true]])
  assert.deepEqual(settled(w, N + mins(5)).evs, [])
  const stay = apply(w, respond(P, w, N + mins(5), 'pty1', 'explain').patches)
  assert.deepEqual(settled(stay, N + mins(5)).evs, [{ev: 'seated', party: 'pty1', table: 'd1', by: 'host'}])
})
test('arrived-stage swap moves the lease (old tables free, new ones leased) and the party settles at the new spot', () => {
  const w = asking(led(), 'draft')
  const moved = apply(w, respond(P, w, N, 'pty1', 'swap').patches)
  assert.deepEqual([moved.ents.pty1.lease?.spot, moved.ents.d1.table?.status, moved.ents.a1.table?.status], ['a1', 'available', 'leased'])
  const s = settled(moved, N + mins(P.host.clock.leaseMin))
  assert.deepEqual([slotOf(s.w, 'pty1')?.table, s.w.ents.a1.table?.status, s.w.ents.d1.table?.status], ['a1', 'occupied', 'available'])
})
test('leased tables are never offered to another party: not in match, the ladder, merges or a ready fit', () => {
  const w = after(two(), {do: 'lease', party: 'pty1', spot: 'a', step: 'exact'})
  assert.ok(!match(P, w, N, 'pty2').some(f => f.spot === 'a' || f.spot.includes('a+')))
  assert.ok(!stand(P, w, N, 'pty2').offers.some(o => o.spot === 'a'))
  assert.deepEqual(merges(P, w).map(s => s.id), [])
  assert.deepEqual(fit(P, after(w, {do: 'lease', party: 'pty2', spot: 'b', step: 'exact'}), N, [2]).map(f => [f.spot, f.ready]), [['c', true]])
})
test('rotation counts leased covers: the next lease goes to the next server', () => {
  const w = after(two(), {do: 'lease', party: 'pty1', spot: 'a', step: 'exact'})
  const first = w.ents.a.table?.waiter
  assert.notEqual(rotate(P, w, N)[0].staff, first)
  assert.notEqual(after(w, {do: 'lease', party: 'pty2', spot: 'b', step: 'exact'}).ents.b.table?.waiter, first)
})
test('tick: a leased guest walks to its table without arriving at the door again, and is seated when the lease settles', () => {
  const g = {...two(), ents: {...two().ents, pty1: {...two().ents.pty1, body: {role: 'guest' as const, x: 0, y: 0, speed: 80, task: null, backlog: [], party: 'pty1'}}}}
  const w = after(g, {do: 'lease', party: 'pty1', spot: 'a', step: 'exact'})
  const steps = Array.from({length: 130}, (_, i) => N + (i + 1) * 1000)
  const r = steps.reduce((a, now) => { const o = tick(P, a.w, now, 1000); return {w: apply(a.w, o.patches), evs: [...a.evs, ...o.events.map(e => e.ev)]} }, {w, evs: [] as string[]})
  assert.deepEqual(r.evs.filter(e => e !== 'served'), ['seated'])
  assert.equal(slotOf(r.w, 'pty1')?.table, 'a')
})
