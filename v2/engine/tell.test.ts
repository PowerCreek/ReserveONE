import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity, World} from '../contracts/index.ts'
import {Engine, apply, toldEvents} from './index.ts'
import {N, P, mins, staff, table, world} from './testkit.ts'
const host: Entity = {id: 'host', body: {role: 'host', x: 0, y: 0, speed: 80, task: null, backlog: [], party: null}}
const patio = (id: string, waiter: string | null = 'srv'): Entity => ({...table(id, 4, waiter ? 'occupied' : 'available', null, waiter), area: {id: 'patio'}})
const slot = (tbl: string): Entity => ({id: `slot-${tbl}`, slot: {table: tbl, party: 'pty1', seatedAt: N - mins(5), turnAt: N + mins(50), status: 'ACTIVE'}})
const seated = (): World => world([host, patio('p1'), slot('p1'), staff('srv', 0, 5, {name: 'Dana'})])
const tell = (w: World, id = 'p1') => Engine.tell(P, w, N, id)
const why = (w: World, id?: string) => { const d = tell(w, id); return d.ok ? 'ok' : d.err }
test('tell: sets slot.told {by: the host, at: now} on the active slot and says whom it told', () => {
  const w = seated()
  const d = tell(w)
  assert.ok(d.ok)
  assert.equal(d.ok && d.msg, 'Told Dana about P1')
  const w1 = apply(w, d.ok ? d.patches : [])
  assert.deepEqual(w1.ents['slot-p1'].slot!.told, {by: 'host', at: N})
  assert.equal(Engine.knows(P, w1, N, 'p1'), true)
})
test('tell: the told event is derived once from the patches (a repeat yields none)', () => {
  const w = seated()
  const d = tell(w)
  const ps = d.ok ? d.patches : []
  assert.deepEqual(toldEvents(w, ps), [{ev: 'told', party: 'pty1', table: 'p1', server: 'srv', by: 'host'}])
  assert.deepEqual(toldEvents(apply(w, ps), ps), [])
})
test('tell: refuses a seen area, an empty table, a table nobody holds, and a seating already told', () => {
  const main = world([host, table('m1', 4, 'occupied', null, 'srv'), slot('m1'), staff('srv', 0, 5)])
  assert.match(why(main, 'm1'), /see their own seatings at M1/)
  assert.equal(why(world([host, patio('p1', null), staff('srv', 0, 5)])), 'Nobody is seated at P1')
  assert.equal(why(world([host, patio('p1', null), slot('p1')])), 'No server holds P1')
  const w = seated()
  const d = tell(w)
  assert.equal(why(apply(w, d.ok ? d.patches : [])), 'Dana already knows about P1')
})
test('tell: a table without a waiter falls back to its standing holder (a dealt top)', () => {
  const w = world([host, {...patio('p1', null), assign: {staff: 'srv'}}, staff('srv', 0, 5), slot('p1')])
  assert.ok(tell(w).ok)
})
