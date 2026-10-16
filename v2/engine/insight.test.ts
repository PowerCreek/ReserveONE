import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity, Insight, World} from '../contracts/index.ts'
import {board} from './index.ts'
import {N, P, mins, party, staff, table, world} from './testkit.ts'
type St = 'ACTIVE' | 'LAPSED'
const slot = (id: string, t: string, pty: string, turn: number, status: St = 'ACTIVE'): Entity => ({id, slot: {table: t, party: pty, seatedAt: N - mins(30), turnAt: N + mins(turn), status}})
const q = (num: number, size = 2, name = `Q${num}`): Entity => party(num, 'W', size, name, {queue: {since: N - mins(5), quotedMin: 10, status: 'WAITING', from: null}})
const res = (num: number, size: number, at: number, t: string | null = null): Entity => party(num, 'R', size, `R${num}`, {reservation: {at: N + mins(at), durationMin: 90, table: t, status: 'BOOKED', phone: '', notes: ''}})
const leased = (id: string, cap: number) => table(id, cap, 'leased', null, 'w1')
const seatedOn = (num: number, size: number, t: string, turn: number): Entity[] => [party(num, 'W', size), slot(`s${num}`, t, `pty${num}`, turn)]
const of = (w: World, id: Insight['id']) => board(P, w, N).insights.filter(i => i.id === id)
test('insight brick: a lease that strands a due reservation (crit); quiet once another spot feeds it', () => {
  const w = world([leased('six', 6), party(1, 'W', 4, 'Lea', {lease: {spot: 'six', tables: ['six'], at: N, until: N + mins(2), step: 'exact'}}), res(2, 6, 15), staff('w1', 0, 5)])
  assert.deepEqual(of(w, 'brick').map(i => [i.level, i.msg, i.tables, i.at]), [['crit', 'R2 (6) stranded by Lease SIX', ['six'], N + mins(15)]])
  assert.deepEqual(of(world([...Object.values(w.ents), table('alt', 6)]), 'brick'), [])
})
test('insight brick: the waiting head\'s top offer takes the table a due reservation needs (warn, tables = the offer\'s)', () => {
  const w = world([q(1, 4, 'Ann'), res(2, 6, 15), table('six', 6), staff('w1', 0, 5)])
  assert.deepEqual(of(w, 'brick').map(i => [i.level, i.msg, i.tables]), [['warn', 'Ann (4) at SIX strands R2 (6)', ['six']]])
  assert.deepEqual(of(world([q(1, 4), res(2, 6, 15), table('six', 6), table('four', 4)]), 'brick'), [])
})
test('insight pressure: a deluge of turns in one interval within the horizon; quiet below policy.board.insight.delugeTurns', () => {
  const tabs = ['a', 'b', 'c'].map(id => table(id, 2, 'occupied'))
  const w = world([...tabs, ...seatedOn(1, 2, 'a', 3), ...seatedOn(2, 2, 'b', 5), ...seatedOn(3, 2, 'c', 9)])
  assert.deepEqual(of(w, 'pressure').map(i => [i.level, i.msg, i.tables, i.at]), [['warn', 'Deluge: 3 turns at 18:00', ['a', 'b', 'c'], N]])
  assert.deepEqual(of(world([...tabs, ...seatedOn(1, 2, 'a', 3), ...seatedOn(2, 2, 'b', 5)]), 'pressure'), [])
})
test('insight pressure: a drought (no turn for policy droughtMin) while the list waits; quiet with nobody waiting or a turn due', () => {
  const base = [table('a', 2, 'occupied'), ...seatedOn(1, 2, 'a', 90)]
  assert.deepEqual(of(world([...base, q(5)]), 'pressure').map(i => [i.msg, i.at]), [['Drought: no turn 18:00-18:30, 1 waiting', N]])
  assert.deepEqual(of(world(base), 'pressure'), [])
  assert.deepEqual(of(world([table('a', 2, 'occupied'), ...seatedOn(1, 2, 'a', 20), q(5)]), 'pressure'), [])
})
test('insight imbalance: projected covers (tally, seated covers included) spread past policy imbalanceCovers names the highest and lowest', () => {
  const crew = [staff('w1', 10, 5, {name: 'Ana'}), staff('w2', 0, 5, {name: 'Ben'})]
  const w = world([...crew, table('a', 4, 'occupied', null, 'w1'), ...seatedOn(1, 4, 'a', 40)])
  assert.deepEqual(of(w, 'imbalance').map(i => [i.level, i.msg, i.staff]), [['warn', 'Ana 10 vs Ben 0 covers by 18:30', ['w1', 'w2']]])
  assert.deepEqual(of(world([staff('w1', 6, 5), staff('w2', 0, 5)]), 'imbalance'), [])
  assert.deepEqual(of(world([staff('w1', 6, 5), staff('w2', 0, 5), staff('w3', 0, 5, {active: false})]), 'imbalance').length, 0)
})
test('insight punctual: at peak queue, booked reservations past the peak grace are called late; quiet below peakQueue', () => {
  const line = Array.from({length: P.board.insight.peakQueue}, (_, i) => q(10 + i))
  const late = [res(2, 4, -8, 't1'), res(3, 2, -2), table('t1', 4)]
  assert.deepEqual(of(world([...line, ...late]), 'punctual').map(i => [i.level, i.msg, i.tables, i.at]), [['warn', 'Peak (6 waiting): R2 (4) past 5m, treat as late', ['t1'], N - mins(8)]])
  assert.deepEqual(of(world([...line.slice(1), ...late]), 'punctual'), [])
})
test('insight reclaim: a merged link seating fewer than it joins frees its tail for a waiting party; quiet when the party needs it all', () => {
  const run = ['a', 'b', 'c'].map(id => table(id, 2, 'occupied'))
  const lk: Entity = {id: 'lk', link: {members: ['a', 'b', 'c'], merged: true}}
  assert.deepEqual(of(world([...run, lk, ...seatedOn(1, 2, 'a', 40), q(5, 4, 'Kim')]), 'reclaim').map(i => [i.level, i.msg, i.tables]), [['info', 'Split A+B+C: Kim (4) fits B+C', ['b', 'c']]])
  assert.deepEqual(of(world([...run, lk, ...seatedOn(1, 6, 'a', 40), q(5, 2)]), 'reclaim'), [])
  assert.deepEqual(of(world([...run, lk, ...seatedOn(1, 2, 'a', 40)]), 'reclaim'), [])
})
test('insights list worst first: crit, then warn, then info', () => {
  const w = world([leased('six', 6), party(1, 'W', 4, 'Lea', {lease: {spot: 'six', tables: ['six'], at: N, until: N + mins(2), step: 'exact'}}), res(2, 6, 15),
    ...['a', 'b', 'c'].map(id => table(id, 2, 'occupied')), {id: 'lk', link: {members: ['a', 'b', 'c'], merged: true}}, ...seatedOn(3, 2, 'a', 90), q(5, 2)])
  assert.deepEqual(board(P, w, N).insights.map(i => i.level), ['crit', 'warn', 'info'])
})

// ---- next: the task readout, one branch each
const next = (ents: Entity[]) => board(P, world(ents), N).next
test('next: the waiting head with its top offer and server', () => {
  assert.equal(next([q(1, 4), table('t12', 4), staff('w1', 0, 5, {name: 'Ana'})]), 'WALK-IN (4) → T12 → Ana')
})
test('next: else the first pending tell, then the top bus item, then the head\'s wait, else all clear', () => {
  const told = [{...table('p3', 4, 'occupied', null, 'w2'), area: {id: 'patio'}}, ...seatedOn(1, 4, 'p3', 40), staff('w2', 0, 5, {name: 'Ben'})]
  assert.equal(next(told), 'TELL Ben → P3')
  assert.equal(next([table('t7', 4, 'lapsed'), party(2, 'W', 2), slot('s2', 't7', 'pty2', -5, 'LAPSED')]), 'BUS T7')
  assert.match(next([q(1, 2), table('t1', 2, 'occupied'), ...seatedOn(3, 2, 't1', 20)]), /^WALK-IN \(2\) → WAIT/)
  assert.equal(next([]), 'All clear')
})
