import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity} from '../contracts/index.ts'
import {options, outlook, stand} from './index.ts'
import {N, P, demo, mins, party, staff, table, world} from './testkit.ts'
import {tbl, want} from './mkit.ts'
import {asking, room as led} from './askkit.ts'
const q = (since: number) => ({queue: {since: N - mins(since), quotedMin: 10, status: 'WAITING' as const, from: null}})
const door = () => world([
  party(1, 'W', 2, 'Walk', q(10)), party(2, 'P', 2, 'Late', q(2)),
  party(3, 'R', 4, 'Booked', {reservation: {at: N - mins(20), durationMin: 60, table: null, status: 'ARRIVED', phone: '', notes: ''}}),
  party(4, 'W', 2, 'Led', {...q(30), lease: {spot: 'b', tables: ['b'], at: N, until: N + mins(2), step: 'exact'}}),
  tbl('a', 4, ['booth'], 'f1', 'sA'), {...tbl('b', 4), table: {...tbl('b', 4).table!, status: 'leased'}}, staff('w1', 0, 5, {sections: ['sA']}),
])
test('stand door: tier first, then longest waiting; a party the host already placed is gone from the door', () => {
  const v = stand(P, door(), N)
  assert.deepEqual(v.door.map(r => [r.party, r.waitedMin]), [['pty2', 2], ['pty3', 20], ['pty1', 10]])
  assert.deepEqual(v.door[0], {party: 'pty2', label: 'HS-P-2', name: 'Late', size: 2, kind: 'P', waitedMin: 2})
})
test('stand focus: the given party while still at the door, else the first; nobody at the door = null', () => {
  assert.equal(stand(P, door(), N, 'pty1').focus, 'pty1')
  assert.equal(stand(P, door(), N, 'pty4').focus, 'pty2')
  assert.equal(stand(P, door(), N, 'nope').focus, 'pty2')
  assert.deepEqual([stand(P, world([]), N).focus, stand(P, world([]), N).offers], [null, []])
})
test('stand intake: wants = said or heard, denied = asked with no want, unasked = the remaining feats', () => {
  const wants = {list: [want('booth'), want('quiet', 'soft', {said: false}), want('patio', 'soft', {said: false})], heard: ['quiet', 'window']}
  const v = stand(P, world([party(1, 'W', 2, 'Chen', {...q(1), wants})]), N)
  assert.deepEqual([v.wants.map(x => x.feat), v.denied], [['booth', 'quiet'], ['window']])
  assert.deepEqual(v.unasked, Object.keys(P.host.feats).filter(f => !['booth', 'quiet', 'window'].includes(f)))
})
test('stand offers: ladder rungs for the focus, each with who would serve it', () => {
  const v = stand(P, door(), N, 'pty1')
  assert.deepEqual(v.offers.map(o => [o.step, o.spot, o.server]), [['exact', 'a', 'w1']])
})
test('stand rotation: unit order only while the active mode holds no tables', () => {
  const noon = new Date(2026, 5, 1, 12, 0).getTime()
  const w = world([staff('w1', 6, 5), staff('w2', 2, 5)])
  assert.deepEqual([stand(P, w, N).mode, stand(P, w, N).rotation], ['sectioned', []])
  assert.deepEqual([stand(P, w, noon).mode, stand(P, w, noon).rotation], ['rotation', ['w2', 'w1']])
})
test('stand seated: active slots with area, waiter and awareness, pending first, then told, then seen', () => {
  const slot = (id: string, t: string, told?: {by: string; at: number}): Entity => ({id, slot: {table: t, party: `g_${t}`, seatedAt: N, turnAt: N + mins(60), status: 'ACTIVE', ...(told ? {told} : {})}})
  const patio = (id: string): Entity => ({...table(id, 4, 'occupied', null, 'srv'), area: {id: 'patio'}})
  const w = world([table('m1', 4, 'occupied', null, 'srv'), patio('p1'), patio('p2'), slot('s1', 'm1'), slot('s2', 'p1', {by: 'host', at: N}), slot('s3', 'p2'), {id: 's4', slot: {table: 'm1', party: 'old', seatedAt: N - mins(90), turnAt: N - mins(30), status: 'COMPLETED'}}])
  assert.deepEqual(stand(P, w, N).seated, [
    {party: 'g_p2', table: 'p2', area: 'patio', server: 'srv', aware: 'pending'},
    {party: 'g_p1', table: 'p1', area: 'patio', server: 'srv', aware: 'told'},
    {party: 'g_m1', table: 'm1', area: 'main', server: 'srv', aware: 'seen'},
  ])
})
test('stand requests and outlook: open requests carry their options; the outlook is the engine plan', () => {
  const w = asking(led(), 'draft')
  const v = stand(P, w, N)
  assert.deepEqual(v.requests, [{party: 'pty1', table: 'd1', reason: 'draft', stage: 'arrived', options: options(P, w, N, 'pty1')}])
  assert.ok(v.requests[0].options.length > 0)
  assert.deepEqual(stand(P, demo(), N).outlook, outlook(P, demo(), N))
})
