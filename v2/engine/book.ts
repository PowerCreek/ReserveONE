import {having} from '../contracts/index.ts'
import type {Decision, Ent, Id, Patch, Pick, Policy, SeatReq, Task, World} from '../contracts/index.ts'
import {center, nextNum, partyLabel} from './ents.ts'
import type {Lease, Pty} from './ents.ts'
import {MIN} from './time.ts'
import {add, set} from './patch.ts'
import {serverOf} from './rotate.ts'
const marked = (l?: Lease) => (l?.prefs ? {prefs: l.prefs} : {})
/** Tables leased to the party already carry the server it was led for (and the lease the pref marks of that pick); any other seating asks the rotation. */
const pickOf = (p: Policy, w: World, now: number, ts: Ent<'table'>[], req: SeatReq, who?: Pty): Pick =>
  (ts.length && ts.every(t => t.table.status === 'leased') && ts[0].table.waiter ? {staff: ts[0].table.waiter, fallback: false, ...marked(who?.lease)} : serverOf(p, w, now, ts.map(t => t.id), who?.id, req.size))
interface B {p: Policy; w: World; now: number; req: SeatReq; who?: Pty; ts: Ent<'table'>[]; pk: Pick; num: number; pid: Id; label: string}
const brief = (p: Policy, w: World, now: number, req: SeatReq, who: Pty | undefined, ts: Ent<'table'>[]): B => {
  const num = who?.party.num ?? nextNum(w)
  return {p, w, now, req, who, ts, num, pk: pickOf(p, w, now, ts, req, who), pid: who?.id ?? `pty${num}`, label: who?.party.label ?? partyLabel(req.prefix ?? '', req.kind, num)}
}
const tables = (b: B): Patch[] => b.ts.map(t => set(t.id, {table: {...t.table, status: 'occupied', waiter: b.pk.staff}}))
/** Seating several tables that no link group covers pushes them together: a `merged` link, dissolved when they clear. */
const linked = (b: B): Patch[] => {
  const ids = b.ts.map(t => t.id)
  return ids.length > 1 && !having(b.w, 'link').some(l => l.link.members.some(m => ids.includes(m))) ? [add({id: `link-${ids.join('+')}`, link: {members: ids, merged: true}})] : []
}
const slot = (b: B): Patch => add({id: `slot-${b.num}-${b.now}`, slot: {table: b.ts[0].id, party: b.pid, seatedAt: b.now, turnAt: b.now + (b.req.durationMin ?? b.who?.reservation?.durationMin ?? b.p.seat.turnDefault) * MIN, status: 'ACTIVE', ...(b.pk.prefs ? {prefs: b.pk.prefs} : {})}})
const staff = (b: B): Patch[] => having(b.w, 'staff').filter(s => s.id === b.pk.staff || s.staff.skip).map(s => set(s.id, {staff: {...s.staff, skip: 0, ...(s.id === b.pk.staff ? {tally: s.staff.tally + b.req.size, lastSeatedAt: b.now} : {})}}))
const fresh = (b: B): Patch => add({id: b.pid, party: {num: b.num, label: b.label, prefix: b.req.prefix ?? '', kind: b.req.kind, name: b.label, size: b.req.size, here: b.req.size}})
const known = (e: Pty): Patch => set(e.id, {party: {...e.party, here: e.party.here || e.party.size}, ...(e.queue && {queue: {...e.queue, status: 'SEATED' as const}}), ...(e.reservation && {reservation: {...e.reservation, status: 'SEATED' as const}})})
const party = (b: B): Patch => (b.who ? known(b.who) : fresh(b))
/** A guest with a body walks to `to`, then takes `then` (a lease walks it to its table, a release back to the door). */
export const walk = (who: Pty | undefined, to: {x: number; y: number}, then: Task[]): Patch[] => (who?.body ? [set(who.id, {body: {...who.body, task: {do: 'move', ...to}, backlog: then}})] : [])
/** A seated guest walks to the table and then awaits service: the stand, the runner and the sim host share this one path. */
const body = (b: B): Patch[] => walk(b.who, center(b.w, b.ts[0].id), [{do: 'serve', table: b.ts[0].id}])
const msg = (b: B) => `${b.label} → ${b.ts.map(t => t.table.label).join('+')} · ${b.w.ents[b.pk.staff ?? '']?.staff?.name ?? 'no server'}${b.pk.fallback ? ' (fallback server)' : ''}`
/** Seat the party on validated tables: tables occupied + server, slot, server tally, queue/reservation consumed (v1 seatParty). */
export const book = (p: Policy, w: World, now: number, req: SeatReq, who: Pty | undefined, ts: Ent<'table'>[]): Decision => {
  const b = brief(p, w, now, req, who, ts)
  return {ok: true, patches: [...tables(b), ...linked(b), slot(b), ...staff(b), party(b), ...body(b)], msg: msg(b), tone: b.pk.fallback ? 'warn' : 'ok'}
}
