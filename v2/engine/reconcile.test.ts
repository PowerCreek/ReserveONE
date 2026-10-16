import test from 'node:test'
import assert from 'node:assert/strict'
import {Engine, eventState, sectionStats} from './index.ts'
import {apply} from './patch.ts'
import {N, P, demo, mins, world, table} from './testkit.ts'
import type {Entity, World} from '../contracts/index.ts'
const ev = (start: number, end: number, tables = ['t13'], extra: Partial<Entity['event'] & object> = {}): Entity => ({id: 'e1', event: {name: 'Gala', tables, start: N + mins(start), end: N + mins(end), locked: [], reclaimed: false, ...extra}})
const withEv = (...es: Entity[]): World => { const w = demo(); return {...w, ents: {...w.ents, ...Object.fromEntries(es.map(e => [e.id, e]))}} }
const settle = (w: World, now: number) => apply(w, Engine.reconcile(P, w, now))
test('eventState: pending / prep / active / expiring / expired from time alone', () => {
  const e = ev(100, 220).event!
  assert.deepEqual([0, 71, 101, 210, 221].map(m => eventState(P, e, N + mins(m))), ['RESERVED_PENDING', 'BLOCKED_PREP', 'ACTIVE_EVENT', 'EXPIRING_WARNING', 'EXPIRED_RECLAIMED'])
})
test('reconcile: prep lock blocks the free table once, remembers it, and is idempotent', () => {
  const w = settle(withEv(ev(10, 100)), N)
  assert.deepEqual([w.ents.t13.table!.status, w.ents.e1.event!.locked], ['blocked_private', ['t13']])
  assert.deepEqual(Engine.reconcile(P, w, N), [])
})
test('reconcile: expiry gives back only what the event locked, unless another live event holds the table', () => {
  const locked = settle(withEv(ev(10, 100)), N)
  const done = settle(locked, N + mins(101))
  assert.deepEqual([done.ents.t13.table!.status, done.ents.e1.event!.reclaimed, done.ents.e1.event!.locked], ['available', true, []])
  assert.deepEqual(Engine.reconcile(P, done, N + mins(102)), [])
  const other: Entity = {...ev(10, 500), id: 'e2'}
  const shared = settle(withEv(ev(10, 100), other), N)
  assert.equal(settle(shared, N + mins(101)).ents.t13.table!.status, 'blocked_private')
})
test('reconcile: an occupied table is locked once it is freed (retry each tick); the event does not touch other tables', () => {
  const w = withEv(ev(10, 100, ['t3']))
  assert.equal(settle(w, N).ents.t3.table!.status, 'occupied')
  const freed = apply(w, [{op: 'set', id: 't3', parts: {table: {...w.ents.t3.table!, status: 'available', waiter: null}}}])
  assert.equal(settle(freed, N).ents.t3.table!.status, 'blocked_private')
})
test('reconcile: overdue ACTIVE slots lapse together with their (linked) tables', () => {
  const w = settle(demo(), N + mins(30))
  assert.deepEqual([w.ents.s1.slot!.status, w.ents.t3.table!.status, w.ents.s4.slot!.status, w.ents.t10.table!.status], ['LAPSED', 'lapsed', 'ACTIVE', 'occupied'])
  const linked = world([table('a', 2, 'occupied'), table('b', 2, 'occupied'), {id: 'g', link: {members: ['a', 'b']}}, {id: 's', slot: {table: 'a', party: 'x', seatedAt: N - mins(70), turnAt: N - mins(10), status: 'ACTIVE'}}])
  assert.deepEqual(['a', 'b'].map(i => settle(linked, N).ents[i].table!.status), ['lapsed', 'lapsed'])
  assert.deepEqual(Engine.reconcile(P, settle(demo(), N + mins(30)), N + mins(30)), [])
})
test('alerts: late reservation, lapsed table to clear, event warnings, section underflow', () => {
  const al = Engine.alerts(P, withEv(ev(10, 100)), N)
  assert.ok(al.some(a => a.kind === 'late' && a.ref === 'pty6' && a.msg === 'R6 is late'))
  assert.ok(al.some(a => a.kind === 'lapsed' && a.level === 'crit' && a.msg === 'B2 lapsed 10m: clear it'))
  assert.ok(al.some(a => a.kind === 'event' && a.msg === 'Gala: prep lock'))
  assert.ok(al.some(a => a.kind === 'section' && a.ref === 'sD'))
  assert.ok(!al.some(a => a.kind === 'section' && a.ref === 'sB'))
  assert.ok(Engine.alerts(P, withEv(ev(-100, 12)), N).some(a => a.msg === 'Gala ends in <= 15m'))
  assert.equal(Engine.alerts(P, withEv(ev(-100, -1, ['t13'], {reclaimed: true})), N).some(a => a.kind === 'event'), false)
})
test('sectionStats: counts tables, occupancy and turns due soon', () => {
  const w = demo()
  const s = (id: string) => sectionStats(P, w, N, w.ents[id] as never)
  assert.equal(s('sA').n, 5)
  assert.ok(s('sD').under && !s('sB').under)
})
