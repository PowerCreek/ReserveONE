// Isometric floor view (U2): every level of the same world stacked in one 3D frame. Pure string builders; classes are literals here or in tone.ts, data colours come from entity data.
import {defaultPolicy, having} from '../contracts/index.ts'
import type {Components, Ent, Hold, Id, World} from '../contracts/index.ts'
import {ALERT, STAFF, contour, seatedAt, seatsOf, serverOf, slotAt, titleOf} from './draw.ts'
import type {Alerts, Place} from './draw.ts'
import {CAM, H, W, floorOf, hull, levelName, levelOf, levels} from './geo.ts'
import type {Box} from './geo.ts'
import {SEAT, Z, bench, chair, counter, depth, extent, grow, html, mid, ngon, order, piece, proj, pts, rect, shapes, stool, strip, table, wall, wrapKind} from './furniture.ts'
import type {Box3, P3, Piece, Shape, Turn, V2} from './furniture.ts'
import {fitOf, offset, viewBox} from './isocam.ts'
import type {View} from './isocam.ts'
import {esc} from './render.ts'
import type {Fx} from './state.ts'
import {RING, ROLE, TABLE, ctaSm, ghost} from './tone.ts'
export type Pal = 'status' | 'area' | 'section' | 'server'
/** View controls: palette, per-level opacity (0-100) and hide, level spacing stop, overlays, and the camera (turn in degrees, pan + zoom, per-level moves). */
export interface Iso extends View {pal: Pal; op: Record<string, number>; hide: Record<string, boolean>; gap: number; units: boolean; pings: boolean}
export const ISO: Iso = {pal: 'status', op: {1: 50}, hide: {}, gap: 3, rot: 0, cam: CAM, shift: {}, units: true, pings: true} // upper levels start see-through
export const GAPS = [0, 140, 280, 440] // frame px between storeys, per spacing stop
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n || 0)))
const PALS: [Pal, string][] = [['status', 'Status'], ['area', 'Area'], ['section', 'Section'], ['server', 'Server']]
/** One control press: `k` names the setting, `v` its value (`op` takes `<level>:<stop>`). */
const SET: Record<string, (o: Iso, v: string) => Partial<Iso>> = {
  pal: (_, v) => ({pal: v as Pal}),
  op: (o, v) => ({op: {...o.op, [v.split(':')[0]!]: clamp(Number(v.split(':')[1]))}}),
  hide: (o, v) => ({hide: {...o.hide, [v]: !o.hide[v]}}),
  gap: (_, v) => ({gap: Number(v)}),
  rot: (o, v) => ({rot: (((o.rot + Number(v)) % 360) + 360) % 360}),
  reset: () => ({rot: 0, cam: CAM, shift: {}}),
  units: o => ({units: !o.units}),
  pings: o => ({pings: !o.pings}),
}
export const tweak = (o: Iso, k: string, v: string): Iso => ({...o, ...(SET[k]?.(o, v) ?? {})})
// Palettes: each colours a table by one of its facts and names that fact for the legend.
type T = Ent<'table' | 'pos'> & {area?: Components['area']; feat?: Components['feat']; seating?: Components['seating']}
export interface Ctx {w: World; holds: Hold[]; areas: Record<Id, {label: string}>; alerts?: Alerts; pick?: Id}
interface Paint {key: string; name: string; cls: string; fill?: string; ink: string}
const INK = 'fill-slate-900 dark:fill-slate-50', WHITE = 'fill-white'
const NONE = 'fill-slate-200 stroke-slate-500 dark:fill-slate-700 dark:stroke-slate-400'
const AREA: Record<string, string> = {
  main: 'fill-sky-200 stroke-sky-700 dark:fill-sky-800 dark:stroke-sky-300', grotto: 'fill-emerald-200 stroke-emerald-700 dark:fill-emerald-800 dark:stroke-emerald-300',
  bar: 'fill-amber-200 stroke-amber-700 dark:fill-amber-800 dark:stroke-amber-300', patio: 'fill-lime-200 stroke-lime-700 dark:fill-lime-800 dark:stroke-lime-300',
  roof: 'fill-violet-200 stroke-violet-700 dark:fill-violet-800 dark:stroke-violet-300',
}
const staffPaint = (c: Ctx, s?: Ent<'staff'>): Paint =>
  s ? {key: s.id, name: s.staff.name, cls: `${STAFF[having(c.w, 'staff').findIndex(x => x.id === s.id) % STAFF.length]} stroke-slate-900/40`, ink: WHITE} : {key: '-', name: 'no server', cls: NONE, ink: INK}
