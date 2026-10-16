import test from 'node:test'
import assert from 'node:assert/strict'
import {Engine, apply, heard} from './index.ts'
import {N, P as base, mins, table, world} from './testkit.ts'
import type {Entity, SimOut, World} from '../contracts/index.ts'
const P = {...base, sim: {...base.sim, autoSeat: true}} // these tests exercise the sim host itself
const unit = (id: string, role: 'host' | 'server' | 'busser', x: number, extra: Partial<Entity> = {}): Entity =>
  ({id, body: {role, x, y: 0, speed: P.sim.walkPxPerSec, task: null, backlog: [], party: null}, ...extra})
const room = (): World => world([
  {id: 'door', pos: {floor: 'f1', x: 0, y: 0, w: 0, h: 0}}, table('t1', 10, 'available', 'sA', null, 'f1', 160),
  unit('host', 'host', 20), unit('bus', 'busser', 40),
  unit('srv', 'server', 60, {staff: {name: 'Sam', active: true, sections: ['sA'], lastSeatedAt: null, tally: 0, skip: 0, maxCovers: 18}}),
])
interface Run {w: World; now: number; log: SimOut['events']}
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
  const w = apply(room(), [{op: 'add', ent: guest(1, 'W', N - mins(20))}, {op: 'add', ent: guest(2, 'P', N - mins(1))}])
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
const waiting = (n: number, ago: number, extra: Partial<Entity> = {}): Entity =>
  ({id: `pty${n}`, party: {num: n, label: `W-${n}`, prefix: '', kind: 'W', name: `G${n}`, size: 2, here: 2}, queue: {since: N - mins(ago), quotedMin: 0, status: 'WAITING', from: null}, ...extra})
