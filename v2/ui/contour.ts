// Booth and corner-bench geometry (U12): a table outline (a rect with some corners rounded) and the bench bands that run round it, as px polygons
// with arcs sampled. One model for all: a bench chain = contiguous sides clockwise; its inner corners are rounded and the band is the outline offset
// by [d0, d1]. Open booths (`seating.open`): the table is inset in the body and the bench is the U on the other three sides (the D shape `(|`).
import type {Components, Side} from '../contracts/index.ts'
import type {Box} from './geo.ts'
export type Pt = [x: number, y: number]
type Seat = Components['seating']
const CW: Side[] = ['t', 'r', 'b', 'l'] // clockwise in screen coords (y down)
const ANG: Record<Side, number> = {t: -90, r: 0, b: 90, l: 180} // outward normal angle
const NORM: Record<Side, Pt> = {t: [0, -1], r: [1, 0], b: [0, 1], l: [-1, 0]}
/** Each side's run (clockwise) and its end corner. */
const RUN: Record<Side, (p: Box) => [Pt, Pt]> = {
  t: p => [[p.x, p.y], [p.x + p.w, p.y]], r: p => [[p.x + p.w, p.y], [p.x + p.w, p.y + p.h]],
  b: p => [[p.x + p.w, p.y + p.h], [p.x, p.y + p.h]], l: p => [[p.x, p.y + p.h], [p.x, p.y]],
}
const next = (s: Side) => CW[(CW.indexOf(s) + 1) % 4]!
const prev = (s: Side) => CW[(CW.indexOf(s) + 3) % 4]!
/** Corner radius after side `s` (between s and its clockwise next). */
type Radii = Partial<Record<Side, number>>
/** Contiguous clockwise chains over a set of sides (a chain starts where its predecessor is not in the set). */
export const chains = (on: Side[]): Side[][] => ((all = on.length === 4) => (all ? [CW] : CW.filter(s => on.includes(s) && !on.includes(prev(s))).map(s0 =>
  CW.map((_, i) => CW[(CW.indexOf(s0) + i) % 4]!).reduce<{run: Side[]; open: boolean}>((a, s) => (a.open && on.includes(s) ? {run: [...a.run, s], open: true} : {...a, open: false}), {run: [], open: true}).run)))()
// ---- one path at offset d along a chain: straight runs and corner arcs, each a function u in [0,1] -> point
type Seg = {len: number; at: (u: number) => Pt; arc: boolean}
const line = (a: Pt, b: Pt): Seg => ({len: Math.hypot(b[0] - a[0], b[1] - a[1]), at: u => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], arc: false})
const arc = (c: Pt, r: number, a0: number): Seg => ({len: (Math.PI / 2) * r, at: u => ((a = ((a0 + 90 * u) * Math.PI) / 180) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as Pt)(), arc: true})
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k]
/** The side's straight run, shortened by the rounded corners at its ends, pushed out by d. */
const run = (p: Box, rad: Radii, s: Side, d: number) => ((([a, b]) => ((dir: Pt = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])]) =>
  line(add(add(a, dir, rad[prev(s)] ?? 0), NORM[s], d), add(add(b, dir, -(rad[s] ?? 0)), NORM[s], d)))())(RUN[s](p)))
/** The corner after side s: centre inset by its radius, radius + d. */
const turn = (p: Box, rad: Radii, s: Side, d: number) => ((r = rad[s] ?? 0, k = RUN[s](p)[1]) => arc(add(add(k, NORM[s], -r), NORM[next(s)], -r), r + d, ANG[s]))()
const path = (p: Box, rad: Radii, ch: Side[], d: number): Seg[] => ch.flatMap((s, i) => [run(p, rad, s, d), ...(i < ch.length - 1 ? [turn(p, rad, s, d)] : [])])
/** Sample a path between params T0..T1 (T = segment index + u): every segment boundary, arcs every 1/8. */
const sample = (segs: Seg[], t0: number, t1: number): Pt[] => {
  const ts = [t0, ...segs.flatMap((sg, i) => (sg.arc ? [1, 2, 3, 4, 5, 6, 7].map(k => i + k / 8) : []).concat(i)), t1].filter(t => t >= t0 && t <= t1)
  return [...new Set(ts)].sort((a, b) => a - b).map(t => ((i = Math.min(segs.length - 1, Math.floor(t))) => segs[i]!.at(t - i))())
}
/** T for a fraction f of the path's length. */
const param = (segs: Seg[], f: number) => ((tot = segs.reduce((a, s) => a + s.len, 0)) => segs.reduce<{t: number; left: number; done: boolean}>((a, s, i) =>
  a.done ? a : a.left <= s.len || i === segs.length - 1 ? {t: i + (s.len ? Math.min(1, a.left / s.len) : 0), left: 0, done: true} : {...a, left: a.left - s.len}, {t: 0, left: f * tot, done: false}).t)()
