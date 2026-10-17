// Isometric floor view (U2): every level of the same world stacked in one 3D frame. Pure string builders; classes are literals here or in tone.ts, data colours come from entity data.
import {having} from '../contracts/index.ts'
import type {Components, Ent, Hold, Id, World} from '../contracts/index.ts'
import {ALERT, STAFF, seatTone, seatsOf, serverOf, titleOf} from './draw.ts'
import type {Alerts} from './draw.ts'
import {H, W, floorOf, hull, levelName, levelOf, levels} from './geo.ts'
import type {Box} from './geo.ts'
import {esc} from './render.ts'
import type {Fx} from './state.ts'
import {RING, ROLE, TABLE, ctaSm, ghost} from './tone.ts'
export type Pal = 'status' | 'area' | 'section' | 'server'
/** View controls: palette, per-level opacity stop and hide, level spacing stop, camera quarter-turns, overlays. */
export interface Iso {pal: Pal; op: Record<string, number>; hide: Record<string, boolean>; gap: number; turn: number; units: boolean; pings: boolean}
export const ISO: Iso = {pal: 'status', op: {1: 50}, hide: {}, gap: 3, turn: 0, units: true, pings: true} // upper levels start see-through
export const OPS = [25, 50, 75, 100]
export const GAPS = [0, 140, 280, 440] // frame px between storeys, per spacing stop
const OPC: Record<number, string> = {25: 'opacity-25', 50: 'opacity-50', 75: 'opacity-75', 100: 'opacity-100'}
const PALS: [Pal, string][] = [['status', 'Status'], ['area', 'Area'], ['section', 'Section'], ['server', 'Server']]
/** One control press: `k` names the setting, `v` its value (`op` takes `<level>:<stop>`). */
const SET: Record<string, (o: Iso, v: string) => Partial<Iso>> = {
  pal: (_, v) => ({pal: v as Pal}),
  op: (o, v) => ({op: {...o.op, [v.split(':')[0]!]: Number(v.split(':')[1])}}),
  hide: (o, v) => ({hide: {...o.hide, [v]: !o.hide[v]}}),
  gap: (_, v) => ({gap: Number(v)}),
  turn: (o, v) => ({turn: (o.turn + Number(v) + 4) % 4}),
  units: o => ({units: !o.units}),
  pings: o => ({pings: !o.pings}),
}
export const tweak = (o: Iso, k: string, v: string): Iso => ({...o, ...(SET[k]?.(o, v) ?? {})})
// Projection: 2:1 isometric of (x, y, z), y down the frame, z up; larger x + y is nearer the viewer.
type P3 = [x: number, y: number, z: number]
const C = Math.cos(Math.PI / 6)
const sx = ([x, y]: P3) => (x - y) * C
const sy = ([x, y, z]: P3) => (x + y) / 2 - z
const pt = (p: P3) => `${sx(p).toFixed(1)},${sy(p).toFixed(1)}`
/** Camera turn: `k` clockwise quarter-turns of a box inside the W x H frame (the frame swaps sides each turn). */
type Fr = [fw: number, fh: number, b: Box]
const quarter = ([fw, fh, b]: Fr): Fr => [fh, fw, {x: fh - b.y - b.h, y: b.x, w: b.h, h: b.w}]
const turned = (k: number) => (b: Box) => Array.from({length: k}).reduce<Fr>(f => quarter(f), [W, H, b])[2]
const corners = (b: Box, z: number): P3[] => [[b.x, b.y, z], [b.x + b.w, b.y, z], [b.x + b.w, b.y + b.h, z], [b.x, b.y + b.h, z]]
const poly = (ps: P3[], cls: string, fill?: string) => `<polygon points="${ps.map(pt).join(' ')}"${fill ? ` fill="${esc(fill)}"` : ''} class="${cls}"/>`
/** A shaded box: front (+y) and right (+x) sides under a shade, then the top face. */
const prism = (b: Box, z: number, h: number, cls: string, fill?: string) => {
  const [lo, hi] = [corners(b, z), corners(b, z + h)]
  const front: P3[] = [lo[3]!, lo[2]!, hi[2]!, hi[3]!], right: P3[] = [lo[1]!, lo[2]!, hi[2]!, hi[1]!]
  return poly(front, cls, fill) + poly(front, 'fill-black/10') + poly(right, cls, fill) + poly(right, 'fill-black/30') + poly(hi, cls, fill)
}
const txt = (p: P3, cls: string, s: unknown, anchor = 'middle', dx = 0) => `<text x="${(sx(p) + dx).toFixed(1)}" y="${sy(p).toFixed(1)}" text-anchor="${anchor}" class="${cls}">${esc(s)}</text>`
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
// Drawing: per level a translucent group of floor slabs, then tables back to front, then units and pings.
const SLAB = ['fill-slate-200 stroke-slate-400 dark:fill-slate-700 dark:stroke-slate-500', 'fill-indigo-50/70 stroke-indigo-400 dark:fill-indigo-950/70 dark:stroke-indigo-500']
const LIFT = 6, PAD = 22, SIDE = 150 // SIDE: room either side for floor names
const tall = (t: T) => (t.table.shape === 'stool' ? 8 : 16)
const zOf = (o: Iso, lv: number) => lv * GAPS[o.gap]!
const shownLevels = (w: World, o: Iso) => levels(w).filter(lv => !o.hide[lv])
const tablesAt = (w: World, lv: number): T[] => having(w, 'table', 'pos').filter(t => levelOf(w, t.pos.floor) === lv)
const zonesAt = (w: World, lv: number) => having(w, 'zone', 'pos').filter(z => levelOf(w, z.pos.floor) === lv)
/** A floor's slab: its tables' and zones' box, padded, just under the level's plane; its name sits off the slab's left corner, drawn after the level's blocks so none hides it. */
const padded = (w: World, o: Iso, lv: number) => (f: Ent<'floor'>) =>
  ((b = hull([...tablesAt(w, lv), ...zonesAt(w, lv)].filter(t => t.pos.floor === f.id).map(t => turned(o.turn)(t.pos)))) => b && {x: b.x - PAD, y: b.y - PAD, w: b.w + 2 * PAD, h: b.h + 2 * PAD})()