const PAINT: Record<Pal, (c: Ctx) => (t: T) => Paint> = {
  status: () => t => ({key: t.table.status, name: t.table.status.replace('_', ' '), cls: TABLE[t.table.status], ink: INK}),
  area: c => t => ({key: t.area?.id ?? 'main', name: c.areas[t.area?.id ?? 'main']?.label ?? t.area?.id ?? 'main', cls: AREA[t.area?.id ?? 'main'] ?? NONE, ink: INK}),
  section: c => t => ((s = c.w.ents[t.table.section ?? '']) => (s?.section ? {key: s.id, name: s.section.name, cls: 'stroke-slate-900/40', fill: s.section.color, ink: INK} : {key: '-', name: 'no section', cls: NONE, ink: INK}))(),
  server: c => t => staffPaint(c, serverOf(c.w, c.holds)(t) as Ent<'staff'> | undefined),
}
// Drawing: per level one group (opacity, moved as one translate): floor slabs that abut, zone outlines, the level's own grid clipped to its slabs,
// then furniture back to front (tables with their seats, walls), floor names, units and pings. Geometry is built at z 0; the group's translate lifts and moves it.
const G = defaultPolicy.sim.grid
const SLAB = ['fill-slate-200 stroke-slate-400 dark:fill-slate-700 dark:stroke-slate-500', 'fill-indigo-50/70 stroke-indigo-400 dark:fill-indigo-950/70 dark:stroke-indigo-500']
const LIFT = 6, MARGIN = 40
export const tablesAt = (w: World, lv: number): T[] => having(w, 'table', 'pos').filter(t => levelOf(w, t.pos.floor) === lv)
const zonesAt = (w: World, lv: number) => having(w, 'zone', 'pos').filter(z => levelOf(w, z.pos.floor) === lv)
export const shownLevels = (w: World, o: Iso) => levels(w).filter(lv => !o.hide[lv])
/** The turn's centre and reach: every level's tables and zones (shown or not), so neither hiding nor moving a level changes the fit. */
const reach = (w: World) => ((b = hull([...having(w, 'table', 'pos'), ...having(w, 'zone', 'pos')].map(e => e.pos)) ?? {x: 0, y: 0, w: W, h: H}) => ({c: mid(b), r: Math.hypot(b.w, b.h) / 2}))()
export const turnOf = (w: World, o: Iso): Turn => ({deg: o.rot, c: reach(w).c})
export const isoFit = (w: World, o: Iso): Box => ((r = reach(w)) => fitOf(r.c, r.r, -LIFT, Math.max(...levels(w)) * GAPS[o.gap]! + Z.wall, MARGIN))()
/** A level's screen translate: its storey lift plus its own move. */
export const lift = (w: World, o: Iso, lv: number): V2 => offset(turnOf(w, o), o.shift[lv] ?? [0, 0, 0], lv * GAPS[o.gap]!)
/** The cells a table takes: its body and seat bands. */
const taken = (t: T) => ((s = seatsOf(t)) => hull([t.pos, ...s.chairs, ...s.benches])!)()
/** A floor's slab: the hull of its tables (with seat bands) and its non-area zones, unpadded, so stitched floors abut on their shared edges. */
const slabOf = (w: World, lv: number) => (f: Ent<'floor'>) => hull([...tablesAt(w, lv).filter(t => t.pos.floor === f.id).map(taken), ...zonesAt(w, lv).filter(z => z.pos.floor === f.id && z.zone.kind !== 'area').map(z => z.pos)])
/** Stitching: a slab reaches across a gap of up to STITCH to the next slab on its right or below that it faces (overlapping ranges), so stitched floors abut whatever the data's margins. */
const STITCH = 4 * G
const over = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1
const reachTo = (bs: Box[]) => (a: Box): Box => {
  const right = bs.filter(b => b !== a && over(a.y, a.y + a.h, b.y, b.y + b.h) && b.x - a.x - a.w > 0 && b.x - a.x - a.w <= STITCH).map(b => b.x)
  const down = bs.filter(b => b !== a && over(a.x, a.x + a.w, b.x, b.x + b.w) && b.y - a.y - a.h > 0 && b.y - a.y - a.h <= STITCH).map(b => b.y)
  return {...a, w: right.length ? Math.min(...right) - a.x : a.w, h: down.length ? Math.min(...down) - a.y : a.h}
}
const flat = (t: Turn, b: Box, z = 0) => rect(b).map(p => proj(t)([p[0], p[1], z]))
const slab = (t: Turn, lv: number) => ([f, b]: [Ent<'floor'>, Box]) =>
  `<g data-slab="${esc(f.id)}">${piece(t)({at: mid(b), solids: [{foot: rect(b), z: -LIFT, h: LIFT, cls: `${SLAB[lv % SLAB.length]} stroke-1`}]})}</g>`
/** The level's grid: a line every cell, every 4th a shade stronger, clipped to its own slabs. */
const gridOf = (t: Turn, lv: number, bs: Box[]) => ((u = hull(bs)) => u ? `<defs><clipPath id="iso-clip-${lv}">${bs.map(b => `<polygon points="${pts(flat(t, b))}"/>`).join('')}</clipPath></defs>` +
  `<g data-igrid clip-path="url(#iso-clip-${lv})" fill="none" class="pointer-events-none">${[...lines(t, u, 0), ...lines(t, u, 1)].join('')}</g>` : '')()
