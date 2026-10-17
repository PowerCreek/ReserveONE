// Lanes and pairs (lane E-S): each table's expected future (free time, next reservation, the run it links into) and the turn patterns (tables freeing about together that can be pushed together).
import {having} from '../contracts/index.ts'
import type {Ent, Id} from '../contracts/index.ts'
import type {Lane, Pair} from '../contracts/strategy.ts'
import {mergesOf} from './merge.ts'
import {MIN} from './time.ts'
import {W, labelOf, mins} from './strategy-ctx.ts'
import type {Due, SCtx, Tbl} from './strategy-ctx.ts'
const seatedOn = (c: SCtx) => having(c.w, 'slot').filter(s => s.slot.status === 'ACTIVE').reduce<Record<Id, number>>((m, s) => ({...m, [s.slot.table]: (m[s.slot.table] ?? 0) + (c.w.ents[s.slot.party]?.party?.size ?? 0)}), {})
const grow = (c: SCtx) => (set: Id[]) => [...new Set([...set, ...set.flatMap(i => c.w.ents[i]?.adj?.with ?? [])])]
/** Tables within `policy.merge.max - 1` hops on the venue's adjacency, in label order (itself left out). */
const runOf = (c: SCtx) => (id: Id) => ((set: Id[]) => c.ts.filter(t => t.id !== id && set.includes(t.id)).map(t => t.id))(Array.from({length: c.p.merge.max - 1}).reduce<Id[]>(grow(c), [id]))
const nextOf = (c: SCtx, id: Id): Lane['next'] => ((r?: Due) => (r ? {party: r.party, label: labelOf(c, r.party), size: r.size, at: mins(c, r.at)} : null))(c.res.find(r => r.tables.includes(id) && r.end > c.now))
const lane = (c: SCtx, seated: Record<Id, number>) => (t: Tbl): Lane =>
  ({table: t.id, label: t.table.label, freeIn: mins(c, c.free(t.id)), seated: seated[t.id] ?? 0, next: nextOf(c, t.id), run: runOf(c)(t.id), section: t.table.section})
export const lanesOf = (c: SCtx): Lane[] => c.ts.map(lane(c, seatedOn(c)))
// ---- pairs
type Spot = Ent<'spot'>
const standing = (c: SCtx) => new Set(having(c.w, 'link').filter(l => !l.link.merged).flatMap(l => l.link.members))
const atOf = (c: SCtx, s: Spot) => Math.max(...s.spot.tables.map(c.free))
/** The reservation that needs any of these tables while a party linked there at `at` would stay. */
const clash = (c: SCtx, s: Spot, at: number) => c.res.find(r => r.tables.some(t => s.spot.tables.includes(t)) && r.at < at + c.stay && r.end + c.p.seat.resetMin * MIN > at)
const same = (a: Id[], b: Id[]) => a.length === b.length && a.every(t => b.includes(t))
const turning = (c: SCtx, s: Spot) => s.spot.tables.some(t => c.free(t) > c.now)
const text = (c: SCtx, s: Spot, at: number, r?: Due) =>
  r ? `planned for ${labelOf(c, r.party)} (${r.size}) in ${mins(c, r.at)}m` : `${s.spot.tables.filter(t => c.free(t) < at).map(t => labelOf(c, t)).join('+')} open, ${s.spot.tables.filter(t => c.free(t) >= at).map(t => labelOf(c, t)).join('+')} turns in ${mins(c, at)}m`
const pairOf = (c: SCtx) => (s: Spot): Pair[] => {
  const at = atOf(c, s)
  const r = clash(c, s, at)
  const ok = turning(c, s) && at <= c.now + c.p.plan.horizonMin * MIN && (!r || same(r.tables, s.spot.tables))
  return ok ? [{tables: s.spot.tables, labels: s.spot.tables.map(t => labelOf(c, t)), size: s.spot.capacity, at: mins(c, at), why: text(c, s, at, r)}] : []
}
/** Turn patterns: sets of adjacent tables, one still turning, that come free together within the horizon without taking a reservation's tables (unless the plan links them for it). */
export const pairsOf = (c: SCtx): Pair[] => {
  const keep = standing(c)
  const sets = mergesOf(c.p, c.w, t => c.ts.some(x => x.id === t.id) && !keep.has(t.id))
  return sets.flatMap(pairOf(c)).sort((a, b) => a.at - b.at || a.tables.length - b.tables.length || a.size - b.size).slice(0, W.pairs)
}
