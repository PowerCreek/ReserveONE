import {having} from '../contracts/index.ts'
import type {Components, HostEvent, Id, Patch, Task, World} from '../contracts/index.ts'
import {center, partyOf, phase} from './ents.ts'
import type {Pty} from './ents.ts'
import {plan} from './fit.ts'
import {line} from './queue.ts'
import {bus} from './bus.ts'
import {bodyOf, emit} from './simctx.ts'
import type {Ctx, Stage} from './simctx.ts'
import {set} from './patch.ts'
import {knows} from './knows.ts'
import {hold} from './lease.ts'
type Of<K extends Task['do']> = Extract<Task, {do: K}>
type Job = (c: Ctx, w: World, id: Id) => Task[]
/** Tasks other staff already hold (guests' passive tasks are not claims). */
const inflight = (w: World): Task[] => having(w, 'body').filter(e => e.body.role !== 'guest').flatMap(e => [e.body.task, ...e.body.backlog]).filter((t): t is Task => t !== null)
const trip = (c: Ctx, w: World, table: Id, then: Task, sec: number): Task[] => [{do: 'move', ...center(w, table)}, {do: 'wait', sec}, then]
const seats = (w: World) => inflight(w).filter((t): t is Of<'seat'> => t.do === 'seat')
const readyOn = (c: Ctx, w: World, busy: Id[], q: Pty): Id | undefined => {
  const it = plan(c.p, w, c.now, [q.party.size], {busy, skip: q.id, merge: false})[0]
  return it.ready ? it.tables[0] : undefined
}
const heldOpen = (w: World, busy: Id[], held: Id): Id | undefined => (w.ents[held]?.table?.status === 'available' && !busy.includes(held) ? held : undefined)
/** A reservation waits for its own table; everyone else takes the best ready spot that no other trip has claimed. */
const spot = (c: Ctx, w: World, busy: Id[], q: Pty): Id | undefined => (q.reservation?.table ? heldOpen(w, busy, q.reservation.table) : readyOn(c, w, busy, q))
/** A party the player is working (offer open or accepted) or one already leased is not the sim host's to seat. */
const engaged = (q: Pty) => q.offer?.status === 'open' || q.offer?.status === 'accepted' || !!q.lease
const offer = (c: Ctx, w: World, q: Pty): { q: Pty; table: Id }[] => {
  const t = !engaged(q) && !q.body?.task && !seats(w).some(s => s.party === q.id) ? spot(c, w, seats(w).map(s => s.table), q) : undefined
  return t ? [{q, table: t}] : []
}
const hostSeats: Job = (c, w) => {
  const o = line(c.p, w).flatMap(q => offer(c, w, q))[0]
  return o ? trip(c, w, o.table, {do: 'seat', party: o.q.id, table: o.table}, c.p.sim.dwellSec.seat) : []
}
const noJob: Job = () => []
/** The sim host seats only when the policy lets it (`sim.autoSeat`); otherwise the player seats. */
const hostJob: Job = (c, w, id) => ({true: hostSeats, false: noJob}[String(c.p.sim.autoSeat) as 'true' | 'false'])(c, w, id)
const serverJob: Job = (c, w, id) => {
  const held = inflight(w).filter((t): t is Of<'serve'> => t.do === 'serve').map(t => t.table)
  const asks = having(w, 'party', 'body').flatMap(g => (g.body.task?.do === 'serve' ? [g.body.task.table] : []))
  const mine = asks.filter(t => !held.includes(t) && [id, null].includes(w.ents[t]?.table?.waiter ?? null) && knows(c.p, w, c.now, t))[0]
  return mine ? trip(c, w, mine, {do: 'serve', table: mine}, c.p.sim.dwellSec.serve) : []
}
const busserJob: Job = (c, w) => {
  const held = inflight(w).filter((t): t is Of<'clear'> => t.do === 'clear').map(t => t.table)
  const next = bus(c.p, w, c.now).find(b => !held.includes(b.table))
  return next ? trip(c, w, next.table, {do: 'clear', table: next.table}, c.p.sim.dwellSec.clear) : []
}
const guestJob: Job = (c, w, id) => (phase(w, id) === 'gone' ? [{do: 'move', ...center(w, 'door', c.p)}] : [])
const jobs: Record<Components['body']['role'], Job> = {host: hostJob, server: serverJob, busser: busserJob, guest: guestJob}
/** A seating trip leads the party first: the table is leased to it as the host sets off (the guest walks along); the seat task confirms the lease. */
const lead = (c: Ctx, w: World, id: Id, job: Task[]): {ps: Patch[]; es: HostEvent[]} => {
  const t = job.find((x): x is Of<'seat'> => x.do === 'seat')
  const who = partyOf(w, t?.party)
  return t && who ? {ps: hold(c.p, w, c.now, who, t.table, 'host'), es: [{ev: 'leased', party: who.id, spot: t.table, by: id}]} : {ps: [], es: []}
}
/** An idle unit takes its role's next job (a trip: move, dwell, act), if there is one. */
export const assign: Stage = (c, id, a) => {
  const b = bodyOf(a, id)
  const job = b && !b.task ? jobs[b.role](c, a.w, id) : []
  const l = lead(c, a.w, id, job)
  return b && job.length ? emit(a, [set(id, {body: {...b, task: job[0], backlog: job.slice(1)}}), ...l.ps], l.es) : a
}
