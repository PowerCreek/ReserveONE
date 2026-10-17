// Isometric furniture (U2): a camera turn, convex solids (a footprint polygon raised from z by h), and the venue's pieces built from them.
// Pure string builders; classes are literals here, data colours (`fill`) come from entity data.
import type {Box} from './geo.ts'
export type V2 = [x: number, y: number]
export type P3 = [x: number, y: number, z: number]
/** The camera turn: `deg` clockwise about the frame point `c`. */
export interface Turn {deg: number; c: V2}
const C = Math.cos(Math.PI / 6)
const rad = (t: Turn) => (t.deg * Math.PI) / 180
/** The turn's rotation, built once per turn (WeakMap; a turn is a value object made per render). */
const spins = new WeakMap<Turn, (p: V2) => V2>()
const make = (t: Turn) => ((co = Math.cos(rad(t)), si = Math.sin(rad(t)), [cx, cy] = t.c) => ([x, y]: V2): V2 => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co])()
export const spin = (t: Turn) => spins.get(t) ?? (spins.set(t, make(t)), spins.get(t)!)
/** 2:1 isometric of a turned point: x right-down, y left-down, z up; larger x + y is nearer the viewer. */
export const iso = ([x, y]: V2, z: number): V2 => [(x - y) * C, (x + y) / 2 - z]
export const proj = (t: Turn) => ([x, y, z]: P3): V2 => iso(spin(t)([x, y]), z)
export const depth = (t: Turn) => (p: V2) => ((q = spin(t)(p)) => q[0] + q[1])()
const f1 = (n: number) => String(Math.round(n * 10) / 10)
export const pts = (ps: V2[]) => ps.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')
/** A solid: footprint (convex, frame px) from z up by h; `flat` = no side shading (outlines, thin slabs); `post` = a stroke of that width up from the footprint's one point (legs, pedestals). */
export interface Solid {foot: V2[]; z: number; h: number; cls: string; fill?: string; flat?: boolean; post?: number; legs?: boolean; sides?: boolean[]; seam?: boolean} // sides = which footprint edges get a side face (default all: a tile drops the edges it shares); seam = the top is filled without a stroke and only the drawn edges are outlined (tiles read as one piece)
/** A piece: solids drawn as one unit, sorted with its neighbours by the depth of `at`. */
export interface Piece {at: V2; solids: Solid[]; kind?: string}
const mean = (ps: V2[]): V2 => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length]
const outward = (m: V2) => ([a, b]: [V2, V2]): V2 => ((n: V2 = [b[1] - a[1], a[0] - b[0]], o = (a[0] + b[0]) / 2 - m[0], q = (a[1] + b[1]) / 2 - m[1]) => (n[0] * o + n[1] * q < 0 ? [-n[0], -n[1]] : n) as V2)()
const fill = (s: Solid) => (s.fill ? ` fill="${s.fill}"` : '')
/** One drawn element split into its fixed part (`a`: attributes other than geometry) and its geometry (`g`: points, or x1 y1 x2 y2), so a retained element follows a new turn by writing `g` alone. */
export interface Shape {tag: 'polygon' | 'polyline' | 'path'; a: string; g: string[]}
export const GEO: Record<Shape['tag'], string[]> = {polygon: ['points'], polyline: ['points'], path: ['d']}
const HTML: Record<Shape['tag'], (s: Shape) => string> = {
  polygon: s => `<polygon points="${s.g[0]}"${s.a}/>`,
  polyline: s => `<polyline points="${s.g[0]}"${s.a}/>`,
  path: s => `<path d="${s.g[0]}"${s.a}/>`,
}
export const html = (s: Shape) => HTML[s.tag](s)
const stroke = (p: V2, q: V2, a: string): Shape => ({tag: 'polyline', a, g: [`${f1(p[0])},${f1(p[1])} ${f1(q[0])},${f1(q[1])}`]}) // a two-point polyline: one write moves it
/** A post: a stroke up from the footprint's one point. */
const post = (t: Turn, s: Solid): Shape[] => ((p = spin(t)(s.foot[0]!)) => [stroke(iso(p, s.z), iso(p, s.z + s.h), ` stroke-width="${s.post}" class="${s.cls}"`)])()
/** A floor bar: a stroke along the footprint's two points at z (cross-base arms). */
const bar = (t: Turn, s: Solid): Shape[] => [stroke(iso(spin(t)(s.foot[0]!), s.z), iso(spin(t)(s.foot[1]!), s.z), ` stroke-width="${s.post}" stroke-linecap="round" class="${s.cls}"`)]
/** Legs: every footprint point a post, drawn as one path (one element to move per chair). */
const legs = (t: Turn, s: Solid): Shape[] => [{tag: 'path', a: ` fill="none" stroke-width="${s.post}" class="${s.cls}"`, g: [s.foot.map(p => ((q = spin(t)(p)) => `M${f1((q[0] - q[1]) * C)},${f1((q[0] + q[1]) / 2 - s.z)}V${f1((q[0] + q[1]) / 2 - s.z - s.h)}`)()).join('')]}]
export const solid = (t: Turn) => (s: Solid): Shape[] => (s.legs ? legs(t, s) : s.post ? (s.foot.length > 1 ? bar(t, s) : post(t, s)) : box(t, s))
// ---- a solid's outward edge normals and centre are fixed in the frame: kept once, turned per draw (the turn only rotates them)
const geos = new WeakMap<Solid, {ns: V2[]; m: V2}>()
const geoOf = (s: Solid) => geos.get(s) ?? (geos.set(s, {m: mean(s.foot), ns: s.foot.map((a, i) => outward(mean(s.foot))([a, s.foot[(i + 1) % s.foot.length]!]))}), geos.get(s)!)
const cs = new WeakMap<Turn, V2>()
const csOf = (t: Turn): V2 => cs.get(t) ?? (cs.set(t, [Math.cos(rad(t)), Math.sin(rad(t))]), cs.get(t)!)
/** A solid's footprint turned and projected: per vertex its "x,y" at the base and at the top (strings, so every face only joins them). */
const verts = (t: Turn, s: Solid): [string, string][] => {
  const [[co, si], [cx, cy], zt] = [csOf(t), t.c, s.z + s.h]
  return s.foot.map(([x, y]) => ((rx = cx + (x - cx) * co - (y - cy) * si, ry = cy + (x - cx) * si + (y - cy) * co, sx = f1((rx - ry) * C), sy = (rx + ry) / 2) => [`${sx},${f1(sy - s.z)}`, `${sx},${f1(sy - zt)}`] as [string, string])())
}
const face = (a: string, f: string): Shape => ({tag: 'polygon', a: f, g: [a]})
/** Sides facing the viewer (outward normal toward +x+y once turned), each under a shade by its facing, then the top face. */
const box = (t: Turn, s: Solid): Shape[] => {
  const [[co, si], v, ns] = [csOf(t), verts(t, s), geoOf(s).ns]
  const f = fill(s) + (s.seam ? NOSTROKE : '') + ` class="${s.cls}"`
  const side = (i: number): Shape[] => ((a = v[i]!, b = v[(i + 1) % v.length]!, q = `${a[0]} ${b[0]} ${b[1]} ${a[1]}`) =>
    [face(q, f), ...(s.flat ? [] : [face(q, ns[i]![0] * si + ns[i]![1] * co > ns[i]![0] * co - ns[i]![1] * si ? SHADE10 : SHADE30)])])()
  const seen = v.map((_, i) => i).filter(i => ns[i]![0] * co - ns[i]![1] * si + ns[i]![0] * si + ns[i]![1] * co > 1e-9 && (s.sides?.[i] ?? true))
  return [...seen.flatMap(side), ...(s.seam ? seamTop(s, v) : [face(v.map(a => a[1]).join(' '), fill(s) + ` class="${s.cls}"`)])]
}
const SHADE10 = ' class="fill-black/10"', SHADE30 = ' class="fill-black/30"'
/** A tile's faces carry no stroke (inline style: it must beat the stroke class); the top's outer edges are stroked on their own. */
const NOSTROKE = ' style="stroke:none"'
const seamTop = (s: Solid, v: [string, string][]): Shape[] => [face(v.map(a => a[1]).join(' '), `${fill(s)}${NOSTROKE} class="${s.cls}"`),
  ...v.map((a, i): [string, number] => [a[1], i]).filter(([, i]) => s.sides?.[i] ?? true).map(([a, i]) => ({tag: 'polyline', a: ` class="${s.cls}"`, g: [`${a} ${v[(i + 1) % v.length]![1]}`]}) as Shape)]
