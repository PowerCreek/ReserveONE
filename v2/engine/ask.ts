// Host service: a led party raises a re-seat reason (DOMAIN: re-seat requests). Pure, policy-driven (E1).
import type {Coach, Ent, HostEvent, Id, Policy, Stage, World} from '../contracts/index.ts'
import type {ReasonDef} from '../contracts/index.ts'
import {partyOf, slotOf} from './ents.ts'
import {isMerge, partsOf} from '../contracts/index.ts'
import {spot, spots} from './spots.ts'
import {merges} from './merge.ts'
import {set} from './patch.ts'
export interface Seat {table: Id; stage: Stage}
/** A party's current spot as a spot entity: `id` may name a table, a link group or a free merge. */
/** A merge id no longer free (its tables leased or seated) still names its tables. */
const pushed = (w: World, id: Id) => (isMerge(id) && partsOf(w, id).every(t => w.ents[t]?.table) ? spot({id, ts: partsOf(w, id).map(t => w.ents[t] as Ent<'table'>)}) : undefined)
export const spotOf = (p: Policy, w: World, id: Id) => spots(w).find(s => s.id === id || s.spot.tables.includes(id)) ?? merges(p, w).find(s => s.id === id) ?? pushed(w, id)
const seated = (w: World, id: Id): Seat | undefined => {
  const s = slotOf(w, id)
  return s?.slot.status === 'ACTIVE' ? {table: s.slot.table, stage: 'seated'} : undefined
}
const leased = (w: World, id: Id): Seat | undefined => {
  const l = w.ents[id]?.lease
  return l ? {table: l.spot, stage: 'arrived'} : undefined
}
/** Where a led party is: an ACTIVE slot = seated; else a lease = arrived (led, not seated); else not led. */
export const where = (w: World, id: Id): Seat | undefined => seated(w, id) ?? leased(w, id)
interface Q {reason: string; def?: ReasonDef; known: boolean; at?: Seat; open: boolean}
const rules: [(q: Q) => boolean, (q: Q) => string][] = [
  [q => !q.known, () => 'no such party'],
  [q => !q.def, q => `unknown reason ${q.reason}`],
  [q => !q.at, () => 'party has not been led to a table'],
  [q => !q.def?.stages.includes(q.at?.stage as Stage), q => `${q.reason} cannot be raised once ${q.at?.stage}`],
  [q => q.open, () => 'party is already waiting for an answer'],
]
/** Raise a re-seat request: only after the party was led (stage arrived|seated), only for a reason whose stages allow it, one open request at a time. */
export const ask: Coach['ask'] = (p, w, now, party, reason) => {
  const at = where(w, party)
  const q: Q = {reason, def: p.host.reasons[reason], known: !!partyOf(w, party), at, open: w.ents[party]?.request?.status === 'open'}
  const err = rules.find(([bad]) => bad(q))?.[1](q)
  const request = at && {reason, stage: at.stage, table: at.table, at: now, status: 'open' as const, spot: null}
  return err || !request ? {ok: false, err: err ?? 'party has not been led to a table'} : {ok: true, patches: [set(party, {request})], msg: q.def?.says ?? '', tone: 'warn'}
}
/** The `asked` HostEvent for a party's current request (Decision carries no events; the caller emits this beside the patches). */
export const askedEvent = (w: World, party: Id): HostEvent[] => {
  const r = w.ents[party]?.request
  return r ? [{ev: 'asked', party, reason: r.reason, stage: r.stage}] : []
}