const bare = (...es: Entity[]): World => world([{id: 'door', pos: {floor: 'f1', x: 0, y: 0, w: 0, h: 0}}, ...es])
test('tick+settle: a party past its patience leaves the list and says so; one inside it keeps waiting', () => {
  const w = bare(waiting(1, 26, {body: {role: 'guest', x: 0, y: 0, speed: 80, task: null, backlog: [], party: 'pty1'}}), waiting(2, 10))
  const out = Engine.tick(P, w, N, 500)
  assert.deepEqual(out.events.map(e => e.ev), ['left'])
  const w1 = apply(w, out.patches)
  assert.deepEqual([w1.ents.pty1.queue, w1.ents.pty1.body], [undefined, undefined]) // the party stays as history, off the list and off the floor
  assert.equal(w1.ents.pty2.queue!.status, 'WAITING')
})
test('tick+settle: an offer unanswered past answerMin lapses and the party answers no', () => {
  const open = (at: number) => waiting(1, 1, {offer: {spot: 't1', step: 'exact', gives: [], lacks: [], at, status: 'open'}})
  const fresh = Engine.tick(P, bare(open(N - mins(1))), N, 500)
  assert.deepEqual(fresh.events, [])
  const w = bare(open(N - mins(4)))
  const out = Engine.tick(P, w, N, 500)
  assert.deepEqual(out.events, [{ev: 'answered', party: 'pty1', spot: 't1', yes: false}])
  assert.equal(apply(w, out.patches).ents.pty1.offer!.status, 'lapsed')
})
test('tick: a new request is announced once as asked; `heard` is derived from an intake patch', () => {
  const w = bare({id: 'pty1', party: {num: 1, label: 'W-1', prefix: '', kind: 'W', name: 'G', size: 2}, request: {reason: 'draft', stage: 'arrived', table: 't1', at: N, status: 'open', spot: null}})
  const kinds = (now: number) => Engine.tick(P, w, now, 500).events.map((e: {ev: string}) => e.ev)
  assert.deepEqual([kinds(N + 100), kinds(N + 600), kinds(N + 1100)].map(k => k.includes('asked')), [true, false, false])
  const wants = {list: [{feat: 'booth', level: 'strong' as const, why: 'bench', accord: 'all' as const}, {feat: 'quiet', level: 'soft' as const, why: 'nice', accord: 'one' as const, said: true}], heard: []}
  const g = bare({id: 'pty1', party: w.ents.pty1.party!, wants})
  const d = Engine.intake(P, g, N, 'pty1', ['booth', 'quiet'])
  assert.ok(d.ok)
  assert.deepEqual(heard(g, d.ok ? d.patches : []), [{ev: 'heard', party: 'pty1', feat: 'booth', level: 'strong'}]) // quiet was volunteered: nothing new to hear
  assert.deepEqual(heard(apply(g, d.ok ? d.patches : []), d.ok ? d.patches : []), []) // idempotent
})
test('sim: a world without a door entity spawns guests at the policy door; a party with an open offer is left to the player', () => {
  const w = world([table('t1', 10, 'available', 'sA', null, 'f1', 160), unit('host', 'host', 20)])
  const g = apply(w, Engine.spawn(P, w, N, 7)).ents
  const guest = Object.values(g).find(e => e.queue)!
  assert.equal(guest.body!.y, P.sim.door[1])
  const held = apply(room(), [{op: 'add', ent: waiting(1, 1, {offer: {spot: 't1', step: 'exact', gives: [], lacks: [], at: N, status: 'accepted'}})}])
  const r = until({w: held, now: N, log: []}, r => r.now > N + mins(1), undefined, 1000)
  assert.deepEqual(r.log, [])
})
// ---- service: the sim host seats only when the policy says so; a seated guest is served only by a server who knows
const down = (id: string, area?: string): Entity => ({...table(id, 10, 'available', 'sA', null, 'f1', 160), assign: {staff: 'srv'}, ...(area ? {area: {id: area}} : {})}) // sectioned at N: a dealt top
const seated = (area?: string): Run => { // the stand seats a guest the sim spawned; the sim host (autoSeat off) is not involved
  const w = apply(room(), Engine.spawn(base, room(), N, 7))
  const w1 = {...w, ents: {...w.ents, t1: down('t1', area)}}
  const guest = Object.values(w1.ents).find(e => e.queue)!
  const d = Engine.seat(base, w1, N, {size: guest.party!.size, kind: 'W', party: guest.id, tables: ['t1']})
  assert.ok(d.ok)
  return {w: apply(w1, d.ok ? d.patches : []), now: N, log: []}
}
const stepBase = (r: Run, dt = 500): Run => {
  const out = Engine.tick(base, r.w, r.now + dt, dt)
  return {w: apply(r.w, out.patches), now: r.now + dt, log: [...r.log, ...out.events]}
}
const runBase = (r: Run, done: (r: Run) => boolean, max = 1200): Run => (done(r) || max === 0 ? r : runBase(stepBase(r), done, max - 1))
test('sim: with autoSeat off (the default) the host never seats a waiting party', () => {
  const w = apply(room(), Engine.spawn(base, room(), N, 7))
  const r = runBase({w, now: N, log: []}, x => x.now >= N + mins(5))
  assert.deepEqual([base.sim.autoSeat, evs(r).filter(e => e !== 'arrived')], [false, []])
})
test('sim: a guest the stand seated is served at once on the main floor (the seating hands its body the serve task)', () => {
  const r = runBase(seated(), x => evs(x).includes('served'))
  assert.deepEqual(evs(r).filter(e => e !== 'arrived'), ['served'])
  assert.deepEqual(r.log.filter(e => e.ev === 'served'), [{ev: 'served', table: 't1', by: 'srv'}])
})
test('sim: a patio seating stays unserved until the host tells the server, then is served', () => {
  const r = runBase(seated('patio'), x => x.now >= N + mins(5))
  assert.deepEqual(evs(r).filter(e => e !== 'arrived'), [])
  const d = Engine.tell(base, r.w, r.now, 't1')
  assert.ok(d.ok)
  const after = runBase({...r, w: apply(r.w, d.ok ? d.patches : [])}, x => evs(x).includes('served'))
  assert.deepEqual(evs(after).filter(e => e !== 'arrived'), ['served'])
})