const LINE = ['stroke-slate-400/30 dark:stroke-slate-500/30', 'stroke-slate-500/50 dark:stroke-slate-400/50']
const lines = (t: Turn, u: Box, ax: number) => ((n0 = Math.floor((ax ? u.y : u.x) / G), n1 = Math.ceil((ax ? u.y + u.h : u.x + u.w) / G)) => Array.from({length: n1 - n0 + 1}, (_, i) => ((k = (n0 + i) * G, ends: V2[] = ax ? [[u.x, k], [u.x + u.w, k]] : [[k, u.y], [k, u.y + u.h]]) =>
  `<polyline points="${pts(ends.map(p => proj(t)([p[0], p[1], 0.3])))}" stroke-width="${(n0 + i) % 4 ? 0.5 : 1}" class="${LINE[(n0 + i) % 4 ? 0 : 1]}"/>`)()))()
/** Zones on the slab: outlines (dashed unless filled) and names at their top-left corner; walls and dividers stand up as furniture instead. */
const ZLINE: Record<string, string> = {door: 'stroke-emerald-600 dark:stroke-emerald-400', stairs: 'stroke-violet-500 dark:stroke-violet-400', lobby: 'stroke-sky-500 dark:stroke-sky-400'}
const ZNAME = 'fill-slate-500 stroke-slate-50 stroke-[3px] text-[9px] font-semibold uppercase tracking-wider [paint-order:stroke] dark:fill-slate-400 dark:stroke-slate-900'
const ZFILL: Record<string, string> = {stand: 'fill-indigo-200/70 dark:fill-indigo-900/60', room: 'fill-teal-100/60 dark:fill-teal-900/40', prop: 'fill-slate-200/70 dark:fill-slate-700/60'}
const ZEDGE: Record<string, string> = {stand: 'stroke-indigo-500 dark:stroke-indigo-400', room: 'stroke-teal-500 dark:stroke-teal-400', prop: 'stroke-slate-400 dark:stroke-slate-500'}
const QUIET = ['divider', 'prop'] // never named on the plan
const STANDING = ['wall', 'divider']
const txt = (p: V2, cls: string, s: unknown, anchor = 'middle') => `<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" text-anchor="${anchor}" class="${cls}">${esc(s)}</text>`
const zone = (t: Turn) => (z: Ent<'zone' | 'pos'>) =>
  `<g data-izone="${esc(z.zone.kind)}"><title>${esc(z.zone.label)}</title><polygon points="${pts(flat(t, z.pos, 0.5))}" fill="none" stroke-width="1" stroke-dasharray="${ZFILL[z.zone.kind] ? '0' : '5 4'}" class="${ZFILL[z.zone.kind] ?? ''} ${ZLINE[z.zone.kind] ?? ZEDGE[z.zone.kind] ?? 'stroke-slate-400 dark:stroke-slate-500'}"/>` +
  (QUIET.includes(z.zone.kind) ? '' : txt(proj(t)([z.pos.x + 4, z.pos.y + 10, 0.5]), ZNAME, z.zone.label, 'start')) + '</g>'
/** Standing zones: a wall box (counter height), a line wall at wall height, a divider at shoulder height. */
const WALL = 'fill-stone-300 stroke-stone-500 stroke-[0.5px] dark:fill-stone-600 dark:stroke-stone-400'
/** A fragment: one piece of furniture, its painter box and the markup around it (`open` / `close`); `key` names it within its level. Turned at draw time (`fhtml`, or moved in place by layersiso). */
export type Frag = {key: string; at: V2; box: Box3; open: string; close: string; p: Piece}
const frag = (key: string, p: Piece, open: string): Frag => ({key, at: p.at, box: extent(p), open, close: '</g>', p})
export const fhtml = (f: Frag, sh: Shape[]) => f.open + wrapKind(f.p.kind, sh.map(html).join('')) + f.close
export const drawn = (tu: Turn) => (f: Frag) => shapes(tu)(f.p)
const standing = (z: Ent<'zone' | 'pos'>): Frag[] => ((h = z.zone.kind === 'divider' ? Z.divider : z.pos.w && z.pos.h ? Z.bar : Z.wall) =>
  wall(z.pos, h, WALL, G).map((p, i) => frag(`${z.id}/${i}`, p, `<g data-izone="${esc(z.zone.kind)}">${i ? '' : `<title>${esc(z.zone.label)}</title>`}`)))()
/** A wall's pieces depend on its zone only: kept between frames. */
const walls = new Map<string, {sig: string; fr: Frag[]}>()
const wallsOf = (z: Ent<'zone' | 'pos'>): Frag[] => ((sig = `${JSON.stringify(z.pos)}|${z.zone.kind}|${z.zone.label}`, hit = walls.get(z.id)) =>
  hit?.sig === sig ? hit.fr : ((fr = standing(z)) => (walls.set(z.id, {sig, fr}), fr))())()
