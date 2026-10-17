// Desk read model (wave 4): everything the host stand shows, derived from the world (E2). The stand renders this; it computes nothing itself.
import {having, partsOf} from '../contracts/index.ts'
import type {Desk, DoorRow, Ent, Entity, Id, LeaseRow, Offer, Policy, ReqRow, Rung, SeatedRow, World} from '../contracts/index.ts'
import type {Pty} from './ents.ts'
import {line} from './queue.ts'
import {where} from './ask.ts'
import {known} from './match.ts'
import {ladder} from './ladder.ts'
import {serverFor, rotate} from './rotate.ts'
import {holdsOn, modeAt} from './modes.ts'
import {outlook} from './plan.ts'
import {options} from './options.ts'
import {areaOf} from './section.ts'
import {concern} from './lease.ts'
import type {Leased} from './lease.ts'
import {order} from './bookrank.ts'
import {MIN} from './time.ts'
const since = (e: Pty) => e.queue?.since ?? e.reservation?.at ?? 0
const row = (now: number) => (e: Pty): DoorRow =>
  ({party: e.id, label: e.party.label, name: e.party.name, size: e.party.size, kind: e.party.kind, waitedMin: Math.max(0, Math.floor((now - since(e)) / MIN))})
/** The door in the booking desk's priority order (policy.book points, waited), minus parties the host already placed (leased or seated). */
export const door = (p: Policy, w: World, now: number): DoorRow[] => ((rank = order(p, w, now).map(r => r.party)) => line(p, w).filter(e => !where(w, e.id)).map(row(now)).sort((a, b) => (rank.indexOf(a.party) + 1 || 1e9) - (rank.indexOf(b.party) + 1 || 1e9)))()
/** Party size -> the first door party of that size (what a size-only fast seat from the door takes). */
export const bySize = (rows: DoorRow[]): Record<number, Id> => Object.fromEntries([...rows].reverse().map(r => [r.size, r.party]))
/** Recorded wants (said or heard), feats asked about with no want, feats still to ask. */
const intakeOf = (p: Policy, e?: Entity) => {
  const wants = e ? known(e) : []
  const heard = e?.wants?.heard ?? []
  const has = (f: string) => wants.some(x => x.feat === f)
  return {wants, denied: heard.filter(f => !has(f)), unasked: e ? Object.keys(p.host.feats).filter(f => !has(f) && !heard.includes(f)) : []}
}
/** Ladder rungs (declined spots already left out by the ladder), each with who would serve it and what server prefs did to that pick; spot-bearing rungs first. */
const served = (p: Policy, w: World, now: number, id: Id) => (r: Rung): Offer => { const k = r.spot ? serverFor(p, w, now, partsOf(w, r.spot), id) : undefined; return {...r, server: k?.staff ?? null, prefs: k?.prefs ?? []} }
const offers = (p: Policy, w: World, now: number, id: Id): Offer[] =>
  ladder(p, w, now, id).map(served(p, w, now, id))
    .sort((a, b) => Number(!a.spot) - Number(!b.spot))
const turns: Record<'true' | 'false', (p: Policy, w: World, now: number) => Id[]> = {true: () => [], false: (p, w, now) => rotate(p, w, now).map(r => r.staff).filter(id => !w.ents[id]?.staff?.area)} // bar staff take no floor turns
const requests = (p: Policy, w: World, now: number): ReqRow[] => having(w, 'party', 'request').filter(e => e.request.status === 'open')
  .map(e => ({party: e.id, table: e.request.table, reason: e.request.reason, stage: e.request.stage, options: options(p, w, now, e.id)}))
/** Every lease, soonest to settle first; `concern` = the party raised a table-change request meanwhile (the lease waits for the host). */
const leaseRow = (e: Leased): LeaseRow => ({party: e.id, spot: e.lease.spot, tables: e.lease.tables, at: e.lease.at, until: e.lease.until, concern: concern(e)})
const leased = (w: World): LeaseRow[] => (having(w, 'party', 'lease') as Leased[]).map(leaseRow).sort((a, b) => a.until - b.until)
const ORDER: Record<SeatedRow['aware'], number> = {pending: 0, told: 1, seen: 2}
const aware = (p: Policy, w: World, s: Ent<'slot'>): SeatedRow['aware'] => (p.service.areas[areaOf(w.ents[s.slot.table])]?.seen ? 'seen' : s.slot.told ? 'told' : 'pending')
const seatedRow = (p: Policy, w: World) => (s: Ent<'slot'>): SeatedRow =>
  ({party: s.slot.party, table: s.slot.table, area: areaOf(w.ents[s.slot.table]), server: w.ents[s.slot.table]?.table?.waiter ?? null, aware: aware(p, w, s)})
const seated = (p: Policy, w: World): SeatedRow[] => having(w, 'slot').filter(s => s.slot.status === 'ACTIVE').map(seatedRow(p, w)).sort((a, b) => ORDER[a.aware] - ORDER[b.aware])
/** The host stand's view model: `focus` = the given party while it is still at the door, else the next one. */
export const stand: Desk['stand'] = (p, w, now, focus) => {
  const at = door(p, w, now)
  const f = (at.find(r => r.party === focus) ?? at[0])?.party ?? null
  const rest = {rotation: turns[String(holdsOn(p, w, now)) as 'true'](p, w, now), mode: modeAt(p, w, now), outlook: outlook(p, w, now), requests: requests(p, w, now), leased: leased(w), seated: seated(p, w)}
  return {door: at, bySize: bySize(at), focus: f, ...intakeOf(p, w.ents[f ?? '']), offers: f ? offers(p, w, now, f) : [], ...rest}
}
