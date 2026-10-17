import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity} from '../contracts/index.ts'
import {Engine} from './index.ts'
import {N, P, mins, party, staff} from './testkit.ts'
import {busy, guest, room, tbl} from './mkit.ts'
const link = (e: Entity, ...adj: string[]): Entity => ({...e, adj: {with: adj}})
const book = (num: number, size: number, at: number, table: string | null = null): Entity =>
  party(num, 'R', size, `R${num}`, {reservation: {at: N + mins(at), durationMin: 90, table, status: 'BOOKED', phone: '', notes: ''}})
/** a and b are seated (a merged 7-top leaving in 30 min), x is open beside them: a - b - x in a row. */
const row = (leaving = 30) => [...busy(link(tbl('a', 4), 'b'), leaving), ...busy(link(tbl('b', 4), 'a', 'x'), leaving), link(tbl('x', 4), 'b')]
test('outlook: a reservation is planned on tables that will have turned over by its time, pushed together', () => {
  const [pl] = Engine.outlook(P, room(book(1, 12, 120), row()), N)
  assert.deepEqual([pl.merge, pl.tables, pl.party], [true, ['a', 'b', 'x'], 'pty1'])
  assert.ok(pl.free <= N + mins(40)) // a and b leave at +30, reset 5
  assert.equal(Engine.outlook(P, room(book(1, 12, 20), row()), N)[0].spot, null) // too soon: a and b are still seated
})
test('walk-in beside a seated group: seating x now is fine when the group and x are both gone before the reservation, and squeezes it when not', () => {
  const late = room(guest([], 4), book(2, 12, 120), row())
  assert.deepEqual(Engine.match(P, late, N, 'pty1').find(f => f.spot === 'x')?.squeezes, [])
  const soon = room(guest([], 4), book(2, 12, 45), row(20))
  assert.deepEqual(Engine.match(P, soon, N, 'pty1').find(f => f.spot === 'x')?.squeezes, ['pty2']) // x would be busy until the 65th minute
  assert.deepEqual(Engine.outlook(P, soon, N)[0].tables, ['a', 'b', 'x'])
})
test('outlook: a reservation for two takes a table that merges nowhere and leaves the mergeable ones for bigger parties', () => {
  const w = room(book(1, 2, 30), link(tbl('m1', 2), 'm2'), link(tbl('m2', 2), 'm1'), tbl('solo', 2))
  assert.deepEqual(Engine.outlook(P, w, N)[0].tables, ['solo'])
})
test('outlook: reservations are placed in time order and never share a table; an unseatable one is reported with no spot', () => {
  const w = room(book(1, 4, 60), book(2, 4, 30), tbl('t', 4))
  assert.deepEqual(Engine.outlook(P, w, N).map(x => [x.party, x.spot]), [['pty2', 't'], ['pty1', null]]) // the 30-minute booking sits first, the table is still busy at +60 (90-minute turn)
})
const rotation = {id: 'service', service: {override: 'rotation', carve: {}}} as Entity
test('rotation defers the unit planned to take an upcoming reservation, so walk-ins go to the others first (and not when that party is seated)', () => {
  const w = room(rotation, staff('a', 0, 99), staff('b', 0, 98), book(1, 6, 30), tbl('t', 6))
  assert.equal(Engine.rotate(P, w, N)[0].staff, 'b') // a is planned to take the 6
  assert.equal(Engine.rotate(P, w, N, 'pty1')[0].staff, 'a') // seating that party: its own plan does not count against a
  assert.equal(Engine.serverFor(P, w, N, ['t'], 'pty1').staff, 'a')
})
test('rotation covers the floor units: a bar pair takes no floor turn, however low its tally', () => {
  const w = room(rotation, staff('a', 4, 99), staff('pair', 0, 99, {area: 'bar', weight: 2}), tbl('x', 4))
  assert.equal(Engine.serverFor(P, w, N, ['x']).staff, 'a')
})