/** Zones on the slab: dashed outlines on the level's plane, names at their (turned) top-left corner. */
const ZLINE: Record<string, string> = {door: 'stroke-emerald-600 dark:stroke-emerald-400', stairs: 'stroke-violet-500 dark:stroke-violet-400', lobby: 'stroke-sky-500 dark:stroke-sky-400'}
const ZNAME = 'fill-slate-500 stroke-slate-50 stroke-[3px] text-[9px] font-semibold uppercase tracking-wider [paint-order:stroke] dark:fill-slate-400 dark:stroke-slate-900'
const ZFILL: Record<string, string> = {stand: 'fill-indigo-200/70 dark:fill-indigo-900/60', room: 'fill-teal-100/60 dark:fill-teal-900/40', prop: 'fill-slate-200/70 dark:fill-slate-700/60'}
const ZEDGE: Record<string, string> = {stand: 'stroke-indigo-500 dark:stroke-indigo-400', room: 'stroke-teal-500 dark:stroke-teal-400', prop: 'stroke-slate-400 dark:stroke-slate-500'}
const QUIET = ['divider', 'prop'] // never named on the plan
/** A partition: one solid thin line along the rect's long axis. */
const wall = (b: Box, z: number) => ((h = b.w >= b.h) => `<polyline points="${pt([b.x, b.y, z])} ${pt([h ? b.x + b.w : b.x, h ? b.y : b.y + b.h, z])}" fill="none" stroke-width="2" stroke-linecap="round" class="stroke-slate-500 dark:stroke-slate-400"/>`)()
const zone = (o: Iso, lv: number) => (z: Ent<'zone' | 'pos'>) => {
  const [b, zz] = [turned(o.turn)(z.pos), zOf(o, lv) + 0.5]
  if (z.zone.kind === 'divider') return `<g data-izone="divider"><title>${esc(z.zone.label)}</title>${wall(b, zz)}</g>`
  return `<g data-izone="${esc(z.zone.kind)}"><title>${esc(z.zone.label)}</title><polygon points="${corners(b, zz).map(pt).join(' ')}" fill="none" stroke-width="1" stroke-dasharray="${ZFILL[z.zone.kind] ? '0' : '5 4'}" class="${ZFILL[z.zone.kind] ?? ''} ${ZLINE[z.zone.kind] ?? ZEDGE[z.zone.kind] ?? 'stroke-slate-400 dark:stroke-slate-500'}"/>` +
    (QUIET.includes(z.zone.kind) ? '' : txt([b.x + 4, b.y + 10, zz], ZNAME, z.zone.label, 'start')) + '</g>'
}
const slab = (w: World, o: Iso, lv: number) => (f: Ent<'floor'>) =>
  ((p = padded(w, o, lv)(f)) => (p ? `<g data-slab="${esc(f.id)}">${prism(p, zOf(o, lv) - LIFT, LIFT, `${SLAB[lv % SLAB.length]} stroke-1`)}</g>` : ''))()
