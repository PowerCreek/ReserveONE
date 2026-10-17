// Isometric furniture (U2): a camera turn, convex solids (a footprint polygon raised from z by h), and the venue's pieces built from them.
// Pure string builders; classes are literals here, data colours (`fill`) come from entity data.
import type {Box} from './geo.ts'
export type V2 = [x: number, y: number]
export type P3 = [x: number, y: number, z: number]
/** The camera turn: `deg` clockwise about the frame point `c`. */
export interface Turn {deg: number; c: V2}
const C = Math.cos(Math.PI / 6)
const rad = (t: Turn) => (t.deg * Math.PI) / 180
export const spin = (t: Turn) => ([x, y]: V2): V2 => ((a = rad(t), dx = x - t.c[0], dy = y - t.c[1]) => [t.c[0] + dx * Math.cos(a) - dy * Math.sin(a), t.c[1] + dx * Math.sin(a) + dy * Math.cos(a)] as V2)()
/** 2:1 isometric of a turned point: x right-down, y left-down, z up; larger x + y is nearer the viewer. */
export const iso = ([x, y]: V2, z: number): V2 => [(x - y) * C, (x + y) / 2 - z]
export const proj = (t: Turn) => ([x, y, z]: P3): V2 => iso(spin(t)([x, y]), z)
export const depth = (t: Turn) => (p: V2) => ((q = spin(t)(p)) => q[0] + q[1])()
const f1 = (n: number) => n.toFixed(1)
export const pts = (ps: V2[]) => ps.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')
/** A solid: footprint (convex, frame px) from z up by h; `flat` = no side shading (outlines, thin slabs); `post` = a stroke of that width up from the footprint's one point (legs, pedestals). */
export interface Solid {foot: V2[]; z: number; h: number; cls: string; fill?: string; flat?: boolean; post?: number}
/** A piece: solids drawn as one unit, sorted with its neighbours by the depth of `at`. */
export interface Piece {at: V2; solids: Solid[]; kind?: string}
const mean = (ps: V2[]): V2 => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length]
const outward = (m: V2) => ([a, b]: [V2, V2]): V2 => ((n: V2 = [b[1] - a[1], a[0] - b[0]], o = (a[0] + b[0]) / 2 - m[0], q = (a[1] + b[1]) / 2 - m[1]) => (n[0] * o + n[1] * q < 0 ? [-n[0], -n[1]] : n) as V2)()
const fill = (s: Solid) => (s.fill ? ` fill="${s.fill}"` : '')
const poly = (ps: V2[], cls: string, f = '') => `<polygon points="${pts(ps)}"${f} class="${cls}"/>`
/** Sides facing the viewer (outward normal toward +x+y once turned), each under a shade by its facing, then the top face. */
const post = (t: Turn, s: Solid) => ((p = spin(t)(s.foot[0]!), a = iso(p, s.z), b = iso(p, s.z + s.h)) =>
  `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke-width="${s.post}" class="${s.cls}"/>`)()
/** A floor bar: a stroke along the footprint's two points at z (cross-base arms). */
const bar = (t: Turn, s: Solid) => ((a = iso(spin(t)(s.foot[0]!), s.z), b = iso(spin(t)(s.foot[1]!), s.z)) =>
  `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke-width="${s.post}" stroke-linecap="round" class="${s.cls}"/>`)()
export const solid = (t: Turn) => (s: Solid) => (s.post ? (s.foot.length > 1 ? bar(t, s) : post(t, s)) : box(t, s))
const box = (t: Turn, s: Solid) => {
  const r = s.foot.map(spin(t))
  const edges = r.map((a, i): [V2, V2] => [a, r[(i + 1) % r.length]!])
  const seen = edges.map(e => [e, outward(mean(r))(e)] as const).filter(([, n]) => n[0] + n[1] > 1e-9)
  const side = ([[a, b], n]: readonly [[V2, V2], V2]) => ((q = [iso(a, s.z), iso(b, s.z), iso(b, s.z + s.h), iso(a, s.z + s.h)]) =>
    poly(q, s.cls, fill(s)) + (s.flat ? '' : poly(q, n[1] > n[0] ? 'fill-black/10' : 'fill-black/30')))()
  return seen.map(side).join('') + poly(r.map(p => iso(p, s.z + s.h)), s.cls, fill(s))
}
/** A piece's solids bottom-up, then far to near (tagged `data-p` with its kind). */
export const piece = (t: Turn) => (p: Piece) => ((s = [...p.solids].sort((a, b) => a.z - b.z || depth(t)(mean(a.foot)) - depth(t)(mean(b.foot))).map(solid(t)).join('')) =>
  (p.kind ? `<g data-p="${p.kind}">${s}</g>` : s))()