// ---- tables as furniture; every piece is its own fragment so the painter can sort it among its neighbours (a table's pieces repeat its data-tid, marked data-frag)
type Side = 't' | 'r' | 'b' | 'l'
const sideOf = (p: Box, b: Box): Side => (b.y + b.h <= p.y + 0.5 ? 't' : b.y >= p.y + p.h - 0.5 ? 'b' : b.x + b.w <= p.x + 0.5 ? 'l' : 'r')
const FACE: Record<Side, number> = {t: Math.PI / 2, b: -Math.PI / 2, l: 0, r: Math.PI}
/** One seat as a piece in its finish: chairs face their table, petals its centre, benches put their back to the outer edge. */
const SEATS: Record<Place['kind'], (t: T, p: Place, cls: string) => Piece> = {
  chair: (t, p, c) => chair(mid(p.box), FACE[sideOf(t.pos, p.box)], p.box.w, Z.seat, c),
  high: (t, p, c) => chair(mid(p.box), FACE[sideOf(t.pos, p.box)], p.box.w, Z.highSeat, c),
  petal: (t, p, c) => chair(mid(p.box), (((p.a ?? 0) + 180) * Math.PI) / 180, p.box.w, t.seating?.high ? Z.highSeat : Z.seat, c),
  bench: (t, p, c) => bench(p.box, sideOf(t.pos, p.box), c),
  stool: (_t, p, c) => stool(mid(p.box), p.box.w / 2, Z.stool, c),
}
const PLAIN: Record<Place['kind'], string> = {chair: SEAT.plain, high: SEAT.plain, petal: SEAT.plain, bench: SEAT.bench, stool: SEAT.plain}
/** A booth with fixed seating: with an `open` side, one bench along the far side (the table's straight edge faces the opening); else two benches inside its footprint along the long sides, the table between them. */
const OPEN: Record<Side, (b: Box, d: number) => [Box, Place[]]> = {
  b: (b, d) => [{x: b.x + 2, y: b.y + d + 1, w: b.w - 4, h: b.h - d - 3}, [{kind: 'bench', box: {...b, h: d}}]],
  t: (b, d) => [{x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - d - 3}, [{kind: 'bench', box: {...b, y: b.y + b.h - d, h: d}}]],
  r: (b, d) => [{x: b.x + d + 1, y: b.y + 2, w: b.w - d - 3, h: b.h - 4}, [{kind: 'bench', box: {...b, w: d}}]],
  l: (b, d) => [{x: b.x + 2, y: b.y + 2, w: b.w - d - 3, h: b.h - 4}, [{kind: 'bench', box: {...b, x: b.x + b.w - d, w: d}}]],
}
const booth = (b: Box, open?: Side): [Box, Place[]] => ((long = b.w >= b.h, d = (long ? b.h : b.w) * 0.3) => open ? OPEN[open](b, Math.min(b.w, b.h) * 0.3) : long
  ? [{x: b.x + 2, y: b.y + d + 1, w: b.w - 4, h: b.h - 2 * d - 2}, [{kind: 'bench', box: {...b, h: d}}, {kind: 'bench', box: {...b, y: b.y + b.h - d, h: d}}]]
  : [{x: b.x + d + 1, y: b.y + 2, w: b.w - 2 * d - 2, h: b.h - 4}, [{kind: 'bench', box: {...b, w: d}}, {kind: 'bench', box: {...b, x: b.x + b.w - d, w: d}}]])()
