import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity} from '../contracts/index.ts'
import type {StratCtl, StratHold} from '../contracts/strategy.ts'
import {strategy} from './strategy.ts'
import {N, P, mins, party, staff} from './testkit.ts'
import {busy, room, tbl} from './mkit.ts'
/** A string of adjacent tables (venue `adj` data, symmetric). */
const row = (ids: string[], cap = 4): Entity[] => ids.map((id, i) => ({...tbl(id, cap), adj: {with: [ids[i - 1], ids[i + 1]].filter((x): x is string => !!x)}}))
const at = (ents: Entity[], id: string, left: number) => ents.flatMap(e => (e.id === id ? busy(e, left) : [e]))
const res = (num: number, size: number, inMin: number, table: string | null = null) => party(num, 'R', size, `R${num}`, {reservation: {at: N + mins(inMin), durationMin: 90, table, status: 'BOOKED', phone: '', notes: ''}})
const ctl = (o: Partial<StratCtl> = {}): StratCtl => ({guess: 'none', behind: [], holds: [], ...o})
const go = (ents: Entity[], o: Partial<StratCtl> = {}) => strategy(P, room(...ents), N, ctl(o))
/** A and D seated, B booked in 30m, C open. */
const adb = () => [...at(at(row(['a', 'b', 'c', 'd']), 'a', 20), 'd', 25), res(5, 4, 30, 'b')]
test('A and D seated, B booked later: A and D turn before B is due, a 4 goes to C (B stays clear)', () => {
  const v = go(adb())
  const lane = Object.fromEntries(v.lanes.map(l => [l.table, l]))
  assert.deepEqual([lane.a!.freeIn, lane.d!.freeIn, lane.b!.next?.at, lane.b!.next?.party], [25, 30, 30, 'pty5'])
  assert.ok(lane.a!.freeIn < lane.b!.next!.at && lane.d!.freeIn <= lane.b!.next!.at)
  assert.deepEqual(lane.c!.run, ['a', 'b', 'd'])
  assert.deepEqual([v.moves[4]?.tables, v.moves[4]?.cost], [['c'], 0])
})
test('C links with D for a 5-top once D turns (B is promised): a pair and the 5-top move', () => {
  const v = go(adb())
  assert.deepEqual(v.pairs.map(x => [x.tables, x.at, x.size]), [[['c', 'd'], 30, 8]])
  assert.deepEqual([v.moves[5]?.tables, v.moves[5]?.merge, v.moves[5]?.turn], [['c', 'd'], true, 30 + 58])
})
test('a reservation landing near B\'s turn is planned on C+B; a 2-top on C now squeezes it', () => {
  const ents = [...at(at(at(row(['a', 'b', 'c', 'd']), 'a', 60), 'b', 25), 'd', 70), res(6, 6, 30)]
  const v = go(ents, {guess: '2top'})
  const lane = Object.fromEntries(v.lanes.map(l => [l.table, l]))
  assert.deepEqual([lane.b!.next?.party, lane.c!.next?.party, lane.d!.next], ['pty6', 'pty6', null])
  assert.ok(v.pairs.some(x => x.tables.join() === 'b,c' && x.why === 'planned for HS-R-6 (6) in 30m'))
  assert.deepEqual([v.moves[2]?.tables, v.moves[2]?.cost], [['c'], 1])
  assert.ok(v.risks.some(r => r.kind === 'squeeze' && r.party === 'pty6' && r.size === 2))
})
test('joint: a 2 at the door with a 6 behind leaves the A+B merge for the 6', () => {
  const ents = [{...tbl('a', 4), adj: {with: ['b']}}, {...tbl('b', 2), adj: {with: ['a']}}, tbl('d', 4)]
  assert.deepEqual(go(ents, {at: 2}).joint, null)
  const v = go(ents, {at: 2, behind: [6]})
  assert.deepEqual(v.sizes, [2])
  assert.deepEqual(v.joint?.map(m => [m.size, m.tables, m.why[0]]), [[2, ['d'], 'at the door'], [6, ['a', 'b'], 'behind #1']])
})
test('gated hold: C kept for a 5 once D frees; a 4 goes elsewhere, waits for a hold-free table, or takes C at a cost', () => {
  const hold: StratHold = {id: 'h1', tables: ['c'], size: 5, until: N + mins(90), gate: {kind: 'free', table: 'd'}, why: 'a 5 with D'}
  const clock: StratHold = {id: 'h2', tables: ['f'], size: 4, until: N + mins(30), gate: {kind: 'at', at: N - mins(1)}, why: 'regular'}
  const v = go([tbl('c', 4), ...busy(tbl('d', 4), 20), tbl('f', 4)], {holds: [hold, clock]})
  assert.deepEqual([v.live, v.waiting], [['h2'], ['h1']])
  assert.deepEqual([v.moves[4]?.tables, v.moves[4]?.cost], [['f'], 0])
  assert.deepEqual(go([tbl('c', 4), ...busy(tbl('d', 4), 20)], {holds: [hold]}).moves[4]?.tables, ['d'])
  const far = go([tbl('c', 4), ...busy(tbl('d', 4), 40)], {holds: [hold]}).moves[4]
  assert.deepEqual([far?.tables, far?.cost, far?.why.at(-1)], [['c'], 1, 'squeezes hold h1'])
})
test('lockout: a large party gets no booth, so nothing fits a 6; without the assumption the booth is the 6', () => {
  const ents = [tbl('a', 4), tbl('b', 4), {...tbl('bo', 6), table: {...tbl('bo', 6).table!, shape: 'booth' as const}}]
  const v = go(ents, {guess: 'large'})
  assert.deepEqual([v.sizes, v.moves[6]], [[6, 7, 8], null])
  assert.ok(v.risks.some(r => r.kind === 'lockout' && r.size === 6))
  assert.deepEqual(go(ents).moves[6]?.tables, ['bo'])
})
test('share: covers now + planned per floor server; an overloaded section is a risk', () => {
  const seat = (t: string, num: number, size: number): Entity[] => [{...tbl(t, 6, [], 'f1', 's1'), table: {...tbl(t, 6, [], 'f1', 's1').table!, status: 'occupied', waiter: 'w1'}}, party(num, 'W', size), {id: `s${num}`, slot: {table: t, party: `pty${num}`, seatedAt: N - mins(20), turnAt: N + mins(40), status: 'ACTIVE'}}]
  const crew = [staff('w1', 0, 10, {sections: ['s1']}), staff('w2', 0, 10, {sections: ['s2']})]
  const v = go([...seat('a', 1, 6), ...seat('b', 2, 6), ...seat('c', 3, 6), tbl('d', 4, [], 'f1', 's2'), ...crew])
  assert.deepEqual(v.share.map(s => [s.staff, s.now, s.planned]), [['w1', 18, 0], ['w2', 0, 0]])
  assert.ok(v.risks.some(r => r.kind === 'section' && r.text.startsWith('w1')))
  assert.ok(!go([...seat('a', 1, 6), tbl('d', 4, [], 'f1', 's2'), ...crew]).risks.some(r => r.kind === 'section'))
})