export const sortPieces = (t: Turn, ps: Piece[]) => [...ps].sort((a, b) => depth(t)(a.at) - depth(t)(b.at))
// ---- shapes in the frame
export const rect = (b: Box): V2[] => [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]
export const ngon = ([cx, cy]: V2, r: number, n = 16): V2[] => Array.from({length: n}, (_, i): V2 => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)])
export const grow = (b: Box, d: number): Box => ({x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d})
export const mid = (b: Box): V2 => [b.x + b.w / 2, b.y + b.h / 2]
/** A local frame at `c` facing angle `a`: u forward (toward the table), v to the left. */
const frame = ([cx, cy]: V2, a: number) => (u: number, v: number): V2 => [cx + u * Math.cos(a) - v * Math.sin(a), cy + u * Math.sin(a) + v * Math.cos(a)]
const quad = (at: (u: number, v: number) => V2, u0: number, u1: number, v0: number, v1: number): V2[] => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)]
// ---- heights (frame px; a cell is 16) and finishes
export const Z = {table: 22, high: 34, seat: 13, highSeat: 21, back: 11, stool: 22, bar: 34, bench: 12, benchBack: 26, wall: 30, divider: 18}
export const METAL = 'fill-slate-500 stroke-slate-700 stroke-[0.5px] dark:fill-slate-400 dark:stroke-slate-300'
const ROD = 'stroke-slate-600 dark:stroke-slate-300'
const WOOD = 'fill-amber-700 stroke-amber-900 stroke-[0.5px] dark:fill-amber-800 dark:stroke-amber-600'
const TOPWOOD = 'fill-amber-500 stroke-amber-800 stroke-[0.5px] dark:fill-amber-600 dark:stroke-amber-400'
/** Seat finishes: plain, a taken seat (filled red), an empty seat of a seated table (red outline, no fill). */
export const SEAT = {plain: 'fill-stone-300 stroke-stone-500 stroke-[0.5px] dark:fill-stone-600 dark:stroke-stone-400', taken: 'fill-rose-500 stroke-rose-800 stroke-[0.5px] dark:fill-rose-500 dark:stroke-rose-300',
  free: 'fill-none stroke-rose-500 stroke-1 dark:stroke-rose-400', bench: 'fill-slate-400 stroke-slate-600 stroke-[0.5px] dark:fill-slate-500 dark:stroke-slate-300'}
const isFree = (cls: string) => cls === SEAT.free
/** A chair at `c` facing angle `a`: four legs, a seat, a backrest on the far edge, no arms; `seat` = seat height (a high chair is the same, taller). */
export const chair = (c: V2, a: number, d: number, seat: number, cls: string): Piece => {
  const [at, h, l] = [frame(c, a), d / 2, 1.6]
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]): Solid => ({foot: [at(u! * (h - l / 2), v! * (h - l / 2))], z: 0, h: seat - 2, cls: ROD, post: l}))
  return {at: c, kind: 'chair', solids: [...legs, {foot: quad(at, -h, h, -h, h), z: seat - 2, h: 2, cls, flat: true}, {foot: quad(at, -h, -h + 2, -h, h), z: seat, h: Z.back, cls, flat: isFree(cls)}]}
}
/** A stool: round base, a post, a round seat. */
export const stool = (c: V2, r: number, seat: number, cls: string): Piece =>
  ({at: c, kind: 'stool', solids: [{foot: ngon(c, r * 0.8, 6), z: 0, h: 1.5, cls: METAL, flat: true}, {foot: [c], z: 1.5, h: seat - 4, cls: ROD, post: 2.4}, {foot: ngon(c, r, 10), z: seat - 2.5, h: 2.5, cls, flat: true}]})
/** A bench in band `b` on side `s` of its table: an upholstered seat with its backrest joined on the outer edge. */
type Side = 't' | 'r' | 'b' | 'l'
const OUTER: Record<Side, (b: Box, k: number) => [back: Box, seat: Box]> = {
  t: (b, k) => [{...b, h: b.h * k}, {...b, y: b.y + b.h * k, h: b.h * (1 - k)}], b: (b, k) => [{...b, y: b.y + b.h * (1 - k), h: b.h * k}, {...b, h: b.h * (1 - k)}],
  l: (b, k) => [{...b, w: b.w * k}, {...b, x: b.x + b.w * k, w: b.w * (1 - k)}], r: (b, k) => [{...b, x: b.x + b.w * (1 - k), w: b.w * k}, {...b, w: b.w * (1 - k)}],
}
export const bench = (b: Box, s: Side, cls: string): Piece => ((ps = OUTER[s](b, 0.3)) =>
  ({at: mid(b), kind: 'bench', solids: [{foot: rect(ps[1]), z: 0, h: Z.bench, cls, flat: isFree(cls)}, {foot: rect(ps[0]), z: 0, h: Z.benchBack, cls, flat: isFree(cls)}]}))()
/** A table: a thin top at height `th` on a thin single pedestal over an X cross-base whose arms run along x and y (toward the chair sides). */
export const table = (b: Box, top: V2[], th: number, cls: string, f?: string): Piece => {
  const [c, ax, ay] = [mid(b), b.w * 0.42, b.h * 0.42]
  const arm = (dx: number, dy: number): Solid => ({foot: [[c[0] - dx, c[1] - dy], [c[0] + dx, c[1] + dy]], z: 0.8, h: 0, cls: ROD, post: 2.6})
  return {at: c, kind: 'table', solids: [arm(ax, 0), arm(0, ay), {foot: [c], z: 0.8, h: th - 2.8, cls: ROD, post: 3.2}, {foot: top, z: th - 2, h: 2, cls, flat: true, ...(f && {fill: f})}]}
}
/** A counter piece (one arm of a bar): a panelled body under an overhanging top. */
export const counter = (b: Box): Piece => ({at: mid(b), kind: 'counter', solids: [{foot: rect(grow(b, -1)), z: 0, h: Z.bar - 3, cls: WOOD}, {foot: rect(grow(b, 2)), z: Z.bar - 3, h: 3, cls: TOPWOOD}]})
/** A wall or partition: a box, or a thin slab along a zero-width line. */
export const wall = (b: Box, h: number, cls: string): Piece => ((t = b.w && b.h ? b : b.w ? {...b, y: b.y - 1, h: 2} : {...b, x: b.x - 1, w: 2}) => ({at: mid(t), solids: [{foot: rect(t), z: 0, h, cls}]}))()