/** Where a floor's name goes, in preference order: off a slab corner (or the middle of its left edge) (frame point, text anchor, screen dx, lift). */
const CORNER: {at: (p: Box) => [number, number]; anchor: string; dx: number; dz: number}[] = [
  {at: p => [p.x, p.y + p.h], anchor: 'end', dx: -8, dz: -4}, {at: p => [p.x, p.y + p.h / 2], anchor: 'end', dx: -8, dz: -4}, {at: p => [p.x + p.w, p.y + p.h], anchor: 'middle', dx: 0, dz: -22},
  {at: p => [p.x + p.w, p.y], anchor: 'start', dx: 8, dz: -4}, {at: p => [p.x, p.y], anchor: 'middle', dx: 0, dz: 12},
]
const CLEAR = 60 // frame px a name needs from the level's other slabs
const gapTo = ([x, y]: [number, number]) => (b: Box) => Math.hypot(Math.max(b.x - x, 0, x - b.x - b.w), Math.max(b.y - y, 0, y - b.y - b.h))
/** The first corner with room from the other slabs on the level, else the roomiest. */
const cornerOf = (p: Box, others: Box[]) => {
  const room = CORNER.map(c => Math.min(Infinity, ...others.map(gapTo(c.at(p)))))
  return CORNER[room.findIndex(r => r >= CLEAR)] ?? CORNER[room.indexOf(Math.max(...room))]!
}
const NAME = 'fill-slate-600 stroke-white stroke-[3px] text-[13px] font-semibold uppercase tracking-wide [paint-order:stroke] dark:fill-slate-300 dark:stroke-slate-900'
const name = (o: Iso, lv: number, all: (Box | undefined)[]) => (f: Ent<'floor'>, i: number) => {
  const p = all[i]
  const c = p && cornerOf(p, all.filter((b, k): b is Box => !!b && k !== i))
  return p && c ? txt([...c.at(p), zOf(o, lv) - LIFT + c.dz], NAME, f.floor.name, c.anchor, c.dx) : ''
}
/** An insight (warn / crit) or the open card rings the block's top face. */
const ringOf = (c: Ctx, t: T) => ((a = c.alerts?.[t.id]) => (a ? {cls: ALERT[a.level], tag: ` data-insight="${a.level}"`} : c.pick === t.id ? {cls: 'stroke-sky-500', tag: ' data-picked'} : undefined))()
const ring3 = (c: Ctx, t: T, b: Box, z: number) => ((r = ringOf(c, t)) => (r ? `<polygon${r.tag} points="${corners(b, z).map(pt).join(' ')}" fill="none" stroke-width="3" class="${r.cls}"/>` : ''))()
/** Chairs and benches as low pads on the floor under the block (quiet tone of the table's status), never catching the pointer. */
const pads = (o: Iso, z: number, t: T) => ((s = seatsOf(t), c = seatTone(t.table.status)) => t.seating ? `<g data-iseats class="pointer-events-none">${[...s.benches.map(b => [b, 5] as const), ...s.chairs.map(r => [r, 3] as const)].map(([r, h]) => prism(turned(o.turn)(r), z, h, c)).join('')}</g>` : '')()
const block = (c: Ctx, o: Iso, lv: number) => (t: T) => {
  const [b, paint, z] = [turned(o.turn)(t.pos), PAINT[o.pal](c)(t), zOf(o, lv)]
  return `<g data-tid="${esc(t.id)}" data-act="tcard" class="cursor-pointer"><title>${titleOf(c.w, c.holds)(t)}</title>${pads(o, z, t)}${prism(b, z, tall(t), `${paint.cls} stroke-1`, paint.fill)}${ring3(c, t, b, z + tall(t))}` +
    txt([b.x + b.w / 2, b.y + b.h / 2, z + tall(t) - 4], `${paint.ink} ${t.table.shape === 'stool' ? 'text-[8px]' : 'text-[12px]'} font-bold`, t.table.label) + '</g>'
}
const near = (o: Iso) => (t: T) => ((b = turned(o.turn)(t.pos)) => b.x + b.w / 2 + b.y + b.h / 2)()
const at = (o: Iso, x: number, y: number, z: number): P3 => ((b = turned(o.turn)({x, y, w: 0, h: 0})) => [b.x, b.y, z])()
const unit = (o: Iso, z: number) => (e: Ent<'body'>) =>
  `<g data-unit="${esc(e.id)}"><title>${esc(e.id)} ${e.body.role} ${esc(e.body.task?.do ?? 'idle')}</title><circle cx="${sx(at(o, e.body.x, e.body.y, z + 22)).toFixed(1)}" cy="${sy(at(o, e.body.x, e.body.y, z + 22)).toFixed(1)}" r="7" class="${ROLE[e.body.role]} stroke-white stroke-2"/></g>`
