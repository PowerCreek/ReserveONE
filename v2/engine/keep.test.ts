import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity} from '../contracts/index.ts'
import {Engine, merges} from './index.ts'
import {holds} from './holds.ts'
import {N, P, mins, party} from './testkit.ts'
import {busy, guest, room, tbl} from './mkit.ts'
/** A row of tables: each touches the next (`adj` is symmetric venue data). */
const row = (cap: number, ...ids: string[]): Entity[] => ids.map((id, i) => ({...tbl(id, cap), adj: {with: [ids[i - 1], ids[i + 1]].filter((x): x is string => !!x)}}))
const book = (num: number, size: number, at: number, table: string | null = null): Entity =>
  party(num, 'R', size, `R${num}`, {reservation: {at: N + mins(at), durationMin: 90, table, status: 'BOOKED', phone: '', notes: ''}})
test('merges: every connected run of free tables up to policy.merge.max, once each', () => {
  const ids = merges(P, room(row(2, 'a', 'b', 'c', 'd', 'e'))).map(s => s.id)
  assert.deepEqual(ids.filter(i => i.split('+').length === 2), ['m:a+b', 'm:b+c', 'm:c+d', 'm:d+e'])
  assert.equal(ids.length, 4 + 3 + 2) // pairs, triples, quads (max 4)
  assert.ok(ids.includes('m:b+c+d+e') && !ids.includes('m:a+b+c+d+e'))
})
test('merges: tables across an aisle join through adj like row neighbours, and a busy table breaks the run', () => {
  const w = room({...tbl('a', 4), adj: {with: ['b', 'c']}}, {...tbl('b', 4), adj: {with: ['a', 'd']}}, {...tbl('c', 4), adj: {with: ['a', 'd']}}, {...tbl('d', 4), adj: {with: ['b', 'c']}})
  assert.ok(merges(P, w).some(s => s.id === 'm:a+b+c+d'))
  const cut = room(...busy({...tbl('x', 4), adj: {with: ['y']}}, 30), {...tbl('y', 4), adj: {with: ['x', 'z']}}, {...tbl('z', 4), adj: {with: ['y']}})
  assert.deepEqual(merges(P, cut).map(s => s.id), ['m:y+z'])
})
test('fit: a party of 10 takes the smallest run of tables (fewest, then least capacity) and the label says which', () => {
  const w = room(guest([], 10), row(4, 'a', 'b', 'c', 'd'))
  const [it] = Engine.fit(P, w, N, [10])
  assert.deepEqual([it.ready, it.tables.length, it.label], [true, 3, 'A+B+C'])
  assert.equal(Engine.ladder(P, w, N, 'pty1')[0].say, 'Push A, B and C together: seats 12.')
})
test('fit: among equal tables a walk-in takes the one in the fewest merge options (a row end), keeping the middle free to push together', () => {
  const w = room(guest([], 2), row(2, 'a', 'b', 'c'))
  assert.deepEqual(Engine.fit(P, w, N, [2])[0].tables, ['a'])
})
test('reservations: a walk-in avoids the table that would break up the run an unassigned reservation due soon needs', () => {
  const w = room(guest([], 4), book(2, 12, 15), row(4, 'a', 'b', 'c', 'd'))
  assert.deepEqual(Engine.fit(P, w, N, [4])[0].tables, ['a']) // a, b, c, d: the 12 needs three in a row, so an end table goes
  assert.deepEqual(Engine.match(P, w, N, 'pty1').map(f => [f.spot, f.squeezes.length]), [['a', 0], ['d', 0], ['b', 1], ['c', 1]])
})
test('reservations: no other spot keeps the reservation fed, so the walk-in is still seated and the ladder warns who loses the table', () => {
  const w = room(guest([], 4), book(2, 6, 15), tbl('six', 6))
  const [it] = Engine.fit(P, w, N, [4])
  assert.deepEqual([it.ready, it.tables], [true, ['six']])
  const [r] = Engine.ladder(P, w, N, 'pty1')
  assert.deepEqual([r.step, r.spot, r.squeezes], ['exact', 'six', ['pty2']])
  assert.match(r.say, /That takes the tables R2 party will need soon\.$/)
})
test('reservations: only those due within clock.aheadMin count; far-off, seated and table-holding reservations are no competition', () => {
  const far = room(guest([], 4), book(2, 6, 120), tbl('six', 6))
  assert.deepEqual(Engine.ladder(P, far, N, 'pty1')[0].squeezes, [])
  const held = room(guest([], 4), book(2, 6, 15, 'six'), tbl('six', 6), tbl('four', 4))
  assert.deepEqual(Engine.ladder(P, held, N, 'pty1')[0].squeezes, [])
})
test('reservations: a reservation for 10 is fed by a merge, so a walk-in does not break up the run it needs', () => {
  const w = room(guest([], 4), book(2, 10, 15), row(4, 'a', 'b', 'c', 'd'), tbl('solo', 4))
  assert.deepEqual(Engine.fit(P, w, N, [4])[0].tables, ['solo']) // a, b, c, d together are still free for the 10 (3 tables)
  const tight = room(guest([], 4), book(2, 10, 15), row(4, 'a', 'b', 'c'))
  const [it] = Engine.fit(P, tight, N, [4])
  assert.deepEqual(it.tables.length, 1) // seated, but it squeezes the 10
  assert.deepEqual(Engine.ladder(P, tight, N, 'pty1')[0].squeezes, ['pty2'])
})
test('holds: a reservation holding a merge id holds each of its tables', () => {
  const w = room(guest([], 2), book(2, 8, 15, 'm:a+b'), row(4, 'a', 'b'), tbl('c', 4))
  assert.deepEqual(holds(P, w, N).map(h => h.table).sort(), ['a', 'b'])
})