/** A table's build: its top (ring and label sit on it), top height, the body pieces in the palette's paint, and its places. */
type Build = {top: V2[]; th: number; body: (p: Paint) => Piece[]; places: Place[]; own?: boolean; benches?: (cls: string[]) => Piece[]}
const topOf = (t: T): V2[] => (t.seating?.top ?? []).map(([x, y]): V2 => [t.pos.x + x * G, t.pos.y + y * G])
const BUILD: Record<string, (t: T) => Build> = {
  rect: t => ((th = t.seating?.high ? Z.high : Z.table, top = rect(grow(t.pos, -1))) => ({top, th, body: p => [table(t.pos, top, th, `${p.cls} stroke-1`, p.fill)], places: seatsOf(t).places}))(),
  round: t => ((th = t.seating?.high ? Z.high : Z.table, top = ngon(mid(t.pos), Math.min(t.pos.w, t.pos.h) / 2 - 1, 20)) => ({top, th, body: p => [table(t.pos, top, th, `${p.cls} stroke-1`, p.fill)], places: seatsOf(t).places}))(),
  booth: t => ((bt = booth(t.pos, t.seating?.open), top = rect(bt[0])) => ({top, th: Z.table, body: p => [table(bt[0], top, Z.table, `${p.cls} stroke-1`, p.fill)], places: bt[1]}))(),
  stool: t => ({top: ngon(mid(t.pos), Math.min(t.pos.w, t.pos.h) * 0.22, 12), th: Z.stool, body: () => [], places: [{kind: 'stool', box: grow({x: t.pos.x + t.pos.w / 2, y: t.pos.y + t.pos.h / 2, w: 0, h: 0}, Math.min(t.pos.w, t.pos.h) * 0.22)}], own: true}),
  shaped: t => ((c = contour(t, G), top = dedupe(c.table), th = t.seating?.high ? Z.high : Z.table, ps = seatsOf(t).places) => ({top, th, body: p => [table(box(top), top, th, `${p.cls} stroke-1`, p.fill)],
    places: [...ps.filter(q => q.kind === 'bench'), ...ps.filter(q => q.kind !== 'bench')], benches: (cls: string[]) => along(c.bench, cls)}))(),
  bar: t => ((top = topOf(t)) => ({top, th: Z.bar, body: p => counter(top, G, `${p.cls} stroke-1`, p.fill), places: seatsOf(t).places}))(),
}
/** Contoured benches (U12 `contour`): each band is its outer edge then its inner edge reversed; the bench places' finishes run along all bands in order. */
const along = (bands: V2[][], cls: string[]) => ((n = bands.reduce((a, b) => a + b.length / 2, 0) || 1) => bands.flatMap((b, j) => ((k = b.length / 2, done = bands.slice(0, j).reduce((a, x) => a + x.length / 2, 0)) =>
  strip(b.slice(0, k), b.slice(k).reverse(), G, f => cls[Math.min(cls.length - 1, Math.floor(((done + f * k) / n) * cls.length))] ?? SEAT.bench))()))()
const dedupe = (ps: V2[]) => ps.filter((q, i) => i === 0 || i < ps.length - 1 || q[0] !== ps[0]![0] || q[1] !== ps[0]![1])
const box = (ps: V2[]): Box => ((xs = ps.map(q => q[0]), ys = ps.map(q => q[1])) => ({x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)}))()
/** A table's build depends on its geometry only: keep it between frames (the turn and the state change, the geometry does not). */
const builds = new Map<string, {sig: string; b: Build}>()
const buildOf = (t: T): Build => ((sig = `${t.pos.x},${t.pos.y},${t.pos.w},${t.pos.h},${t.table.shape},${kindOf(t)},${JSON.stringify(t.seating ?? 0)}`, hit = builds.get(t.id)) =>
  hit?.sig === sig ? hit.b : ((b = BUILD[kindOf(t)]!(t)) => (builds.set(t.id, {sig, b}), b))())()
const fixed = (t: T) => !t.seating?.bench?.length && !Object.values(t.seating?.chairs ?? {}).some(n => n)
const kindOf = (t: T) => (t.seating?.top?.length ? 'bar' : t.seating?.open || t.seating?.bench?.length ? 'shaped' : t.table.shape === 'booth' ? (fixed(t) ? 'booth' : 'rect') : t.table.shape)
/** Occupancy: a seated table's first `n` places taken (filled red), the rest outlined red; an unseated table's seats plain (a lone stool wears the palette). */
const finish = (c: Ctx, t: T, b: Build, p: Paint) => ((on = !!slotAt(c.w, t.id), n = seatedAt(c.w, t.id)) =>
  b.places.map((pl, i) => (on ? (i < n ? SEAT.taken : SEAT.free) : b.own ? `${p.cls} stroke-[0.5px]` : PLAIN[pl.kind])))()
const centroid = (ps: V2[]): V2 => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length]
/** An insight (warn / crit) or the open card rings the top face. */
const ringOf = (c: Ctx, t: T) => ((a = c.alerts?.[t.id]) => (a ? {cls: ALERT[a.level], tag: ` data-insight="${a.level}"`} : c.pick === t.id ? {cls: 'stroke-sky-500', tag: ' data-picked'} : undefined))()
const ring3 = (c: Ctx, t: T, tu: Turn, b: Build) => ((r = ringOf(c, t)) => (r ? `<polygon${r.tag} points="${pts(b.top.map(q => proj(tu)([q[0], q[1], b.th + 0.5])))}" fill="none" stroke-width="3" class="${r.cls}"/>` : ''))()
const INK_BIG = 'text-[11px] font-bold [paint-order:stroke] stroke-white/80 stroke-[2px] dark:stroke-slate-900/80'
const INK_SMALL = 'text-[8px] font-bold [paint-order:stroke] stroke-white/80 stroke-[2px] dark:stroke-slate-900/80'
/** A table: its hit footprint (first, under everything; carries the title and seat count), its pieces as fragments, and its ring and label (over the level). */
export type Block = {at: V2; hit: string; frags: Frag[]; over: string}
const tagOf = (t: T) => `data-act="tcard" data-tid="${esc(t.id)}"`
/** A table's pieces in their finishes, kept while its build, palette and seat finishes stay (the turn does not change them). */
const kept = new Map<string, {b: Build; sig: string; fr: Frag[]}>()
const piecesOf = (t: T, b: Build, paint: Paint, cls: string[]): Piece[] => ((nb = b.benches ? b.places.filter(q => q.kind === 'bench').length : 0) =>
  [...b.body(paint), ...(b.benches?.(cls.slice(0, nb)) ?? []), ...b.places.map((pl, i) => (i < nb ? undefined : SEATS[pl.kind](t, pl, cls[i]!))).filter((x): x is Piece => !!x)])()