/** A piece's solids bottom-up, then far to near, as shapes. */
export const shapes = (t: Turn) => (p: Piece): Shape[] => ((d = (s: Solid) => ((q = spin(t)(geoOf(s).m)) => q[0] + q[1])()) =>
  p.solids.map(s => [s, d(s)] as const).sort((a, b) => a[0].z - b[0].z || a[1] - b[1]).flatMap(([s]) => solid(t)(s)))()
/** A piece's markup (tagged `data-p` with its kind). */
export const wrapKind = (kind: string | undefined, inner: string) => (kind ? `<g data-p="${kind}">${inner}</g>` : inner)
export const piece = (t: Turn) => (p: Piece) => wrapKind(p.kind, shapes(t)(p).map(html).join(''))
// ---- painter order: a piece's world box; two pieces whose screen boxes overlap are ordered by the axis that separates them (toward the viewer under the turn), else bottom-up, else by depth; a topological pass then draws far to near
export interface Box3 {x0: number; y0: number; x1: number; y1: number; z0: number; z1: number}
export const extent = (p: Piece): Box3 => ((ps = p.solids.flatMap(s => s.foot), zs = p.solids.flatMap(s => [s.z, s.z + s.h])) =>
  ({x0: Math.min(...ps.map(q => q[0])), y0: Math.min(...ps.map(q => q[1])), x1: Math.max(...ps.map(q => q[0])), y1: Math.max(...ps.map(q => q[1])), z0: Math.min(...zs), z1: Math.max(...zs)}))()
