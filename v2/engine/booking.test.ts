// Front-of-house desk (U14): bookings with availability, call-aheads joining at their ETA, the wait list's policy-driven priority order, bumps, texts, leaving.
import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultBooking} from '../contracts/index.ts'
import type {BookCmd, Outcome, World} from '../contracts/index.ts'
import {N, P, mins, party, table, world} from './testkit.ts'
import {apply} from './patch.ts'
import {booking} from './booking.ts'
const ok = (o: Outcome) => (assert.ok(o.ok, o.ok ? '' : o.err), o as Extract<Outcome, {ok: true}>)
const after = (w: World, cmd: BookCmd, now = N) => apply(w, ok(booking.act(P, w, now, cmd)).patches)
const err = (w: World, cmd: BookCmd, now = N) => ((o = booking.act(P, w, now, cmd)) => (o.ok ? '' : o.err))()
const room = () => world([table('t1', 2), table('t2', 4), table('t3', 6)])
const named = (w: World, name: string) => Object.values(w.ents).find(e => e.party?.name === name)!
test('book: exact time, notes, feats as said wants, availability warns but books; edit and cancel keep the record', () => {
  const w1 = after(room(), {do: 'book', size: 4, name: 'Lee', at: N + mins(60), phone: '555', notes: 'birthday', feats: ['quiet'], flags: ['access']})
  const lee = named(w1, 'Lee')
  assert.equal(lee.reservation!.at, N + mins(60))
  assert.equal(lee.reservation!.notes, 'birthday')
  assert.deepEqual(lee.wants!.list.map(x => [x.feat, x.level, x.said]), [['quiet', 'strong', true], ['accessible', 'need', true]])
  assert.equal(lee.intake!.via, 'book')
  const full = booking.act(P, w1, N, {do: 'book', size: 8, name: 'Big', at: N + mins(60)})
  assert.ok(full.ok && full.tone === 'warn' && /No table takes a party of 8/.test(full.msg), full.ok ? full.msg : full.err)
  assert.match(err(w1, {do: 'book', size: 2, name: 'X', at: N - mins(120)}), /passed/)
  assert.match(err(w1, {do: 'book', size: 2, name: 'X', at: N, feats: ['nope']}), /Unknown feature nope/)
  const w2 = after(w1, {do: 'edit', party: lee.id, size: 3, at: N + mins(90), notes: 'cake'})
  assert.deepEqual([named(w2, 'Lee').party!.size, named(w2, 'Lee').reservation!.at, named(w2, 'Lee').reservation!.notes], [3, N + mins(90), 'cake'])
  const w3 = after(w2, {do: 'leave', party: lee.id, why: 'cancel'})
  assert.equal(named(w3, 'Lee').reservation, undefined)
  assert.equal(named(w3, 'Lee').intake!.gone!.why, 'cancel')
  assert.deepEqual(booking.list(P, w3, N, {state: 'all'}).counts.CANCELLED, 1)
})
test('avail: a booked table blocks its window, other bookings claim spots, alternatives are offered', () => {
  const w = world([table('t1', 4), party(1, 'R', 4, 'A', {reservation: {at: N + mins(60), durationMin: 60, table: 't1', status: 'BOOKED', phone: '', notes: ''}})])
  const a = booking.avail(P, w, N, {size: 4, at: N + mins(60)})
  assert.equal(a.ok, false)
  assert.match(a.why, /booked or seated/)
  assert.ok(a.alts.length && a.alts.every(t => t >= N + mins(125) || t <= N), a.alts.map(t => (t - N) / 60000).join(','))
  assert.ok(booking.avail(P, w, N, {size: 4, at: N + mins(180)}).ok)
  const w2 = world([table('t1', 4), party(2, 'R', 4, 'B', {reservation: {at: N + mins(60), durationMin: 60, table: null, status: 'BOOKED', phone: '', notes: ''}})])
  assert.match(booking.avail(P, w2, N, {size: 2, at: N + mins(70)}).why, /Other bookings/)
  assert.equal(booking.avail(P, w2, N, {size: 2, at: N + mins(70), skip: 'pty2'}).ok, true)
})
test('call-ahead: off the list until its ETA, then listed (not here), late after grace; check-in keeps its promised place', () => {
  const w1 = after(room(), {do: 'call', size: 2, name: 'Kim', etaMin: 20, phone: '1'})
  const kim = named(w1, 'Kim')
  assert.equal(kim.queue, undefined)
  assert.deepEqual(booking.wait(P, w1, N).calls.map(c => [c.name, c.inMin]), [['Kim', 20]])
  assert.equal(booking.wait(P, w1, N).rows.length, 0)
  const due = booking.wait(P, w1, N + mins(21)).rows[0]
  assert.deepEqual([due.name, due.here, due.late], ['Kim', false, false])
  assert.equal(booking.wait(P, w1, N + mins(20 + defaultBooking.graceMin.call + 1)).rows[0].late, true)
  const w2 = after(w1, {do: 'arrive', party: kim.id}, N + mins(25))
  assert.equal(named(w2, 'Kim').queue!.since, N + mins(20))
  const r = booking.wait(P, w2, N + mins(30)).rows[0]
  assert.deepEqual([r.here, r.waitedMin, r.late], [true, 10, false])
  assert.match(err(w2, {do: 'arrive', party: kim.id}), /already checked in/)
  const w3 = after(w1, {do: 'noshow', party: kim.id}, N + mins(40))
  assert.equal(named(w3, 'Kim').intake!.gone!.why, 'noshow')
})
test('priority: reservation > call-ahead > walk-in from policy points; flags and waiting add, each with its reason; policy reorders without code', () => {
  let w = room()
  w = after(w, {do: 'walk', size: 2, name: 'Walk'}, N - mins(10))
  w = after(w, {do: 'call', size: 2, name: 'Call', etaMin: 0}, N - mins(5))
  w = after(w, {do: 'book', size: 2, name: 'Res', at: N}, N - mins(30))
  w = after(w, {do: 'arrive', party: named(w, 'Res').id}, N)
  w = after(w, {do: 'arrive', party: named(w, 'Call').id}, N)
  w = after(w, {do: 'walk', size: 3, name: 'Chair', flags: ['access']}, N)
  const rows = booking.wait(P, w, N).rows
  assert.deepEqual(rows.map(r => r.name), ['Res', 'Call', 'Chair', 'Walk'])
  assert.deepEqual(rows.find(r => r.name === 'Chair')!.why.map(t => t.label), ['Walk-in', 'Accessibility'])
  assert.deepEqual(rows.find(r => r.name === 'Walk')!.why.map(t => [t.label, t.pts]), [['Walk-in', 100], ['waited 10m', 30], ['past its quote', 40]]) // quoted 0m (a table was free), waited 10
  const flat = {...P, book: {...defaultBooking, via: {book: {label: 'R', pts: 0}, call: {label: 'C', pts: 0}, walk: {label: 'W', pts: 0}}}}
  assert.equal(booking.wait(flat, w, N).rows[0].name, 'Chair')
})
test('bump needs a reason and moves exactly one place; text marks ready, then no reply; leave strips the queue', () => {
  let w = room()
  w = after(w, {do: 'walk', size: 2, name: 'A'}, N - mins(10))
  w = after(w, {do: 'walk', size: 2, name: 'B'}, N - mins(5))
  w = after(w, {do: 'walk', size: 2, name: 'C'}, N)
  const b = named(w, 'B').id
  assert.match(err(w, {do: 'bump', party: b, to: 'up', why: ' '}), /needs a reason/)
  const w1 = after(w, {do: 'bump', party: b, to: 'up', why: 'apology'})
  const rows = booking.wait(P, w1, N).rows
  assert.deepEqual(rows.map(r => r.name), ['B', 'A', 'C'])
  assert.match(rows[0].why.map(t => t.label).join(','), /bumped: Make up for a long wait/)
  assert.match(err(w1, {do: 'bump', party: b, to: 'top', why: 'host'}), /already first/)
  const w2 = after(w1, {do: 'bump', party: b, to: 'down', why: 'defer'})
  assert.deepEqual(booking.wait(P, w2, N).rows.map(r => r.name), ['A', 'B', 'C'])
  const w3 = after(w2, {do: 'text', party: b})
  assert.equal(booking.wait(P, w3, N).rows[1].texted, N)
  assert.equal(booking.wait(P, w3, N + mins(defaultBooking.replyMin + 1)).rows[1].noReply, true)
  const o = ok(booking.act(P, w3, N, {do: 'leave', party: b, why: 'left'}))
  assert.deepEqual(o.events, [{ev: 'left', party: b}])
  const w4 = apply(w3, o.patches)
  assert.equal(named(w4, 'B').queue, undefined)
  assert.deepEqual(booking.wait(P, w4, N).rows.map(r => r.name), ['A', 'C'])
})
test('list: by slot with states (late after grace), filters by state/size/area, row actions follow the state', () => {
  let w = room()
  w = after(w, {do: 'book', size: 2, name: 'Early', at: N + mins(5)}, N - mins(60))
  w = after(w, {do: 'book', size: 6, name: 'Big', at: N + mins(45), area: 'patio'}, N)
  w = after(w, {do: 'book', size: 4, name: 'Mid', at: N + mins(50)}, N)
  const v = booking.list(P, w, N + mins(25))
  assert.deepEqual(v.slots.map(s => s.rows.map(r => [r.name, r.state])), [[['Early', 'LATE']], [['Big', 'BOOKED'], ['Mid', 'BOOKED']]])
  assert.deepEqual(v.slots[0].rows[0].acts, ['arrive', 'noshow', 'edit', 'cancel'])
  assert.equal(v.slots[1].covers, 10)
  assert.deepEqual(booking.list(P, w, N, {size: [5, 99]}).slots.flatMap(s => s.rows.map(r => r.name)), ['Big'])
  assert.deepEqual(booking.list(P, w, N, {area: 'patio'}).slots.flatMap(s => s.rows.map(r => r.name)), ['Big'])
  assert.equal(booking.list(P, w, N, {state: 'ARRIVED'}).total, 0)
})