export const fragsOf = (c: Ctx, o: Iso, t: T): Frag[] => {
  const [paint, b] = [PAINT[o.pal](c)(t), buildOf(t)]
  const [cls, old] = [finish(c, t, b, paint), kept.get(t.id)]
  const sig = `${paint.cls}|${paint.fill ?? ''}|${cls.join(',')}`
  const fr = old?.b === b && old.sig === sig ? old.fr : piecesOf(t, b, paint, cls).map((p, i) => frag(`${t.id}/${i}`, p, `<g ${tagOf(t)} data-frag data-fi="${i}" class="cursor-pointer">`))
  return (kept.set(t.id, {b, sig, fr}), fr)
}
const hitOf = (c: Ctx, tu: Turn) => (t: T) =>
  `<g ${tagOf(t)} data-taken="${seatedAt(c.w, t.id)}" class="cursor-pointer"><title>${titleOf(c.w, c.holds)(t)}</title><polygon points="${footprint(tu, t)}" class="fill-transparent"/></g>`
const overOf = (c: Ctx, o: Iso, tu: Turn) => (t: T) => {
  const [paint, b] = [PAINT[o.pal](c)(t), buildOf(t)]
  const label = txt(proj(tu)([...centroid(b.top), b.th + 1] as P3), `${paint.ink} ${t.pos.w < 2 * G || t.pos.h < 2 * G || b.own ? INK_SMALL : INK_BIG}`, t.table.label)
  return `<g ${tagOf(t)} data-frag data-over class="cursor-pointer">${ring3(c, t, tu, b)}${label}</g>`
}
export const block = (c: Ctx, o: Iso, tu: Turn) => (t: T): Block => ({at: mid(t.pos), hit: hitOf(c, tu)(t), frags: fragsOf(c, o, t), over: overOf(c, o, tu)(t)})
const NAME = 'fill-slate-600 stroke-white stroke-[3px] text-[13px] font-semibold uppercase tracking-wide [paint-order:stroke] dark:fill-slate-300 dark:stroke-slate-900'
/** A floor's name off its slab's far corner (top of the screen under the turn). */
const name = (tu: Turn) => ([f, b]: [Ent<'floor'>, Box]) => ((cs = rect(b).map(p => proj(tu)([p[0], p[1], 0])), top = cs.reduce((a, p) => (p[1] < a[1] ? p : a))) => txt([top[0], top[1] - 8], NAME, f.floor.name))()
export const unit = (tu: Turn) => (e: Ent<'body'>) => ((p = proj(tu)([e.body.x, e.body.y, 22])) =>
  `<g data-unit="${esc(e.id)}"><title>${esc(e.id)} ${e.body.role} ${esc(e.body.task?.do ?? 'idle')}</title><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="7" class="${ROLE[e.body.role]} stroke-white stroke-2"/></g>`)()
export const ping = (tu: Turn) => (f: Fx) => ((p = proj(tu)([f.x, f.y, 8])) =>
  `<circle data-ping cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="16" fill="none" stroke-width="3" class="${RING[f.kind] ?? RING.left} origin-center animate-ping [transform-box:fill-box]"/>`)()