/** World direction toward the viewer (the gradient of depth). */
const toward = (t: Turn): V2 => ((a = rad(t)) => [Math.cos(a) + Math.sin(a), Math.cos(a) - Math.sin(a)])()
const E = 0.25
const sep = (a0: number, a1: number, b0: number, b1: number) => (a1 <= b0 + E ? -1 : b1 <= a0 + E ? 1 : 0)
const sgn = (n: number) => (Math.abs(n) < 1e-6 ? 0 : Math.sign(n))
/** < 0: draw `a` first. */
const beforeWith = (d: V2) => (a: Box3, b: Box3, da: number, db: number) => {
  const [ox, oy] = [sep(a.x0, a.x1, b.x0, b.x1), sep(a.y0, a.y1, b.y0, b.y1)]
  const [kx, ky] = [ox * sgn(d[0]), oy * sgn(d[1])]
  const stack = !ox && !oy ? sep(a.z0, a.z1, b.z0, b.z1) : 0
  return kx && ky && kx !== ky ? da - db : kx || ky || stack || da - db
}
export const before = (t: Turn) => beforeWith(toward(t))
type Sb = [x0: number, y0: number, x1: number, y1: number]
const screenBox = (t: Turn, b: Box3): Sb => {
  const qs = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(p => spin(t)(p as V2))
  const [xs, ys] = [qs.map(q => (q[0] - q[1]) * C), qs.map(q => (q[0] + q[1]) / 2)]
  return [Math.min(...xs), Math.min(...ys) - b.z1, Math.max(...xs), Math.max(...ys) - b.z0]
}
const meet = (a: Sb, b: Sb) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
/** Draw order (indices) for items with world boxes: edges only between screen-overlapping pairs; ties and cycles fall back to depth. */
export const order = (t: Turn, items: {box: Box3; at: V2}[]): number[] => {
  const [ds, sb, bf] = [items.map(i => depth(t)(i.at)), items.map(i => screenBox(t, i.box)), beforeWith(toward(t))]
  const after: number[][] = items.map(() => []), need = items.map(() => 0)
  const byX = items.map((_, i) => i).sort((i, j) => sb[i]![0] - sb[j]![0])
  const edge = (i: number, j: number) => ((s = bf(items[i]!.box, items[j]!.box, ds[i]!, ds[j]!)) => s && (s < 0 ? (after[i]!.push(j), need[j]!++) : (after[j]!.push(i), need[i]!++)))()
  /** Sweep: from each item, only the next ones (by screen x) whose x range starts before it ends. */
  const run = (k: number, m = k + 1): void => void (m < byX.length && sb[byX[m]!]![0] < sb[byX[k]!]![2] && (meet(sb[byX[k]!]!, sb[byX[m]!]!) && edge(byX[k]!, byX[m]!), run(k, m + 1)))
  byX.forEach((_, k) => run(k))
  const rank = items.map((_, i) => i).sort((i, j) => ds[i]! - ds[j]!), done = items.map(() => false)
  return rank.map(() => ((n = rank.find(i => !done[i] && !need[i]) ?? rank.find(i => !done[i])!) => ((done[n] = true), after[n]!.forEach(j => need[j]!--), n))())
}
// ---- tiles: a shape cut into cells so each sorts on its own, drawn as one (shared edges carry no side and no stroke)
const inside = (poly: V2[]) => ([x, y]: V2) => poly.reduce((o, a, i) => ((b = poly[(i + 1) % poly.length]!) => ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0] ? !o : o))(), false)
/** The cells of a polygon on cell corners (cell = g px). */
export const cellsIn = (poly: V2[], g: number): Box[] => ((x0 = Math.min(...poly.map(p => p[0])), y0 = Math.min(...poly.map(p => p[1])), nx = Math.round((Math.max(...poly.map(p => p[0])) - x0) / g), ny = Math.round((Math.max(...poly.map(p => p[1])) - y0) / g)) =>
  Array.from({length: nx * ny}, (_, k): Box => ({x: x0 + (k % nx) * g, y: y0 + Math.floor(k / nx) * g, w: g, h: g})).filter(c => inside(poly)(mid(c))))()
