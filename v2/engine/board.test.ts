import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity, TStatus} from '../contracts/index.ts'
import {board, bus, eta, outlook, sectionStats, turnover} from './index.ts'
import {N, P, mins, party, staff, table, world} from './testkit.ts'
type St = 'ACTIVE' | 'LAPSED' | 'COMPLETED'
const slot = (id: string, t: string, pty: string, seated: number, turn: number, status: St, ended?: number): Entity =>
  ({id, slot: {table: t, party: pty, seatedAt: N - mins(seated), turnAt: N + mins(turn), status, ...(ended === undefined ? {} : {endedAt: N - mins(ended)})}})
const res = (num: number, size: number, at: number, t: string | null, status: 'BOOKED' | 'NO_SHOW' = 'BOOKED', name = `R${num}`): Entity =>
  party(num, 'R', size, name, {reservation: {at: N + mins(at), durationMin: 60, table: t, status, phone: '', notes: ''}})
const tb = (id: string, cap: number, status: TStatus = 'available', waiter: string | null = null, floor = 'f1') => table(id, cap, status, 'sA', waiter, floor)
const q = (since: number, quoted: number, status: 'WAITING' | 'SEATED') => ({queue: {since: N - mins(since), quotedMin: quoted, status, from: null}})
/** Seated T1 (from the list, quoted 10, waited 15), lapsed T2, finished T3, an earlier finished T4, booked T10 (+10m), late T9 (-20m), blocked P1 (event), a stool, one walk-in waiting, a table-less 2 (planned) and 10 (unplaceable), a no-show. */
const room = () => world([
  {id: 'f1', floor: {name: 'Main', active: true}}, {id: 'f2', floor: {name: 'Roof', active: true, level: 1}}, {id: 'sA', section: {name: 'A', color: '#fff'}},
  tb('t10', 6), tb('t9', 2), tb('t1', 4, 'occupied', 'w1'), tb('t2', 2, 'lapsed', 'w1'), tb('t3', 4), tb('t4', 4), tb('p1', 4, 'blocked_private', null, 'f2'),
  {...table('g1', 1), table: {label: 'G1', capacity: 1, min: 1, shape: 'stool', status: 'available', waiter: null, section: null}},
  party(1, 'W', 3, 'Ann', q(45, 10, 'SEATED')), slot('sa', 't1', 'pty1', 30, 10, 'ACTIVE'),
  party(2, 'W', 2, 'Bo'), slot('sb', 't2', 'pty2', 80, -10, 'LAPSED'),
  party(3, 'W', 4, 'Cy'), slot('sc', 't3', 'pty3', 100, -40, 'COMPLETED', 28),
  party(9, 'W', 2, 'Di'), slot('sd', 't4', 'pty9', 300, -240, 'COMPLETED', 252),
  res(4, 5, 10, 't10', 'BOOKED', 'Booked'), res(5, 2, -20, 't9', 'BOOKED', 'Late'), res(7, 2, 45, null), res(8, 10, 60, null), res(11, 2, -60, null, 'NO_SHOW'),
  party(6, 'W', 2, 'Wait', q(12, 15, 'WAITING')),
  {id: 'ev1', event: {name: 'Gala', tables: ['p1'], start: N + mins(60), end: N + mins(240), locked: ['p1'], reclaimed: false}},
  staff('w1', 5, 10, {sections: ['sA']}), staff('w2', 0, 10, {active: false}),
])
const B = board(P, room(), N)
test('board composes the engine reads: turnover, bus, quotes per policy size', () => {
  assert.deepEqual(B.turnover, turnover(P, room(), N, 15))
  assert.deepEqual(B.bus, bus(P, room(), N))
  assert.deepEqual(B.bus.map(b => b.table), ['t2'])
  assert.deepEqual(B.quotes, [1, 2, 3, 4, 5, 6].map(n => eta(P, room(), N, n)))
})
test('board ledger: blocked, seated with covers, lapsed, reserved with its time, else open; self-seat stays out', () => {
  assert.deepEqual(B.ledger, {
    open: [{spot: 't3', label: 'T3'}, {spot: 't4', label: 'T4'}],
    reserved: [{spot: 't9', label: 'T9', at: N - mins(20)}, {spot: 't10', label: 'T10', at: N + mins(10)}],
    seated: [{spot: 't1', label: 'T1', covers: 3}], lapsed: [{spot: 't2', label: 'T2'}], blocked: [{spot: 'p1', label: 'P1'}],
  })
})
test('board activity: seat (+) and clear (-) today per 15m interval, newest first, net per interval', () => {
  const at = (h: number, m: number) => new Date(2026, 5, 1, h, m).getTime()
  assert.deepEqual(B.activity.map(a => [a.start, a.end, a.net, a.moves.map(m => `${m.label}${m.kind === 'in' ? '+' : '-'}${m.covers}`)]), [
    [at(17, 30), at(17, 45), -1, ['T1+3', 'T3-4']],
    [at(16, 30), at(16, 45), 2, ['T2+2']],
    [at(16, 15), at(16, 30), 4, ['T3+4']],
    [at(13, 45), at(14, 0), -2, ['T4-2']],
    [at(13, 0), at(13, 15), 2, ['T4+2']],
  ])
  assert.deepEqual(B.activity[0].moves[0], {table: 't1', label: 'T1', kind: 'in', covers: 3})
})
test('board labels: a merged link reads as one spot "T5+T6" in the ledger and the activity', () => {
  const w = world([tb('t5', 2, 'occupied'), tb('t6', 2, 'occupied'), {id: 'lk', link: {members: ['t5', 't6'], merged: true}}, party(1, 'W', 4), slot('s', 't5', 'pty1', 5, 55, 'ACTIVE')])
  const b = board(P, w, N)
  assert.deepEqual([b.ledger.seated, b.activity[0].moves[0].label], [[{spot: 'lk', label: 'T5+T6', covers: 4}], 'T5+T6'])
  assert.deepEqual(b.gantt.lanes.map(l => [l.table, l.bars.map(x => x.kind)]), [['t5', ['slot']], ['t6', ['slot']]])
})
test('board gantt: window around now, lanes with bars only, floor then natural label, over and late flags, plan and unplaced', () => {
  const g = B.gantt
  const plan = outlook(P, room(), N)
  assert.deepEqual([g.from, g.to, g.now], [N - mins(60), N + mins(180), N])
  assert.deepEqual(g.lanes.map(l => l.label), ['T1', 'T2', 'T3', 'T9', 'T10', 'P1'])
  assert.deepEqual(g.lanes[0], {table: 't1', label: 'T1', floor: 'f1', capacity: 4, bars: [{kind: 'slot', from: N - mins(30), to: N + mins(10), party: 'pty1', label: 'Ann', size: 3, over: false}]})
  assert.deepEqual(g.lanes[1].bars, [
    {kind: 'slot', from: N - mins(80), to: N - mins(10), party: 'pty2', label: 'Bo', size: 2, over: true},
    {kind: 'plan', from: N + mins(45), to: N + mins(105), party: 'pty7', label: 'R7', size: 2, late: false},
  ])
  assert.deepEqual(plan.find(x => x.party === 'pty7')?.tables, ['t2'])
  assert.deepEqual(g.lanes[2].bars.map(x => [x.kind, x.to]), [['done', N - mins(28)]])
  assert.deepEqual(g.lanes.slice(3, 5).map(l => l.bars.map(x => [x.kind, x.label, x.late])), [[['res', 'Late', true]], [['res', 'Booked', false]]])
  assert.deepEqual(g.lanes[5].bars, [{kind: 'event', from: N + mins(30), to: N + mins(240), party: null, label: 'Gala', size: 0}])
  assert.deepEqual(g.unplaced.map(x => [x.kind, x.party, x.size]), [['res', 'pty8', 10]])
  assert.deepEqual(board(P, room(), N, {pastMin: 0, aheadMin: 60}).gantt.lanes.map(l => l.label), ['T1', 'T2', 'T9', 'T10', 'P1'])
})
test('board gantt ticks: interval buckets over the window count ACTIVE seatings due to turn', () => {
  const t = B.gantt.ticks
  assert.deepEqual([t.length, t[0].start, t.at(-1)!.end], [16, N - mins(60), N + mins(180)])
  assert.deepEqual(t.filter(x => x.turns).map(x => [x.start, x.turns]), [[N, 1]])
  assert.equal(board(P, room(), N, {ivMin: 30}).gantt.ticks.length, 8)
})
test('board servers: rotation order with tally, weight, covers and tables seated now, held sections; off duty last with rank 0', () => {
  const w = room()
  assert.deepEqual(B.servers, [
    {staff: 'w1', name: 'w1', rank: 1, tally: 5, seated: 3, tables: 1, weight: 1, active: true, sections: [{section: 'sA', name: 'A', ...pick(sectionStats(P, w, N, w.ents.sA as never))}]},
    {staff: 'w2', name: 'w2', rank: 0, tally: 0, seated: 0, tables: 0, weight: 1, active: false, sections: []},
  ])
})
const pick = ({occ, turns, need, under}: ReturnType<typeof sectionStats>) => ({occ, turns, need, under})
test('board kpis: values and tones derived from the world', () => {
  assert.deepEqual(B.kpis.map(k => [k.id, k.value, k.tone]), [
    ['seated', '3/22', 'ok'], ['occ', '33%', 'ok'], ['waiting', '1', 'info'], ['wait', '12m', 'ok'], ['quote', '±5m', 'warn'], ['turn', '60m', 'ok'],
    ['turning', '1', 'ok'], ['arriving', '1', 'info'], ['bus', '1', 'warn'], ['late', '1', 'warn'], ['noshow', '1', 'warn'], ['today', '11', 'info'],
  ])
  assert.deepEqual(B.kpis.map(k => k.hint).slice(0, 3), ['covers / seats', '2/6 tables in use', '2 covers'])
  assert.deepEqual(B.kpis.find(k => k.id === 'arriving'), {id: 'arriving', label: 'Arriving next 15m', value: '1', tone: 'info', hint: '5 covers'})
})
test('board on an empty world: no lanes, empty ledger, neutral kpis', () => {
  const b = board(P, world([]), N)
  assert.deepEqual([b.gantt.lanes, b.activity, b.servers, b.ledger.open], [[], [], [], []])
  assert.deepEqual(b.kpis.filter(k => ['seated', 'quote', 'turn'].includes(k.id)).map(k => k.value), ['0/0', '-', '-'])
})