export const tr = (v: V2) => `translate(${v[0].toFixed(1)} ${v[1].toFixed(1)})`
/** What a level draws, by layer (bottom to top): base = slabs, zone outlines, grid; hits = table footprints; furn = furniture back to front; over = rings and table names; names = floor names; units, pings = the movers. */
export const LAYERS = ['base', 'hits', 'furn', 'over', 'names', 'units', 'pings'] as const
export type Layers = Record<typeof LAYERS[number], string>
/** A level's tables far to near under the turn. */
export const tabsAt = (c: Ctx, tu: Turn, lv: number) => tablesAt(c.w, lv).sort((a, b) => depthOf(tu, mid(a.pos)) - depthOf(tu, mid(b.pos)))
/** A level's floor slabs with their stitched reach: they depend on the layout only. */
export const slabsOf = (c: Ctx, lv: number): [Ent<'floor'>, Box][] => {
  const raw = having(c.w, 'floor').filter(f => levelOf(c.w, f.id) === lv).map(f => [f, slabOf(c.w, lv)(f)] as const).filter((x): x is [Ent<'floor'>, Box] => !!x[1])
  return raw.map(([f, b]): [Ent<'floor'>, Box] => [f, reachTo(raw.map(x => x[1]))(b)])
}
export const hitsOf = (c: Ctx, tu: Turn, tabs: T[]) => tabs.map(hitOf(c, tu)).join('')
/** A table's footprint polygon under a turn (the hit layer follows a turn by this alone). */
export const footprint = (tu: Turn, t: T) => pts(flat(tu, t.pos))
/** What the level draws besides furniture, hits and movers: slabs, zone outlines and grid, table rings and names, floor names. */
export const statics = (c: Ctx, o: Iso, tu: Turn, lv: number, tabs: T[], fs: [Ent<'floor'>, Box][]) => {
  const zs = zonesAt(c.w, lv).filter(z => !STANDING.includes(z.zone.kind))
  return {base: fs.map(slab(tu, lv)).join('') + zs.map(zone(tu)).join('') + gridOf(tu, lv, fs.map(x => x[1])), over: tabs.map(overOf(c, o, tu)).join(''), names: fs.map(name(tu)).join('')}
}
/** The level's fragments in draw-input order: tables far to near, then standing zones. */
export const wallsAt = (c: Ctx, lv: number): Frag[] => zonesAt(c.w, lv).filter(z => STANDING.includes(z.zone.kind)).flatMap(wallsOf)
export const fragsAt = (c: Ctx, o: Iso, lv: number, tabs: T[]): Frag[] => [...tabs.flatMap(t => fragsOf(c, o, t)), ...wallsAt(c, lv)]
/** Fragments back to front by the painter (`order`). */
export const sorted = (tu: Turn, fr: Frag[]) => order(tu, fr).map(i => fr[i]!)
export type Parts = Layers & {fr: Frag[]; sh: Shape[][]}
export const levelParts = (c: Ctx, o: Iso, fx: Fx[], lv: number): Parts => {
  const tu = turnOf(c.w, o), tabs = tabsAt(c, tu, lv)
  const fr = sorted(tu, fragsAt(c, o, lv, tabs))
  const sh = fr.map(drawn(tu))
  return {...statics(c, o, tu, lv, tabs, slabsOf(c, lv)), hits: hitsOf(c, tu, tabs), furn: fr.map((f, i) => fhtml(f, sh[i]!)).join(''), fr, sh, ...movers(c, o, fx, lv)}
}
/** Units and pings of a level (the mover layers), keyed for in-place updates. */
export const unitsOf = (c: Ctx, o: Iso, lv: number) => (o.units ? having(c.w, 'body').filter(b => levelOf(c.w, floorOf(c.w, b.id)) === lv) : [])
export const pingsOf = (c: Ctx, o: Iso, fx: Fx[], lv: number) => (o.pings ? fx.filter(f => levelOf(c.w, f.floor) === lv) : [])
const movers = (c: Ctx, o: Iso, fx: Fx[], lv: number) => ((tu = turnOf(c.w, o)) => ({units: unitsOf(c, o, lv).map(unit(tu)).join(''), pings: pingsOf(c, o, fx, lv).map(ping(tu)).join('')}))()
export const levelOpen = (c: Ctx, o: Iso, lv: number) => `<g data-level="${lv}" opacity="${(o.op[lv] ?? 100) / 100}" transform="${tr(lift(c.w, o, lv))}">`
export const wrapLayers = (p: Layers) => LAYERS.map(k => `<g data-layer="${k}">${p[k]}</g>`).join('')
const level = (c: Ctx, o: Iso, fx: Fx[]) => (lv: number) => levelOpen(c, o, lv) + wrapLayers(levelParts(c, o, fx, lv)) + '</g>'
const depthOf = (tu: Turn, p: V2) => depth(tu)(p)
/** The svg's insides, every level in full. */
export const isoInner = (c: Ctx, o: Iso, fx: Fx[] = []) => shownLevels(c.w, o).map(level(c, o, fx)).join('')
export const isoBox = (c: Ctx, o: Iso) => viewBox(isoFit(c.w, o), o.cam)
const HINT = 'isometric floors: drag empty space to turn, drag a level to move it along x, y or z, shift or right drag to pan, wheel to zoom'
/** The svg around the layers: the live panel paints this and the layers fill it (layers.iso.ts); `isoSvg` is the same with everything inside as one string. */
export const isoShell = (c: Ctx, o: Iso, inner = '') =>
  `<svg data-iso viewBox="${isoBox(c, o)}" class="max-h-[78vh] w-full cursor-grab touch-none select-none rounded bg-slate-50 active:cursor-grabbing dark:bg-slate-900" role="img" aria-label="${HINT}">${inner}</svg>`
export const isoSvg = (c: Ctx, o: Iso, fx: Fx[] = []) => isoShell(c, o, isoInner(c, o, fx))
// Controls (keyboard focusable buttons; radio groups carry role=radio + aria-checked, toggles aria-pressed).
const ROLE_OF: Record<string, (on: boolean) => string> = {radio: on => `role="radio" aria-checked="${on}"`, toggle: on => `aria-pressed="${on}"`, button: () => ''}
const press = (k: string, v: string | number, label: string, on: boolean, role = 'radio', aria = '') =>
  `<button type="button" ${ROLE_OF[role]!(on)}${aria ? ` aria-label="${esc(aria)}"` : ''} data-act="iso" data-k="${k}" data-v="${esc(v)}" class="${on ? ctaSm : ghost}">${esc(label)}</button>`
