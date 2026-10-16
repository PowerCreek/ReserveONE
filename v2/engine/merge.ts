// Merge candidates: free tables pushed together are a spot with summed capacity. Which tables touch is venue data (`adj`); a candidate is any connected set of 2..policy.merge.max free, ungrouped tables.
import {having, mergeId} from '../contracts/index.ts'
import type {Ent, Entity, Policy, World} from '../contracts/index.ts'
import {spot} from './spots.ts'
type T = Ent<'table'>
const grouped = (w: World) => new Set(having(w, 'link').flatMap(l => l.link.members))
const free = (g: Set<string>) => (t: T) => t.table.status === 'available' && !g.has(t.id)
const floor = (t: T) => (t as Entity).pos?.floor ?? ''
const touching = (w: World, ok: (t: T) => boolean) => (set: T[]): T[] =>
  set.flatMap(t => (w.ents[t.id]?.adj?.with ?? []).map(i => w.ents[i])).filter((n): n is T => !!n?.table)
    .filter(n => ok(n) && floor(n) === floor(set[0]!) && !set.some(t => t.id === n.id))
/** A merge through any last-resort table (`adj.last`) is flagged. */
const marked = (w: World, s: Ent<'spot'>): Ent<'spot'> => (s.spot.tables.some(t => w.ents[t]?.adj?.last) ? {...s, spot: {...s.spot, last: true}} : s)
const once = (sets: T[][]) => [...new Map(sets.map(s => [mergeId(s.map(t => t.id)), s])).values()]
/** Each level grows every set by one touching table; sets are told apart by their sorted ids. */
const levels = (w: World, ok: (t: T) => boolean, max: number): T[][][] =>
  Array.from({length: max - 1}).reduce<T[][][]>(acc => [...acc, once(acc[acc.length - 1]!.flatMap(s => touching(w, ok)(s).map(n => [...s, n])))], [having(w, 'table').filter(ok).map(t => [t])])
/** Every set (2..policy.merge.max) of touching tables on one floor that pass `ok`, once each, ordered by id. */
export const mergesOf = (p: Policy, w: World, ok: (t: T) => boolean): Ent<'spot'>[] =>
  levels(w, ok, p.merge.max).slice(1).flat().map(ts => ({id: mergeId(ts.map(t => t.id)), ts: [...ts].sort((a, b) => a.id.localeCompare(b.id))})).map(g => marked(w, spot(g)))
/** The spots a host could push together now: free, ungrouped, touching tables. */
export const merges = (p: Policy, w: World): Ent<'spot'>[] => mergesOf(p, w, free(grouped(w)))
