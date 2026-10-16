// Sections as quadrants (E1): split the tables by position into k blocks of balanced covers (cover = capacity) by recursive bisection. Each cut is a straight line across the wider spread of the tables, so
// every block is a rectangle of the floor, blocks never interleave, and a server never reaches across another's. A cut may land anywhere inside the balance window (policy.section.tol of an even share) that keeps
// each side under policy.section.spread (no block takes every booth); inside it the widest gap wins (an aisle), then the smaller cover deviation, then the earlier table. Tables sharing a coordinate (one aisle) are
// never split by a cut across it. Ties break by id, so the result is repeatable.
import type {Entity, Id, Policy} from '../contracts/index.ts'
type Pt = {id: Id; x: number; y: number; cap: number; shape: string}
type Axis = 'x' | 'y'
type Cut = {at: number; gap: number; dev: number; fits: boolean}
type Most = Record<string, number>
const pt = (t: Entity): Pt => ({id: t.id, x: (t.pos?.x ?? 0) + (t.pos?.w ?? 0) / 2, y: (t.pos?.y ?? 0) + (t.pos?.h ?? 0) / 2, cap: t.table?.capacity ?? 0, shape: t.table?.shape ?? ''})
const sum = (ps: Pt[]) => ps.reduce((a, p) => a + p.cap, 0)
const span = (ps: Pt[], a: Axis) => Math.max(...ps.map(p => p[a])) - Math.min(...ps.map(p => p[a]))
const widest = (ps: Pt[]): Axis => (span(ps, 'y') > span(ps, 'x') ? 'y' : 'x')
const along = (a: Axis) => (p: Pt, q: Pt) => p[a] - q[a] || (p.id < q.id ? -1 : 1)
/** The most tables of each spread shape one block may hold. */
const limits = (p: Policy, ps: Pt[]): Most => Object.fromEntries(Object.entries(p.section.spread).map(([shape, share]) => [shape, Math.ceil(ps.filter(q => q.shape === shape).length * share)]))
const within = (most: Most, k: number) => (g: Pt[]) => Object.entries(most).every(([shape, n]) => g.filter(q => q.shape === shape).length <= n * k)
const better = (a: Cut, b: Cut) => b.gap - a.gap || a.dev - b.dev || a.at - b.at
const closest = (a: Cut, b: Cut) => a.dev - b.dev || a.at - b.at
/** The cut after `at` tables of `ps` (sorted along `a`): the gap it opens, how far the left covers stray from `want`, and whether both sides stay under the spread limits. */
const cuts = (ps: Pt[], a: Axis, want: number, ok: [(g: Pt[]) => boolean, (g: Pt[]) => boolean]): Cut[] => {
  const pre = ps.reduce<number[]>((acc, p) => [...acc, acc[acc.length - 1]! + p.cap], [0])
  return Array.from({length: ps.length - 1}, (_, i): Cut => ({at: i + 1, gap: ps[i + 1]![a] - ps[i]![a], dev: Math.abs(pre[i + 1]! - want), fits: ok[0](ps.slice(0, i + 1)) && ok[1](ps.slice(i + 1))}))
}
const choose = (cs: Cut[], room: number): Cut => {
  const kept = [cs.filter(c => c.fits), cs].find(g => g.length)!
  const apart = [kept.filter(c => c.gap > 0), kept].find(g => g.length)!
  const inside = apart.filter(c => c.dev <= room)
  return inside.length ? [...inside].sort(better)[0]! : [...apart].sort(closest)[0]!
}
const split = (room: number, most: Most) => (ps: Pt[], k: number): Pt[][] => {
  const left = Math.floor(k / 2)
  const a = widest(ps)
  const sorted = [...ps].sort(along(a))
  const at = k < 2 || sorted.length < 2 ? sorted.length : choose(cuts(sorted, a, (sum(ps) * left) / k, [within(most, left), within(most, k - left)]), room).at
  return k < 2 ? [sorted] : [...split(room, most)(sorted.slice(0, at), left), ...split(room, most)(sorted.slice(at), k - left)]
}
/** Ids of `ts` in k blocks (balanced covers, each a rectangle of nearby tables): left blocks before right, top before bottom. */
export const partition = (p: Policy, ts: Entity[], k: number): Id[][] => {
  const ps = ts.map(pt)
  return split(p.section.tol * (sum(ps) / k), limits(p, ps))(ps, k).map(g => g.sort(along('y')).map(q => q.id))
}
