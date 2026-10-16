import {having} from '../contracts/index.ts'
import type {Decision, Ent, Id, Patch, Pick, Policy, SeatReq, World} from '../contracts/index.ts'
import {center, nextNum, partyLabel} from './ents.ts'
import type {Pty} from './ents.ts'
import {MIN} from './time.ts'
import {add, set} from './patch.ts'
import {serverFor} from './rotate.ts'
interface B {p: Policy; w: World; now: number; req: SeatReq; who?: Pty; ts: Ent<'table'>[]; pk: Pick; num: number; pid: Id; label: string}
const brief = (p: Policy, w: World, now: number, req: SeatReq, who: Pty | undefined, ts: Ent<'table'>[]): B => {
  const num = who?.party.num ?? nextNum(w)
  return {p, w, now, req, who, ts, num, pk: serverFor(p, w, now, ts.map(t => t.id)), pid: who?.id ?? `pty${num}`, label: who?.party.label ?? partyLabel(req.prefix ?? '', req.kind, num)}
}
const tables = (b: B): Patch[] => b.ts.map(t => set(t.id, {table: {...t.table, status: 'occupied', waiter: b.pk.staff}}))
const slot = (b: B): Patch => add({id: `slot-${b.num}-${b.now}`, slot: {table: b.ts[0].id, party: b.pid, seatedAt: b.now, turnAt: b.now + (b.req.durationMin ?? b.who?.reservation?.durationMin ?? b.p.seat.turnDefault) * MIN, status: 'ACTIVE'}})
const staff = (b: B): Patch[] => having(b.w, 'staff').filter(s => s.id === b.pk.staff || s.staff.skip).map(s => set(s.id, {staff: {...s.staff, skip: 0, ...(s.id === b.pk.staff ? {tally: s.staff.tally + b.req.size, lastSeatedAt: b.now} : {})}}))
const fresh = (b: B): Patch => add({id: b.pid, party: {num: b.num, label: b.label, prefix: b.req.prefix ?? '', kind: b.req.kind, name: b.label, size: b.req.size, here: b.req.size}})
const known = (e: Pty): Patch => set(e.id, {party: {...e.party, here: e.party.here || e.party.size}, ...(e.queue && {queue: {...e.queue, status: 'SEATED' as const}}), ...(e.reservation && {reservation: {...e.reservation, status: 'SEATED' as const}})})
const party = (b: B): Patch => (b.who ? known(b.who) : fresh(b))
/** A guest with a body walks to the table and then awaits service: the stand, the runner and the sim host share this one path. */
const body = (b: B): Patch[] => (b.who?.body ? [set(b.pid, {body: {...b.who.body, task: {do: 'move', ...center(b.w, b.ts[0].id)}, backlog: [{do: 'serve', table: b.ts[0].id}]}})] : [])
const msg = (b: B) => `${b.label} → ${b.ts.map(t => t.table.label).join('+')} · ${b.w.ents[b.pk.staff ?? '']?.staff?.name ?? 'no server'}${b.pk.fallback ? ' (fallback server)' : ''}`
/** Seat the party on validated tables: tables occupied + server, slot, server tally, queue/reservation consumed (v1 seatParty). */
export const book = (p: Policy, w: World, now: number, req: SeatReq, who: Pty | undefined, ts: Ent<'table'>[]): Decision => {
  const b = brief(p, w, now, req, who, ts)
  return {ok: true, patches: [...tables(b), slot(b), ...staff(b), party(b), ...body(b)], msg: msg(b), tone: b.pk.fallback ? 'warn' : 'ok'}
}