/** Which of a tile's edges are outer: the point just past the edge's middle lies in no other tile. */
export const outer = (tiles: Box[]) => (b: Box): boolean[] => ((r = rect(b)) => r.map((a, i) => ((q = r[(i + 1) % 4]!, m = mid(b), e: V2 = [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2], p: V2 = [e[0] + Math.sign(e[0] - m[0]) * 0.5, e[1] + Math.sign(e[1] - m[1]) * 0.5]) =>
  !tiles.some(c => c !== b && p[0] > c.x && p[0] < c.x + c.w && p[1] > c.y && p[1] < c.y + c.h))()))()
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
  const legs: Solid = {foot: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => at(u! * (h - l / 2), v! * (h - l / 2))), z: 0, h: seat - 2, cls: ROD, post: l, legs: true}
  return {at: c, kind: 'chair', solids: [legs, {foot: quad(at, -h, h, -h, h), z: seat - 2, h: 2, cls, flat: true}, {foot: quad(at, -h, -h + 2, -h, h), z: seat, h: Z.back, cls, flat: isFree(cls)}]}
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
/** A bench along a contour: the band's outer and inner edges (paired points), cut into segments of at most `g` px; each segment is an upholstered seat
 * with its backrest joined on the outer edge, only the strip's two ends closed. `cls(f)` = the finish at fraction f along the strip (which place it is). */
