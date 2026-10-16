import test from 'node:test'
import assert from 'node:assert/strict'
import {Engine, queueOrder} from './index.ts'
import {N, P, demo, mins, party, table, world} from './testkit.ts'
import {midnight} from './time.ts'
const full = () => { const w = demo(); return {...w, ents: Object.fromEntries(Object.entries(w.ents).map(([k, e]) => [k, e.table ? {...e, table: {...e.table, status: 'occupied' as const}} : e]))} }
test('eta: one party ahead (Chen) and tables free => ready now; oversize => none', () => {
  const q = Engine.eta(P, demo(), N, 2)
  assert.deepEqual([q.ahead, q.ready, q.none, q.waitMin, q.lo, q.hi], [1, true, false, 0, 0, 0])
  const none = Engine.eta(P, demo(), N, 40)
  assert.deepEqual([none.none, none.at], [true, null])
})
test('eta: all occupied => waits and quotes a 10 minute window floored to 5', () => {
  const q = Engine.eta(P, full(), N, 2)
  assert.ok(!q.ready && q.waitMin > 0 && q.hi === q.lo + 10 && q.lo % 5 === 0 && q.at !== null)
})
test('queueOrder: P before V before W/R, then oldest first; seated entries drop out', () => {
  const q = (n: number, kind: 'W' | 'P' | 'V', ago: number, status: 'WAITING' | 'SEATED' = 'WAITING') => party(n, kind, 2, `G${n}`, {queue: {since: N - mins(ago), quotedMin: 0, status, from: null}})
  const w = world([q(1, 'W', 9), q(2, 'P', 1), q(3, 'W', 20), q(4, 'V', 5), q(5, 'P', 3, 'SEATED')])
  assert.equal(queueOrder(P, w).map(e => e.id).join(), 'pty2,pty4,pty3,pty1')
})
test('turnover: 9 rows, one current, aligned to midnight, each interval wide; the overdue out lands in the current row', () => {
  for (const iv of [10, 15, 30, 45]) {
    const rows = Engine.turnover(P, demo(), N, iv)
    assert.equal(rows.length, 9)
    assert.equal(rows.filter(r => r.now).length, 1)
    assert.equal((rows[0].start - midnight(N)) % (iv * 60000), 0)
    assert.ok(rows.every(r => r.end - r.start === iv * 60000))
  }
  const cur = Engine.turnover(P, demo(), N, 15).find(r => r.now)!
  assert.ok(cur.outCovers >= 3 && cur.proj)
})
test('turnover: observed seatings count as ins (4 slots, 14 covers), projected turns as outs, due and late reservations as ins at max(time, now)', () => {
  const rows = Engine.turnover(P, demo(), N, 600) // wide rows: the whole day in few buckets
  const all = rows.reduce((a, r) => ({inC: a.inC + r.inCovers, inP: a.inP + r.inParties, outP: a.outP + r.outParties}), {inC: 0, inP: 0, outP: 0})
  assert.equal(all.outP, 4) // four unfinished slots project an out each
  assert.ok(all.inP >= 6 && all.inC >= 14 + 6 + 2) // 4 observed seatings + res r1 (6) + late r2 (2)
  const next = Engine.turnover(P, demo(), N, 15).find(r => r.now)!
  assert.equal(next.inParties >= 1 && next.inCovers >= 2, true) // late 2-top projects to now
})
test('turnover: a row with nothing in it is zero and not projected', () => {
  const r = Engine.turnover(P, world([table('a', 2)]), N, 30)[0]
  assert.deepEqual([r.inCovers, r.outCovers, r.net, r.proj], [0, 0, 0, false])
})
