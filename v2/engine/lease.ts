// Leasing (wave 6, DOMAIN "lease"): the host leads a party to a spot and its tables are held for it ('leased': out of every offer and plan) while it settles.
// At `until` (policy.host.clock.leaseMin) the lease becomes a seating, unless the party raised a concern (a table-change request still open): then it waits for the host.
import {having, partsOf} from '../contracts/index.ts'
import type {Components, Decision, Ent, HostEvent, Id, Patch, Policy, SimEvent, TStatus, World} from '../contracts/index.ts'
import {center, hostOf, isTable} from './ents.ts'
import type {Lease, Pty} from './ents.ts'
import {expand} from './spots.ts'
import {serverOf} from './rotate.ts'
import {seat} from './seat.ts'
import {walk} from './book.ts'
import {add, apply, del, set} from './patch.ts'
import {MIN} from './time.ts'
type T = Ent<'table'>
export type Leased = Pty & {lease: Components['lease']}
/** The tables a spot stands for, whole link groups included. */
const tablesIn = (w: World, ids: Id[]): T[] => ids.map(i => w.ents[i]).filter(isTable)
export const tablesOf = (w: World, spot: Id): T[] => tablesIn(w, expand(w, partsOf(w, spot)))
/** Tables to a status, with the server recorded on them (null once they come free). */
const mark = (ts: T[], status: TStatus, waiter: Id | null): Patch[] => ts.map(t => set(t.id, {table: {...t.table, status, waiter}}))
/** A concern = a table-change request the host has not settled yet: the lease does not settle by itself meanwhile. */
export const concern = (e: Pty) => ['open', 'offered'].includes(e.request?.status ?? '')
/** Lease the spot to the party: its tables leased with the server who would serve them, the party's lease, its guest walking there. */
export const hold = (p: Policy, w: World, now: number, who: Pty, spot: Id, step: string): Patch[] => {
  const ts = tablesOf(w, spot)
  const pk = serverOf(p, w, now, ts.map(t => t.id), who.id)
  const lease: Lease = {spot, tables: ts.map(t => t.id), at: now, until: now + p.host.clock.leaseMin * MIN, step, ...(pk.prefs ? {prefs: pk.prefs} : {})}
  return [...mark(ts, 'leased', pk.staff), set(who.id, {lease}), ...walk(who, center(w, ts[0]?.id ?? spot), [])]
}
/** Move a lease to another spot (an arrived-stage swap): the old tables free, the new ones leased with the same server, the guest walks over. */
export const shift = (w: World, e: Leased, to: Ent<'spot'>): Patch[] => {
  const ts = tablesIn(w, to.spot.tables)
  const waiter = w.ents[e.lease.tables[0] ?? '']?.table?.waiter ?? null
  return [...mark(tablesIn(w, e.lease.tables), 'available', null), ...mark(ts, 'leased', waiter), set(e.id, {lease: {...e.lease, spot: to.id, tables: ts.map(t => t.id)}}), ...walk(e, center(w, ts[0]?.id ?? to.id), [])]
}
/** The party without its lease (del + add of the stripped entity, CONTEXT convention), `over` = components changed at once. */
const unlease = (e: Pty, over: Partial<Components> = {}): Patch[] => [del(e.id), add({...Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'lease')), ...over} as Pty)]
/** Hand a lease back: its tables free, the party back at the door (walking there) with `over` (the declined offer). */
export const unhold = (p: Policy, w: World, e: Leased, over: Partial<Components>): Patch[] =>
  [...mark(tablesIn(w, e.lease.tables).filter(t => t.table.status === 'leased'), 'available', null), ...unlease(e, over), ...walk(e, center(w, 'door', p), [])]
/** Seat a leased party on its leased tables (seatcheck accepts tables leased to it): the seating, and the lease gone. */
export const confirm = (p: Policy, w: World, now: number, e: Leased): Decision => {
  const d = seat(p, w, now, {size: e.party.size, kind: e.party.kind, party: e.id, tables: e.lease.tables})
  return d.ok ? {...d, patches: [...unlease(e), ...d.patches]} : d
}
interface Acc {w: World; patches: Patch[]; events: (HostEvent | SimEvent)[]}
const due = (w: World, now: number) => (having(w, 'party', 'lease') as Leased[]).filter(e => e.lease.until <= now && !concern(e))
const settleOne = (p: Policy, now: number) => (a: Acc, e: Leased): Acc => {
  const d = confirm(p, a.w, now, a.w.ents[e.id] as Leased)
  const ps = d.ok ? d.patches : []
  const seated: SimEvent[] = d.ok ? [{ev: 'seated', party: e.id, table: e.lease.tables[0], by: hostOf(a.w)}] : []
  return {w: apply(a.w, ps), patches: [...a.patches, ...ps], events: [...a.events, ...seated]}
}
/** Leases past `until` with no concern open become seatings (by the host who led them), one after another so each sees the last. */
export const settleLeases = (p: Policy, w: World, now: number) => {
  const r = due(w, now).reduce(settleOne(p, now), {w, patches: [], events: []})
  return {patches: r.patches, events: r.events}
}
