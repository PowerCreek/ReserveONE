// Merge candidates: adjacent free tables pushed together are a spot with summed capacity (policy.merge, `adj` venue data). Pairs only (C9).
import {having, mergeId} from '../contracts/index.ts'
import type {Ent, Entity, World} from '../contracts/index.ts'
import {spot} from './spots.ts'
type T = Ent<'table'>
const grouped = (w: World) => new Set(having(w, 'link').flatMap(l => l.link.members))
const free = (g: Set<string>) => (t: T) => t.table.status === 'available' && !g.has(t.id)
const next = (w: World, t: T) => (w.ents[t.id]?.adj?.with ?? []).map(i => w.ents[i]).filter((n): n is T => !!n?.table)
const floor = (t: T) => (t as Entity).pos?.floor ?? ''
const same = (a: T, b: T) => floor(a) === floor(b)
/** Every adjacent pair of free, ungrouped tables on one floor, once each (sorted ids): the spot a host could push together. */
export const merges = (w: World): Ent<'spot'>[] => {
  const ok = free(grouped(w))
  const pairs = having(w, 'table').filter(ok).flatMap(a => next(w, a).filter(b => ok(b) && same(a, b)).map(b => [a, b].sort((x, y) => x.id.localeCompare(y.id))))
  const once = new Map(pairs.map(([a, b]) => [mergeId([a.id, b.id]), {id: mergeId([a.id, b.id]), ts: [a, b]}]))
  return [...once.values()].map(spot)
}
