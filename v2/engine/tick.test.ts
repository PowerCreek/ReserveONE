import test from 'node:test'
import assert from 'node:assert/strict'
import {Engine, apply} from './index.ts'
import {N, P, mins, table, world} from './testkit.ts'
import type {Entity, SimEvent, World} from '../contracts/index.ts'
const unit = (id: string, role: 'host' | 'server' | 'busser', x: number, extra: Partial<Entity> = {}): Entity =>
  ({id, body: {role, x, y: 0, speed: P.sim.walkPxPerSec, task: null, backlog: [], party: null}, ...extra})
const room = (): World => world([
  {id: 'door', pos: {floor: 'f1', x: 0, y: 0, w: 0, h: 0}}, table('t1', 10, 'available', 'sA', null, 'f1', 160),
  unit('host', 'host', 20), unit('bus', 'busser', 40),
  unit('srv', 'server', 60, {staff: {name: 'Sam', active: true, sections: ['sA'], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 18}}),
])
interface Run {w: World; now: number; log: SimEvent[]}
const step = (r: Run, dt = 500): Run => {
  const out = Engine.tick(P, r.w, r.now + dt, dt)
  return {w: apply(r.w, out.patches), now: r.now + dt, log: [...r.log, ...out.events]}
}
const until = (r: Run, done: (r: Run) => boolean, jump?: (r: Run) => Run, max = 600): Run => {
  const hop = jump ? jump(r) : r
  return done(hop) || max === 0 ? hop : until(step(hop), done, jump, max - 1)
}
const evs = (r: Run) => r.log.map(e => e.ev)
test('spawn: a walk-in is queued at once and walks in from just outside the door; a due reservation arrives with a body', () => {
  const w = room()
  const w1 = apply(w, Engine.spawn(P, w, N, 7))
  const g = Object.values(w1.ents).find(e => e.queue)!
  assert.deepEqual([g.queue!.status, g.party!.kind, g.body!.role, g.body!.party, g.body!.task], ['WAITING', 'W', 'guest', g.id, {do: 'move', x: 0, y: 0}])
  assert.ok(g.party!.size >= 1 && g.body!.x < 0)
  assert.deepEqual(Engine.spawn(P, w, N, 7), Engine.spawn(P, w, N, 7)) // same seed, same guest
  const r = {id: 'pty3', party: {num: 3, label: 'R-3', prefix: '', kind: 'R' as const, name: 'Due', size: 2}, reservation: {at: N - 1, durationMin: 60, table: 't1', status: 'BOOKED' as const, phone: '', notes: ''}}
  const w2 = apply(w, Engine.spawn(P, {...w, ents: {...w.ents, pty3: r}}, N, 1))
  assert.deepEqual([w2.ents.pty3.reservation!.status, w2.ents.pty3.body!.role], ['ARRIVED', 'guest'])
})
test('sim: a spawned guest is queued, seated by the host, served, cleared by the busser, and leaves', () => {
  const start: Run = {w: apply(room(), Engine.spawn(P, room(), N, 7)), now: N, log: []}
  const served = until(start, r => evs(r).includes('served'))
  assert.deepEqual(evs(served).filter(e => e !== 'stuck'), ['arrived', 'seated', 'served'])
  const t = served.w.ents.t1.table!
  assert.deepEqual([t.status, t.waiter], ['occupied', 'srv'])
  assert.equal(served.w.ents.srv.staff!.tally, Object.values(served.w.ents).find(e => e.queue)!.party!.size)
  const gone = until(served, r => evs(r).includes('left') && evs(r).includes('cleared'), r => (r.now === served.now ? {...r, now: r.now + mins(61)} : r))
  const order = evs(gone).filter(e => e !== 'stuck')
  assert.deepEqual([order[0], order[1], order[2]], ['arrived', 'seated', 'served'])
  assert.deepEqual([...order].slice(3).sort(), ['cleared', 'left'])
  const guest = Object.values(gone.w.ents).find(e => e.queue)!
  assert.deepEqual([gone.w.ents.t1.table!.status, gone.w.ents.t1.table!.waiter, guest.queue!.status, 'body' in guest], ['available', null, 'SEATED', false])
  assert.deepEqual(Object.values(gone.w.ents).filter(e => e.slot).map(e => e.slot!.status), ['COMPLETED'])
  assert.ok(!evs(gone).includes('stuck'))
})
test('sim: the host seats by queue tier, not arrival, and never double-books a table', () => {
  const guest = (n: number, kind: 'W' | 'P', since: number): Entity => ({id: `pty${n}`, party: {num: n, label: `${kind}-${n}`, prefix: '', kind, name: `G${n}`, size: 2, here: 2}, queue: {since, quotedMin: 0, status: 'WAITING', from: null}})
  const w = apply(room(), [{op: 'add', ent: guest(1, 'W', N - mins(30))}, {op: 'add', ent: guest(2, 'P', N - mins(1))}])
  const r = until({w, now: N, log: []}, r => evs(r).includes('seated'))
  assert.equal((r.log.find(e => e.ev === 'seated') as {party: string}).party, 'pty2')
  const more = until(r, r => r.now > N + mins(2), undefined, 2000)
  assert.equal(more.log.filter(e => e.ev === 'seated').length, 1) // one table: the second party keeps waiting
  assert.equal(more.w.ents.pty1.queue!.status, 'WAITING')
})
test('sim: a unit whose job can no longer be done reports stuck instead of failing silently', () => {
  const guest: Entity = {id: 'pty1', party: {num: 1, label: 'W-1', prefix: '', kind: 'W', name: 'G', size: 2, here: 2}, queue: {since: N, quotedMin: 0, status: 'WAITING', from: null}}
  const w = apply(room(), [{op: 'add', ent: guest}])
  const mid = until({w, now: N, log: []}, r => (r.w.ents.host.body!.backlog.length === 0 && r.w.ents.host.body!.task?.do === 'seat'))
  const taken = apply(mid.w, [{op: 'set', id: 't1', parts: {table: {...mid.w.ents.t1.table!, status: 'occupied', waiter: null}}}])
  const after = step({...mid, w: taken})
  assert.deepEqual(after.log.map(e => e.ev), ['stuck'])
})
test('sim: tick is a pure function of its inputs; an empty world does nothing', () => {
  assert.deepEqual(Engine.tick(P, world([]), N, 500), {patches: [], events: []})
  const w = room()
  assert.deepEqual(Engine.tick(P, w, N, 500), Engine.tick(P, w, N, 500))
})