const ring = (o: Iso, z: number) => (f: Fx) =>
  `<circle data-ping cx="${sx(at(o, f.x, f.y, z + 8)).toFixed(1)}" cy="${sy(at(o, f.x, f.y, z + 8)).toFixed(1)}" r="16" fill="none" stroke-width="3" class="${RING[f.kind] ?? RING.left} origin-center animate-ping [transform-box:fill-box]"/>`
const level = (c: Ctx, o: Iso, fx: Fx[]) => (lv: number) => {
  const ts = tablesAt(c.w, lv).sort((a, b) => near(o)(a) - near(o)(b))
  const us = o.units ? having(c.w, 'body').filter(b => levelOf(c.w, floorOf(c.w, b.id)) === lv) : []
  const ps = o.pings ? fx.filter(f => levelOf(c.w, f.floor) === lv) : []
  const fs = having(c.w, 'floor').filter(f => levelOf(c.w, f.id) === lv)
  return `<g data-level="${lv}" class="${OPC[o.op[lv] ?? 100] ?? 'opacity-100'}">${fs.map(slab(c.w, o, lv)).join('')}${zonesAt(c.w, lv).map(zone(o, lv)).join('')}${ts.map(block(c, o, lv)).join('')}${fs.map(name(o, lv, fs.map(padded(c.w, o, lv)))).join('')}` +
    us.map(unit(o, zOf(o, lv))).join('') + ps.map(ring(o, zOf(o, lv))).join('') + '</g>'
}
/** The viewBox over every shown level's slabs, from plane to block tops, plus a margin for labels. */
const view = (w: World, o: Iso) => {
  const pts = shownLevels(w, o).flatMap(lv => [...tablesAt(w, lv), ...zonesAt(w, lv)].flatMap(t => [zOf(o, lv) - LIFT - 30, zOf(o, lv) + 30].flatMap(z => corners(turned(o.turn)(t.pos), z))))
  const [xs, ys] = [pts.map(sx), pts.map(sy)]
  const [x0, y0] = [Math.min(...xs) - SIDE, Math.min(...ys) - PAD * 2]
  return pts.length ? [x0, y0, Math.max(...xs) + SIDE - x0, Math.max(...ys) + PAD * 2 - y0].map(Math.round).join(' ') : `0 0 ${W} ${H}`
}
export const isoSvg = (c: Ctx, o: Iso, fx: Fx[] = []) =>
  `<svg data-iso viewBox="${view(c.w, o)}" class="max-h-[78vh] w-full rounded bg-slate-50 dark:bg-slate-900" role="img" aria-label="isometric floors">${shownLevels(c.w, o).map(level(c, o, fx)).join('')}</svg>`
// Controls (keyboard focusable buttons; radio groups carry role=radio + aria-checked, toggles aria-pressed).
const ROLE_OF: Record<string, (on: boolean) => string> = {radio: on => `role="radio" aria-checked="${on}"`, toggle: on => `aria-pressed="${on}"`, button: () => ''}
const press = (k: string, v: string | number, label: string, on: boolean, role = 'radio', aria = '') =>
  `<button type="button" ${ROLE_OF[role]!(on)}${aria ? ` aria-label="${esc(aria)}"` : ''} data-act="iso" data-k="${k}" data-v="${esc(v)}" class="${on ? ctaSm : ghost}">${esc(label)}</button>`
const group = (label: string, body: string, role = 'radiogroup') => `<div role="${role}" aria-label="${esc(label)}" class="flex flex-wrap items-center gap-1"><span class="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">${esc(label)}</span>${body}</div>`
const levelRow = (o: Iso) => (lv: number) =>
  group(levelName(lv), press('hide', lv, o.hide[lv] ? 'hidden' : 'shown', !o.hide[lv], 'toggle', `show ${levelName(lv)}`) + OPS.map(op => press('op', `${lv}:${op}`, `${op}%`, (o.op[lv] ?? 100) === op, 'radio', `${levelName(lv)} opacity ${op}%`)).join(''))
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
  group('Turn', press('turn', -1, '↺', false, 'button', 'turn left') + `<span class="w-9 text-center text-xs tabular-nums">${o.turn * 90}°</span>` + press('turn', 1, '↻', false, 'button', 'turn right'), 'group') +
  group('Show', press('units', 1, 'units', o.units, 'toggle') + press('pings', 1, 'pings', o.pings, 'toggle'), 'group') + `</div>${legend(c, o)}</div>`
