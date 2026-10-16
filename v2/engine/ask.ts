// Host service: a led party raises a re-seat reason (DOMAIN: re-seat requests). Pure, policy-driven (E1).
import type {Coach, Entity, HostEvent, Id, Stage, World} from '../contracts/index.ts'
import type {ReasonDef} from '../contracts/index.ts'
import {partyOf, slotOf} from './ents.ts'
import {spots} from './spots.ts'
import {merges} from './merge.ts'
import {set} from './patch.ts'
export interface Seat {table: Id; stage: Stage}
/** A party's current spot as a spot entity: `id` may name a table, a link group or a free merge. */
export const spotOf = (w: World, id: Id) => spots(w).find(s => s.id === id || s.spot.tables.includes(id)) ?? merges(w).find(s => s.id === id)
const seated = (w: World, id: Id): Seat | undefined => {
  const s = slotOf(w, id)
  return s?.slot.status === 'ACTIVE' ? {table: s.slot.table, stage: 'seated'} : undefined
}
const arrived = (w: World, id: Id): Seat | undefined => {
  const e: Entity | undefined = w.ents[id]
  const table = e?.offer?.status === 'accepted' ? e.offer.spot : undefined
  return table ? {table, stage: 'arrived'} : undefined
}
/** Where a led party is: an ACTIVE slot = seated; else an accepted offer on a table = arrived (led, not seated; CONTEXT convention); else not led. */
export const where = (w: World, id: Id): Seat | undefined => seated(w, id) ?? arrived(w, id)
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