/** A band between offsets d0 and d1 over params T0..T1: the outer edge forward, the inner back. */
const band = (p: Box, rad: Radii, ch: Side[], [d0, d1]: [number, number], t0: number, t1: number): Pt[] =>
  [...sample(path(p, rad, ch, d1), t0, t1), ...sample(path(p, rad, ch, d0), t0, t1).reverse()]
const r2 = (q: Pt): Pt => [+q[0].toFixed(2), +q[1].toFixed(2)]
/** The whole outline of rect p with corner radii, clockwise from the top-left. */
const outline = (p: Box, rad: Radii): Pt[] => sample(CW.flatMap(s => [run(p, rad, s, 0), turn(p, rad, s, 0)]), 0, 8).slice(0, -1).map(r2)
  .filter((q, i, qs) => i === 0 || q[0] !== qs[i - 1]![0] || q[1] !== qs[i - 1]![1])
// ---- the model: what a table's seating makes of its body
interface Model {table: Box; rad: Radii; benches: Side[][]; d: [number, number]}
const corners = (ch: Side[][], r: number): Radii => Object.fromEntries(ch.flatMap(c => c.slice(0, -1).map(s => [s, r])))
/** Open booth: the table inset by bench + gap on every side but the open one; its two far corners a full half-round (the D). */
const booth = (p: Box, c: number, open: Side): Model => {
  const [k, g] = [c * 0.75, 2]
  const i = {t: open === 't' ? 0 : k + g, b: open === 'b' ? 0 : k + g, l: open === 'l' ? 0 : k + g, r: open === 'r' ? 0 : k + g}
  const tb: Box = {x: p.x + i.l, y: p.y + i.t, w: p.w - i.l - i.r, h: p.h - i.t - i.b}
  const along = open === 't' || open === 'b' ? tb.w : tb.h
  const r = Math.min(along / 2, along === tb.w ? tb.h : tb.w)
  const ch = chains(CW.filter(s => s !== open))
  return {table: tb, rad: corners(ch, r), benches: ch, d: [g, g + k]}
}
/** Benches in the seat bands outside the body: the corner between two bench sides rounds as a quarter circle. */
const banded = (p: Box, c: number, on: Side[]): Model => ((ch = chains(on)) => ({table: p, rad: corners(ch, Math.min(p.w, p.h) / 2), benches: ch, d: [0.5, c - 1]}))()
export const modelOf = (p: Box, s: Seat | undefined, c: number): Model =>
  s?.open ? booth(p, c, s.open) : banded(p, c, (s?.bench ?? []).filter(x => CW.includes(x)))
/** Polygons in px (arcs sampled): the table top and each bench band (one per contiguous chain). */
export const contourOf = (p: Box, s: Seat | undefined, c: number): {table: Pt[]; bench: Pt[][]} => ((m = modelOf(p, s, c)) =>
  ({table: outline(m.table, m.rad).map(r2), bench: m.benches.map(ch => band(m.table, m.rad, ch, m.d, 0, path(m.table, m.rad, ch, 0).length).map(r2))}))()
/** `n` seat places cut evenly along a chain's centre line, each a slice of the band. */
export const slices = (p: Box, s: Seat | undefined, c: number, n: number[]): Pt[][] => ((m = modelOf(p, s, c), mid = (m.d[0] + m.d[1]) / 2) =>
  m.benches.flatMap((ch, j) => ((segs = path(m.table, m.rad, ch, mid), k = n[j] ?? 1) =>
    Array.from({length: k}, (_, i) => band(m.table, m.rad, ch, m.d, param(segs, i / k), param(segs, (i + 1) / k)).map(r2)))()))()
/** Length of each chain's centre line, px. */
export const lengths = (p: Box, s: Seat | undefined, c: number) => ((m = modelOf(p, s, c)) => m.benches.map(ch => path(m.table, m.rad, ch, (m.d[0] + m.d[1]) / 2).reduce((a, x) => a + x.len, 0)))()
export const rounded = (p: Box, s: Seat | undefined, c: number) => Object.values(modelOf(p, s, c).rad).some(r => (r ?? 0) > 0)
export const tableBox = (p: Box, s: Seat | undefined, c: number) => modelOf(p, s, c).table
export const bbox = (ps: Pt[]): Box => ((xs = ps.map(q => q[0]), ys = ps.map(q => q[1])) => ({x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)}))()
export const pts = (ps: Pt[]) => ps.map(q => `${q[0]},${q[1]}`).join(' ')