const group = (label: string, body: string, role = 'radiogroup') => `<div role="${role}" aria-label="${esc(label)}" class="flex flex-wrap items-center gap-1"><span class="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">${esc(label)}</span>${body}</div>`
const levelRow = (o: Iso) => (lv: number) =>
  group(levelName(lv), press('hide', lv, o.hide[lv] ? 'hidden' : 'shown', !o.hide[lv], 'toggle', `show ${levelName(lv)}`) + slider(o, lv), 'group')
/** Opacity slider: input moves the level live (no repaint), the readout follows. */
const slider = (o: Iso, lv: number) => ((v = o.op[lv] ?? 100) => `<input type="range" min="0" max="100" step="5" value="${v}" data-on="input:isoOp" data-lv="${lv}" aria-label="${esc(levelName(lv))} opacity" class="h-1.5 w-24 cursor-pointer accent-sky-600"/>` +
  `<output data-op="${lv}" class="w-9 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">${v}%</output>`)()
const swatch = (p: Paint, n: number) =>
  `<li class="flex items-center gap-1"><svg viewBox="0 0 12 12" class="h-3 w-3" aria-hidden="true"><rect width="12" height="12" rx="2" stroke-width="1.5"${p.fill ? ` fill="${esc(p.fill)}"` : ''} class="${p.cls}"/></svg>${esc(p.name)} <span class="opacity-60">${n}</span></li>`
/** The active palette's key: one swatch per value, with its table count. */
export const legend = (c: Ctx, o: Iso) => {
  const ps = having(c.w, 'table', 'pos').map(PAINT[o.pal](c))
  const keys = [...new Map(ps.map(p => [p.key, p])).values()]
  return `<ul data-legend class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700 dark:text-slate-200">${keys.map(p => swatch(p, ps.filter(x => x.key === p.key).length)).join('')}</ul>`
}
export const isoControls = (c: Ctx, o: Iso) =>
  `<div data-iso-controls class="mb-2 flex flex-col gap-1.5">${group('Colour by', PALS.map(([k, l]) => press('pal', k, l, o.pal === k)).join(''))}` +
  `<div class="flex flex-wrap gap-x-4 gap-y-1.5">${levels(c.w).map(levelRow(o)).join('')}${group('Spacing', GAPS.map((_, i) => press('gap', i, ['flat', 'S', 'M', 'L'][i]!, o.gap === i, 'radio', `level spacing ${i}`)).join(''))}` +
  group('Turn', press('rot', -90, '↺', false, 'button', 'turn left') + `<span data-rot class="w-9 text-center text-xs tabular-nums">${Math.round(o.rot)}°</span>` + press('rot', 90, '↻', false, 'button', 'turn right') + press('reset', 0, 'Reset view', false, 'button'), 'group') +
  group('Show', press('units', 1, 'units', o.units, 'toggle') + press('pings', 1, 'pings', o.pings, 'toggle'), 'group') + `</div>${legend(c, o)}</div>`

// ---- change keys: a layer is redrawn only when its key moves
const staffIds = (w: World) => having(w, 'staff').map(x => x.id).join(',')
/** Layout: everything the static layers draw (floors, table bodies and seating, zones). */
export const layoutKey = (w: World) => [having(w, 'floor').map(f => `${f.id}:${f.floor.level ?? 0}:${f.floor.name}`), (having(w, 'table', 'pos') as T[]).map(t => `${t.id}${t.pos.floor}:${t.pos.x},${t.pos.y},${t.pos.w},${t.pos.h}:${t.table.shape}:${t.table.label}:${JSON.stringify(t.seating ?? 0)}:${t.area?.id ?? ''}:${t.feat?.tags.join('+') ?? ''}`),
  having(w, 'zone', 'pos').map(z => `${z.id}${z.pos.floor}:${z.pos.x},${z.pos.y},${z.pos.w},${z.pos.h}:${z.zone.kind}:${z.zone.label}`)].join('#')
/** What a table's state pieces show (status, seats taken, server, section, outline, palette); the context part is shared by all tables. */
export const stateKey = (c: Ctx, o: Iso) => ((ex = `${o.pal}|${c.pick ?? ''}|${staffIds(c.w)}`) => (t: T) =>
  `${ex}|${t.table.status}|${t.table.capacity}|${seatedAt(c.w, t.id)}|${slotAt(c.w, t.id) ? 1 : 0}|${c.w.ents[t.table.section ?? '']?.section?.color ?? ''}|${c.alerts?.[t.id]?.level ?? ''}|${titleOf(c.w, c.holds)(t)}|${c.areas[t.area?.id ?? 'main']?.label ?? ''}`)()
