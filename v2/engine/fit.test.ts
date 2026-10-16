import test from 'node:test'
import assert from 'node:assert/strict'
import {Engine} from './index.ts'
import {plan} from './fit.ts'
import {holds} from './holds.ts'
import {N, P, demo, mins, party, staff, table, world} from './testkit.ts'
const label = (xs: {label: string}[]) => xs.map(x => x.label).join()
test('fit: tightest free spot wins; sizes with no spot are NO_TABLE', () => {
  const w = world([table('t2', 2), table('t4', 4), table('t6', 6)])
  assert.equal(label(Engine.fit(P, w, N, [2, 3, 5, 9])), 'T2,T4,T6,-')
  assert.deepEqual(Engine.fit(P, w, N, [9])[0], {size: 9, spot: null, tables: [], label: '-', waitMin: 0, at: N, code: 'NO_TABLE', ready: false})
})
test('fit: waits cascade through a claimed spot (turn 60 + reset 5), seats quantised to 5 min', () => {
  const xs = Engine.fit(P, world([table('t4', 4)]), N, [4, 4, 4])
  assert.deepEqual(xs.map(x => x.waitMin), [0, 65, 130])
  assert.deepEqual(xs.map(x => x.code), ['HOT_GREEN', 'CAUTION_WAIT', 'CAUTION_WAIT'])
  assert.equal(xs[1].at, N + mins(65))
})
test('fit: an occupied spot frees at its turn + reset; sequential waits keep >= 3 min cadence', () => {
  const w = world([table('a', 4, 'occupied'), table('b', 4, 'occupied'), party(1, 'W', 4), party(2, 'W', 4),
    {id: 's1', slot: {table: 'a', party: 'pty1', seatedAt: N - mins(50), turnAt: N + mins(10), status: 'ACTIVE'}}, {id: 's2', slot: {table: 'b', party: 'pty2', seatedAt: N - mins(50), turnAt: N + mins(11), status: 'ACTIVE'}}])
  assert.deepEqual(Engine.fit(P, w, N, [4, 4]).map(x => x.waitMin), [15, 20]) // 15m, then 16m rounds up to 20
})
test('fit: lapsed frees in lapsedClear minutes; blocked_private never; occupied without a slot waits half a turn', () => {
  assert.equal(Engine.fit(P, world([table('a', 4, 'lapsed')]), N, [4])[0].waitMin, 5)
  assert.equal(Engine.fit(P, world([table('a', 4, 'blocked_private')]), N, [4])[0].code, 'NO_TABLE')
  assert.equal(Engine.fit(P, world([table('a', 4, 'occupied')]), N, [4])[0].waitMin, 30)
})
test('fit: a reservation hold pushes a walk-in off the held table; its own party ignores the hold', () => {
  const w = demo()
  assert.equal(plan(P, w, N, [6], {floor: 'f1'})[0].label, 'B4') // B3 held at +30m
  assert.equal(plan(P, w, N, [6], {floor: 'f1', skip: 'pty5'})[0].label, 'B3')
})
test('fit: rotation breaks ties among equally tight spots; tightness still beats rotation (v1 planSequence)', () => {
  const w = demo()
  const xs = plan(P, w, N, [2, 2], {floor: 'f1'})
  assert.deepEqual(label(xs), 'A5,C3') // A5/Maya next up, then Sam once Maya has 14
  assert.ok(!['B3', 'B4'].includes(xs[0].label))
  assert.equal(Engine.fit(P, w, N, [2])[0].label, 'P1') // across floors Lee (patio) is next up
})
test('fit: skip-next demotes a server, unsectioned tables lose ties, no servers still plans', () => {
  const w = demo()
  const skip = { ...w, ents: { ...w.ents, w1: staff('w1', 12, 35, {name: 'Maya', sections: ['sA'], skip: 300}) } }
  assert.equal(plan(P, skip, N, [2], {floor: 'f1'})[0].label, 'C3')
  const loose = { ...w, ents: { ...w.ents, t5: table('t5', 2, 'available', null, null, 'f1') } }
  assert.equal(plan(P, loose, N, [2], {floor: 'f1'})[0].label, 'C3')
  const none = world([table('t2', 2)])
  assert.equal(Engine.fit(P, none, N, [2])[0].ready, true)
})
test('fit: a private event holds its tables from 30 min before start; a spot that cannot finish a turn first waits for the event to end', () => {
  const w = world([table('t1', 2), {id: 'e', event: {name: 'X', tables: ['t1'], start: N + mins(60), end: N + mins(220), locked: [], reclaimed: false}}])
  assert.equal(holds(P, w, N)[0].start, N + mins(30))
  assert.equal(Engine.fit(P, w, N, [2])[0].waitMin, 225) // end 220 + reset 5
  assert.equal(Engine.fit(P, {...w, ents: {...w.ents, e: {id: 'e', event: {...w.ents.e.event!, start: N + mins(100)}}}}, N, [2])[0].waitMin, 0) // 65m turn fits before the 70m hold
})
test('lookahead: custom 12-top is NO_TABLE, runway depth and heat tiers, exhausted now', () => {
  const lk = Engine.lookahead(P, demo(), N, [], [2, 12])
  assert.equal(lk[12].code, 'NO_TABLE')
  assert.ok(lk[2])
  const free = (n: number) => world(['a', 'b', 'c'].slice(0, n).map(id => table(id, 4)))
  const three = free(3)
  assert.deepEqual([1, 2, 3].map(n => Engine.lookahead(P, free(n), N, [], [4])[4].code), ['WARM_AMBER', 'WARM_AMBER', 'HOT_GREEN'])
  const busy = Engine.lookahead(P, world([table('a', 4, 'occupied')]), N, [], [4])[4]
  assert.deepEqual([busy.depth, busy.code, busy.msg], [0, 'CAUTION_WAIT', 'EXHAUSTED NOW'])
  assert.equal(Engine.lookahead(P, three, N, [4, 4], [4])[4].depth, 1)
})
test('engine is pure: inputs are never mutated and equal inputs give equal outputs (E1, E2)', () => {
  const w = demo()
  const before = structuredClone(w)
  const a = [Engine.fit(P, w, N, [2, 4, 6]), Engine.lookahead(P, w, N, [2]), Engine.eta(P, w, N, 2), Engine.bus(P, w, N), Engine.alerts(P, w, N), Engine.reconcile(P, w, N + mins(30)), Engine.tick(P, w, N, 500)]
  assert.deepEqual(w, before)
  assert.deepEqual(a, [Engine.fit(P, w, N, [2, 4, 6]), Engine.lookahead(P, w, N, [2]), Engine.eta(P, w, N, 2), Engine.bus(P, w, N), Engine.alerts(P, w, N), Engine.reconcile(P, w, N + mins(30)), Engine.tick(P, w, N, 500)])
})
