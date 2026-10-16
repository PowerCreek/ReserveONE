import test from 'node:test'
import assert from 'node:assert/strict'
import {Engine} from './index.ts'
import {apply} from './patch.ts'
import {N, P, demo, mins, table, world} from './testkit.ts'
import type {SeatReq} from '../contracts/index.ts'
const go = (req: Partial<SeatReq> & {size: number}, w = demo()) => Engine.seat(P, w, N, {kind: 'W', prefix: 'HS', ...req})
const okay = (req: Partial<SeatReq> & {size: number}, w = demo()) => {
  const d = go(req, w)
  assert.ok(d.ok, d.ok ? '' : d.err)
  return {d, w: apply(w, d.ok ? d.patches : [])}
}
const err = (req: Partial<SeatReq> & {size: number}, w = demo()) => { const d = go(req, w); return d.ok ? 'ok' : d.err }
test('seat auto on a floor: the next-up server gets the tightest table, tally grows by the party size, new party and slot are data', () => {
  const {d, w} = okay({size: 2, floor: 'f1'})
  assert.equal(d.ok && d.msg, 'HS-W-9 → A5 · Maya')
  assert.deepEqual([w.ents.t5.table!.status, w.ents.t5.table!.waiter, w.ents.w1.staff!.tally, w.ents.w1.staff!.lastSeatedAt], ['occupied', 'w1', 14, N])
  assert.deepEqual([w.ents.pty9.party!.label, w.ents.pty9.party!.size], ['HS-W-9', 2])
  assert.deepEqual(Object.values(w.ents).filter(e => e.slot?.party === 'pty9').map(e => [e.slot!.table, e.slot!.turnAt - e.slot!.seatedAt]), [['t5', mins(60)]])
})
test('seat: a 6-top on B3 weighs 6 covers on Dev; afterwards Dev rotates behind equal-tally peers', () => {
  const {w} = okay({size: 6, tables: ['t8']})
  assert.equal(w.ents.w2.staff!.tally, 12)
  const order = Engine.rotate(P, w, N).map(r => r.staff)
  assert.ok(order.indexOf('w1') < order.indexOf('w2'))
})
test('seat: selecting one member seats the whole link group, slot on the primary', () => {
  const {d, w} = okay({size: 4, tables: ['t1']})
  assert.ok(d.ok && d.msg.includes('A1+A2'))
  assert.deepEqual(['t1', 't2'].map(i => w.ents[i].table!.status), ['occupied', 'occupied'])
  assert.equal(Object.values(w.ents).find(e => e.slot?.party === 'pty9')!.slot!.table, 't1')
})
test('seat: refusals name the table and reason', () => {
  assert.equal(err({size: 2, tables: ['t3']}), 'A3 is occupied by another party')
  assert.equal(err({size: 2, tables: ['t7']}), 'B2 is past its turn: clear it first')
  assert.equal(err({size: 4, tables: ['t5']}), 'Capacity too small for party of 4')
  assert.equal(err({size: 2, tables: ['t13']}, world([table('t13', 2, 'blocked_private')])), 'T13 is blocked (private event)')
  assert.equal(err({size: 40}), 'No 40-top fits')
  assert.match(err({size: 4, floor: 'f2'}, world([table('x', 4, 'occupied', null, null, 'f2')])), /^No 4-top ready now \(wait \d+m\)$/)
})
test('seat: a queued party is consumed (queue SEATED, here = size) and keeps its label', () => {
  const {w} = okay({size: 2, queue: 'pty7', floor: 'f1'})
  assert.deepEqual([w.ents.pty7.queue!.status, w.ents.pty7.party!.here, w.nextParty], ['SEATED', 2, 9])
  assert.equal(w.ents.pty9, undefined)
})
test('seat: a reservation sits at its held table for its own duration, status SEATED, and is not blocked by its own hold', () => {
  const {w} = okay({size: 6, kind: 'R', reservation: 'pty5'})
  assert.deepEqual([w.ents.pty5.reservation!.status, w.ents.t8.table!.status], ['SEATED', 'occupied'])
  const s = Object.values(w.ents).find(e => e.slot?.party === 'pty5')!.slot!
  assert.deepEqual([s.table, s.turnAt - s.seatedAt], ['t8', mins(90)])
})
test('seat: an unsectioned table falls back to the top server and warns', () => {
  const w = demo()
  const loose = {...w, ents: {...w.ents, t5: table('t5', 2, 'available', null, null, 'f1')}}
  const d = go({size: 2, tables: ['t5']}, loose)
  assert.ok(d.ok && d.tone === 'warn' && d.msg.endsWith('· Dev (fallback server)'))
})
test('seat: skip-next is cleared by any seating', () => {
  const w = demo()
  const skipped = {...w, ents: {...w.ents, w2: {...w.ents.w2, staff: {...w.ents.w2.staff!, skip: 300}}}}
  assert.equal(okay({size: 2, tables: ['t5']}, skipped).w.ents.w2.staff!.skip, 0)
})