export const strip = (outer: V2[], inner: V2[], g: number, cls: (f: number) => string): Piece[] => {
  const lerp = (a: V2, b: V2, k: number): V2 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
  const cut = outer.slice(1).flatMap((o, i) => ((n = Math.max(1, Math.ceil(Math.hypot(o[0] - outer[i]![0], o[1] - outer[i]![1]) / g))) =>
    Array.from({length: n}, (_, k) => [lerp(outer[i]!, o, k / n), lerp(inner[i]!, inner[i + 1]!, k / n)] as const))()).concat([[outer.at(-1)!, inner.at(-1)!]])
  const [os, is] = [cut.map(c => c[0]), cut.map(c => c[1])]
  const ms = os.map((o, i) => lerp(o, is[i]!, 0.3))
  const len = os.slice(1).map((o, i) => Math.hypot(o[0] - os[i]![0], o[1] - os[i]![1]))
  const tot = len.reduce((a, b) => a + b, 0) || 1
  const at = len.map((_, i) => (len.slice(0, i).reduce((a, b) => a + b, 0) + len[i]! / 2) / tot)
  return len.map((_, i): Piece => ((c = cls(at[i]!), first = i === 0, last = i === len.length - 1) => ({at: mid({x: Math.min(os[i]![0], is[i + 1]![0]), y: Math.min(os[i]![1], is[i + 1]![1]), w: Math.abs(os[i]![0] - is[i + 1]![0]), h: Math.abs(os[i]![1] - is[i + 1]![1])}), kind: 'bench', solids: [
    {foot: [ms[i]!, ms[i + 1]!, is[i + 1]!, is[i]!], z: 0, h: Z.bench, cls: c, sides: [false, last, true, first], seam: true, flat: c === SEAT.free},
    {foot: [os[i]!, os[i + 1]!, ms[i + 1]!, ms[i]!], z: 0, h: Z.benchBack, cls: c, sides: [true, last, true, first], seam: true, flat: c === SEAT.free}]}))())
}
/** A table: a thin top at height `th` on a thin single pedestal over an X cross-base whose arms run along x and y (toward the chair sides). */
export const table = (b: Box, top: V2[], th: number, cls: string, f?: string): Piece => {
  const [c, ax, ay] = [mid(b), b.w * 0.42, b.h * 0.42]
  const arm = (dx: number, dy: number): Solid => ({foot: [[c[0] - dx, c[1] - dy], [c[0] + dx, c[1] + dy]], z: 0.8, h: 0, cls: ROD, post: 2.6})
  return {at: c, kind: 'table', solids: [arm(ax, 0), arm(0, ay), {foot: [c], z: 0.8, h: th - 2.8, cls: ROD, post: 3.2}, {foot: top, z: th - 2, h: 2, cls, flat: true, ...(f && {fill: f})}]}
}
/** The counter: its top polygon extruded as one piece (a panelled body under a top in `cls`), cut into cell tiles for the painter. */
export const counter = (poly: V2[], g: number, cls = TOPWOOD, f?: string): Piece[] => ((cs = cellsIn(poly, g)) => cs.map((c): Piece => ((sides = outer(cs)(c)) =>
  ({at: mid(c), kind: 'counter', solids: [{foot: rect(c), z: 0, h: Z.bar - 3, cls: WOOD, sides, seam: true}, {foot: rect(c), z: Z.bar - 3, h: 3, cls, sides, seam: true, ...(f && {fill: f})}]}))()))()
/** A wall or partition: a box, or a thin slab along a zero-width line, cut into cell segments. */
export const wall = (b: Box, h: number, cls: string, g: number): Piece[] => {
  const t = b.w && b.h ? b : b.w ? {...b, y: b.y - 1, h: 2} : {...b, x: b.x - 1, w: 2}
  const [nx, ny] = [Math.max(1, Math.round(t.w / g)), Math.max(1, Math.round(t.h / g))]
  const cs = Array.from({length: nx * ny}, (_, k): Box => ({x: t.x + ((k % nx) * t.w) / nx, y: t.y + (Math.floor(k / nx) * t.h) / ny, w: t.w / nx, h: t.h / ny}))
  return cs.map(c => ({at: mid(c), kind: 'wall', solids: [{foot: rect(c), z: 0, h, cls, sides: outer(cs)(c), seam: true}]}))
}
