// Seating strategy context (lane E-S, E1): everything the strategy reads, built once per call from the existing engine pieces (the temporal plan, the keeper, table free times).
import {having, partsOf} from '../contracts/index.ts'
import type {Ent, Id, Policy, World} from '../contracts/index.ts'
import type {StratCtl, StratHold} from '../contracts/strategy.ts'
import {saved} from './held.ts'
import {planned, stay} from './plan.ts'
import {keeper} from './keep.ts'
import {tableFreeAt} from './avail.ts'
import {selfSeated} from './seatcheck.ts'
import {MIN} from './time.ts'
export type Tbl = Ent<'table'>
/** A reservation the floor expects: placed by the planner (no table of its own) or booked on its table. `end` = when it leaves. */
export interface Due {party: Id; size: number; at: number; end: number; tables: Id[]}
export interface SCtx {p: Policy; w: World; now: number; ctl: StratCtl; ts: Tbl[]; free: (id: Id) => number; stay: number; res: Due[]; unplaced: Due[]; keep: (taken: Id[]) => Id[]; holds: StratHold[]}
/** Engine-local weights (would-be `policy.strategy`): a joint placement's cost of a party left without a table and of a squeezed reservation, in minutes of wait; the most pairs listed. */
export const W = {miss: 1000, squeeze: 60, pairs: 12}
const natural = (a: Tbl, b: Tbl) => a.table.label.localeCompare(b.table.label, undefined, {numeric: true}) || a.id.localeCompare(b.id)
/** Minutes from now (0 when past). */
export const mins = (c: SCtx, at: number) => Math.max(0, Math.round((at - c.now) / MIN))
export const labelOf = (c: SCtx, id: Id) => c.w.ents[id]?.party?.label ?? c.w.ents[id]?.table?.label ?? id
type R = Ent<'party' | 'reservation'>
const LIVE: Record<string, (r: R, now: number, grace: number) => boolean> = {BOOKED: (r, now, grace) => now - r.reservation.at <= grace * MIN, ARRIVED: () => true}
const dueOf = (w: World) => (e: R, tables: Id[]): Due => ({party: e.id, size: e.party.size, at: e.reservation.at, end: e.reservation.at + e.reservation.durationMin * MIN, tables})
const booked = (p: Policy, w: World, now: number): Due[] =>
  having(w, 'party', 'reservation').filter(e => e.reservation.table !== null && (LIVE[e.reservation.status] ?? (() => false))(e, now, p.seat.lateGraceMin)).map(e => dueOf(w)(e, partsOf(w, e.reservation.table!)))
const fromPlan = (p: Policy, w: World, now: number) => planned(p, w, now).map(x => dueOf(w)(w.ents[x.party] as R, x.tables))
/** The world's saved holds are the truth; a draft with the same id is ignored. */
const drafts = (hs: StratHold[], ds: StratHold[]) => [...hs, ...ds.filter(d => !hs.some(h => h.id === d.id))]
export const ctxOf = (p: Policy, w: World, now: number, ctl: StratCtl): SCtx => {
  const at = tableFreeAt(p, w, now)
  const ts = having(w, 'table').filter(t => t.table.status !== 'blocked_private' && !selfSeated(p, t)).sort(natural)
  const fa = new Map(ts.map(t => [t.id, at(t)]))
  const plan = fromPlan(p, w, now)
  const res = [...plan.filter(x => x.tables.length), ...booked(p, w, now)].sort((a, b) => a.at - b.at)
  return {p, w, now, ctl, ts, free: id => fa.get(id) ?? Infinity, stay: stay(p, w), res, unplaced: plan.filter(x => !x.tables.length), keep: keeper(p, w, now), holds: drafts(saved(w), ctl.holds)}
}
