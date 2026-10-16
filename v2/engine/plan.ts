// Temporal plan (E1): where each upcoming reservation will sit, given when the tables now occupied turn over. A table counts as free for a reservation if its party will have left by then
// (so a merged group already seated, and the open table beside it, can be pushed together for a later party), and a walk-in seated now is assumed gone after an average turn. Reservations are placed in
// time order, each on the tightest spot (a table, else tables pushed together) free by its time; the centre lane goes last, tables that merge nowhere else are kept for small parties.
import {having} from '../contracts/index.ts'
import type {Ent, Engine, Id, Placed, Policy, World} from '../contracts/index.ts'
import {spots} from './spots.ts'
import {mergesOf} from './merge.ts'
import {avgTurn, tableFreeAt} from './avail.ts'
import {clear, holds} from './reserved.ts'
import {selfSeated} from './seatcheck.ts'
import {MIN} from './time.ts'
type Spot = Ent<'spot'>
type Res = Ent<'party' | 'reservation'>
type Acc = {busy: Record<Id, number>; out: Placed[]}
interface Ctx {p: Policy; w: World; now: number; pool: Spot[]; free: (id: Id) => number; reach: Record<Id, number>; hs: ReturnType<typeof holds>}
const live = (p: Policy, now: number) => (e: Res) => e.reservation.status === 'ARRIVED' || (e.reservation.status === 'BOOKED' && now - e.reservation.at <= p.seat.lateGraceMin * MIN)
/** Reservations with no table of their own due within policy.plan.horizonMin, in time order (`skip` = the party being seated). */
export const due = (p: Policy, w: World, now: number, skip?: Id): Res[] =>
  having(w, 'party', 'reservation').filter(e => e.id !== skip && e.reservation.table === null && live(p, now)(e) && e.reservation.at <= now + p.plan.horizonMin * MIN)
    .sort((a, b) => a.reservation.at - b.reservation.at || b.party.size - a.party.size || (a.id < b.id ? -1 : 1))
const reaches = (ms: Spot[]) => ms.flatMap(s => s.spot.tables).reduce<Record<Id, number>>((m, t) => ({...m, [t]: (m[t] ?? 0) + 1}), {})
const ctx = (p: Policy, w: World, now: number, rs: Res[]): Ctx => {
  const at = tableFreeAt(p, w, now)
  const last = rs.length ? Math.max(...rs.map(r => r.reservation.at)) : now
  const standing = new Set(having(w, 'link').filter(l => !l.link.merged).flatMap(l => l.link.members))
  const usable = (t: Ent<'table'>) => t.table.status !== 'blocked_private' && !standing.has(t.id) && !selfSeated(p, t) && at(t) <= last + p.plan.slackMin * MIN
  const merged = rs.length ? mergesOf(p, w, usable) : []
  const singles = spots(w).filter(s => s.spot.status !== 'blocked_private' && !s.spot.tables.some(t => selfSeated(p, w.ents[t]!)))
  const free = (id: Id) => (w.ents[id]?.table ? at(w.ents[id] as Ent<'table'>) : Infinity)
  return {p, w, now, pool: [...singles, ...merged], free, reach: reaches(merged), hs: holds(p, w, now)}
}
const ready = (c: Ctx, busy: Acc['busy'], r: Res) => (s: Spot) => {
  const from = Math.max(...s.spot.tables.map(t => Math.max(c.free(t), busy[t] ?? 0)))
  return clear(c.hs, s.spot.tables, from, r.reservation.durationMin * MIN, c.p.seat.resetMin * MIN)
}
const tight = (c: Ctx) => (a: Spot, b: Spot) =>
  +!!a.spot.last - +!!b.spot.last || a.spot.capacity - b.spot.capacity || a.spot.tables.length - b.spot.tables.length ||
  a.spot.tables.reduce((n, t) => n + (c.reach[t] ?? 0), 0) - b.spot.tables.reduce((n, t) => n + (c.reach[t] ?? 0), 0) || (a.id < b.id ? -1 : 1)
const place = (c: Ctx) => (a: Acc, r: Res): Acc => {
  const free = ready(c, a.busy, r)
  const pick = c.pool.filter(s => s.spot.capacity >= r.party.size && free(s) <= r.reservation.at + c.p.plan.slackMin * MIN).sort(tight(c))[0]
  const item = (s?: Spot): Placed => ({party: r.id, size: r.party.size, at: r.reservation.at, spot: s?.id ?? null, tables: s?.spot.tables ?? [], label: s?.spot.label ?? '-', free: s ? free(s) : Infinity, merge: (s?.spot.tables.length ?? 0) > 1})
  const gone = r.reservation.at + r.reservation.durationMin * MIN
  return {busy: {...a.busy, ...Object.fromEntries((pick?.spot.tables ?? []).map(t => [t, gone]))}, out: [...a.out, item(pick)]}
}
/** A planner over the world as it stands: `run(busy)` places every due reservation; `busy` = tables already promised until the given time (a walk-in about to be seated). Built once, run per candidate. */
export const planner = (p: Policy, w: World, now: number, skip?: Id) => {
  const rs = due(p, w, now, skip)
  const c = ctx(p, w, now, rs)
  return {empty: rs.length === 0, run: (busy: Record<Id, number> = {}): Placed[] => rs.reduce(place(c), {busy, out: []} as Acc).out}
}
export const planned = (p: Policy, w: World, now: number, skip?: Id, busy: Record<Id, number> = {}): Placed[] => planner(p, w, now, skip).run(busy)
export const outlook: Engine['outlook'] = (p, w, now) => planned(p, w, now)
/** How long a party seated now is expected to stay (plus reset): the time its tables are busy. */
export const stay = (p: Policy, w: World) => (avgTurn(p, w) + p.seat.resetMin) * MIN
